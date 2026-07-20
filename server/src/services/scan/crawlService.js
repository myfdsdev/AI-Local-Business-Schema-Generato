import {
  PLAN_PAGE_SCAN_LIMITS,
  PLAN_SLUGS,
  PROJECT_STATUS,
  SCAN_STATUS,
  SCAN_STEPS,
} from '../../config/constants.js';
import logger from '../../config/logger.js';
import { BusinessProject, WebsiteScan } from '../../models/index.js';
import { refundCredits, reserveCredits } from '../credits/creditService.js';
import { extractBusinessData } from './businessExtractor.js';
import { USER_AGENT, fetchPage } from './fetcher.js';
import { classifyPage, parsePage } from './pageParser.js';
import { loadRobots } from './robots.js';

/** Pages worth crawling first — these carry the business facts we need. */
const PRIORITY = ['contact', 'about', 'locations', 'services', 'homepage'];

const stepProgress = (step) => Math.round(((SCAN_STEPS.indexOf(step) + 1) / SCAN_STEPS.length) * 100);

async function setStep(scan, step, extra = {}) {
  scan.currentStep = step;
  scan.progress = stepProgress(step);
  Object.assign(scan, extra);
  await scan.save();
}

/**
 * Creates a queued scan for a project and reserves the credits it will cost.
 * Kept separate from `runScan` so the HTTP request can return immediately while
 * the crawl continues in the background.
 */
export async function startScan({ project, user }) {
  const pageLimit = PLAN_PAGE_SCAN_LIMITS[user.plan] ?? PLAN_PAGE_SCAN_LIMITS[PLAN_SLUGS.FREE];

  const scan = await WebsiteScan.create({
    projectId: project._id,
    userId: user._id,
    status: SCAN_STATUS.QUEUED,
    pageLimit,
    currentStep: SCAN_STEPS[0],
    progress: 0,
  });

  // One credit per scan run. Reserved up front so a user cannot start several
  // scans they cannot pay for; refunded if the crawl fails outright.
  await reserveCredits({
    userId: user._id,
    amount: 1,
    reason: `Website scan for ${project.normalizedDomain}`,
    projectId: project._id,
    scanId: scan._id,
  });

  scan.creditsReserved = 1;
  await scan.save();

  return scan;
}

/**
 * Runs the crawl. Progress reflects real work — each step is written only once
 * the corresponding stage has actually happened, never simulated on a timer.
 */
export async function runScan(scanId) {
  const scan = await WebsiteScan.findById(scanId);
  if (!scan) return;

  const project = await BusinessProject.findById(scan.projectId);
  if (!project) return;

  try {
    scan.status = SCAN_STATUS.RUNNING;
    scan.startedAt = new Date();
    await setStep(scan, 'preparing_scan');

    await BusinessProject.updateOne({ _id: project._id }, { status: PROJECT_STATUS.SCANNING });

    const origin = new URL(project.websiteUrl).origin;
    const robots = await loadRobots(origin, USER_AGENT);
    scan.robotsTxtStatus = robots.status;
    scan.sitemapUrl = robots.sitemaps?.[0] ?? null;

    // --- Homepage -----------------------------------------------------------
    await setStep(scan, 'reading_homepage');

    if (!robots.isAllowed(project.websiteUrl)) {
      scan.robotsTxtStatus = 'disallowed';
      throw new Error('This site’s robots.txt disallows crawling its homepage.');
    }

    const homepage = await fetchPage(project.websiteUrl);
    if (!homepage.ok) {
      scan.failedPages.push({ url: project.websiteUrl, reason: homepage.reason, statusCode: homepage.status });
      throw new Error(`Could not read the homepage: ${homepage.reason}`);
    }

    const collected = [];
    const seen = new Set();
    const recordPage = (result, parsed, isHomepage) => {
      seen.add(result.url);
      scan.scannedPages.push({
        url: result.url,
        pageType: classifyPage(result.url, isHomepage),
        statusCode: result.status,
        title: parsed.title,
        renderer: 'cheerio',
        textLength: parsed.text.length,
        fetchedAt: new Date(),
      });
      if (parsed.detectedSchemas.length) scan.detectedSchemas.push(...parsed.detectedSchemas);
      collected.push({ url: result.url, ...parsed });
    };

    const homeParsed = parsePage(homepage.html, homepage.url);
    recordPage(homepage, homeParsed, true);

    // --- Discovery ----------------------------------------------------------
    await setStep(scan, 'discovering_pages');

    const candidates = homeParsed.links.filter((link) => !seen.has(link) && robots.isAllowed(link));
    // Crawl the highest-value page types first so a small page budget is spent well.
    candidates.sort((a, b) => {
      const rank = (url) => {
        const index = PRIORITY.indexOf(classifyPage(url));
        return index === -1 ? PRIORITY.length : index;
      };
      return rank(a) - rank(b);
    });

    scan.discoveredPages = candidates.slice(0, 100);
    await scan.save();

    // --- Crawl the rest of the budget --------------------------------------
    for (const url of candidates) {
      if (scan.scannedPages.length >= scan.pageLimit) break;
      if (seen.has(url)) continue;

      const result = await fetchPage(url);
      if (!result.ok) {
        scan.failedPages.push({ url, reason: result.reason, statusCode: result.status });
        continue;
      }
      recordPage(result, parsePage(result.html, result.url), false);
    }
    await scan.save();

    // --- Extraction ---------------------------------------------------------
    await setStep(scan, 'extracting_business_information');
    const extraction = await extractBusinessData({ project, pages: collected });

    await setStep(scan, 'detecting_existing_schema');
    await setStep(scan, 'generating_recommendations', {
      extractedBusinessData: extraction.businessData,
    });

    await setStep(scan, 'validating_results');
    if (extraction.warnings?.length) {
      scan.warnings.push(...extraction.warnings.map((message) => ({ code: 'EXTRACTION', message, url: '' })));
    }

    // --- Done ---------------------------------------------------------------
    scan.status = SCAN_STATUS.COMPLETED;
    scan.completedAt = new Date();
    scan.creditsConsumed = scan.creditsReserved;
    await setStep(scan, 'scan_completed');

    await BusinessProject.updateOne(
      { _id: project._id },
      { status: PROJECT_STATUS.READY, lastScanAt: new Date() },
    );

    logger.info('Scan completed', {
      scanId: String(scan._id),
      pages: scan.scannedPages.length,
      schemas: scan.detectedSchemas.length,
    });
  } catch (error) {
    logger.error('Scan failed', { scanId: String(scan._id), message: error.message });

    scan.status = SCAN_STATUS.FAILED;
    scan.completedAt = new Date();
    scan.errors.push({ code: 'SCAN_FAILED', message: error.message, url: '' });

    // The crawl produced nothing usable, so the reserved credit goes back.
    if (scan.creditsReserved > 0 && scan.creditsConsumed === 0) {
      try {
        await refundCredits({
          userId: scan.userId,
          amount: scan.creditsReserved,
          reason: 'Website scan failed',
          projectId: scan.projectId,
          scanId: scan._id,
        });
      } catch (refundError) {
        logger.error('Failed to refund scan credit', { scanId: String(scan._id), message: refundError.message });
      }
    }

    await scan.save();
    await BusinessProject.updateOne({ _id: scan.projectId }, { status: PROJECT_STATUS.DRAFT });
  }
}

export default { startScan, runScan };
