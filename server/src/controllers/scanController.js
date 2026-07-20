import { ERROR_CODES, SCAN_STATUS } from '../config/constants.js';
import logger from '../config/logger.js';
import { WebsiteScan } from '../models/index.js';
import { getBalance } from '../services/credits/creditService.js';
import { runScan, startScan } from '../services/scan/crawlService.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Trimmed scan shape for the client — full page text is never sent. */
function presentScan(scan) {
  return {
    id: scan._id,
    projectId: scan.projectId,
    status: scan.status,
    currentStep: scan.currentStep,
    progress: scan.progress,
    pageLimit: scan.pageLimit,
    robotsTxtStatus: scan.robotsTxtStatus,
    scannedPages: scan.scannedPages.map((page) => ({
      url: page.url,
      pageType: page.pageType,
      statusCode: page.statusCode,
      title: page.title,
      textLength: page.textLength,
    })),
    failedPages: scan.failedPages.map((page) => ({ url: page.url, reason: page.reason })),
    detectedSchemas: scan.detectedSchemas.map((item) => ({ type: item.type, url: item.url })),
    extractedBusinessData: scan.extractedBusinessData,
    errors: scan.errors,
    warnings: scan.warnings,
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
    createdAt: scan.createdAt,
  };
}

export const start = asyncHandler(async (req, res) => {
  const project = req.project;

  // One active scan per project keeps credits and progress unambiguous.
  const active = await WebsiteScan.findOne({
    projectId: project._id,
    status: { $in: [SCAN_STATUS.QUEUED, SCAN_STATUS.RUNNING] },
  });
  if (active) {
    throw ApiError.conflict('A scan is already running for this project.', {
      code: 'SCAN_ALREADY_RUNNING',
      errors: [{ field: 'scanId', message: String(active._id) }],
    });
  }

  const balance = await getBalance(req.user._id);
  if (balance < 1) {
    throw new ApiError(403, 'You have no scan credits left.', {
      code: ERROR_CODES.INSUFFICIENT_CREDITS,
    });
  }

  const scan = await startScan({ project, user: req.user });

  // Run in the background so the request returns immediately; the client polls
  // GET /scans/:scanId for live progress.
  setImmediate(() => {
    runScan(scan._id).catch((error) =>
      logger.error('Background scan crashed', { scanId: String(scan._id), message: error.message }),
    );
  });

  return sendSuccess(res, {
    statusCode: 202,
    message: 'Scan started.',
    data: { scan: presentScan(scan) },
  });
});

export const detail = asyncHandler(async (req, res) => {
  const scan = await WebsiteScan.findOne({ _id: req.params.scanId, userId: req.user._id });
  // 404 rather than 403 so scan ids cannot be probed for existence.
  if (!scan) throw ApiError.notFound('Scan not found.');

  return sendSuccess(res, { message: 'OK', data: { scan: presentScan(scan) } });
});

export const listForProject = asyncHandler(async (req, res) => {
  const scans = await WebsiteScan.find({ projectId: req.project._id, userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  return sendSuccess(res, { message: 'OK', data: { scans: scans.map(presentScan) } });
});

export default { start, detail, listForProject };
