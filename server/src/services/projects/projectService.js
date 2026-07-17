import { ERROR_CODES, PROJECT_STATUS, ROLES } from '../../config/constants.js';
import { BusinessData, BusinessProject, Plan, SchemaDocument, WebsiteScan } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildPageMeta, parsePagination, parseSort } from '../../utils/pagination.js';
import { UnsafeUrlError, assertSafeUrl, normalizeDomain } from '../../utils/url.js';
import { AUDIT_ACTIONS, recordAudit } from '../audit/auditService.js';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'projectName', 'schemaHealthScore', 'lastScannedAt'];

/** Maps an UnsafeUrlError onto the right API error code. */
function toUrlApiError(error) {
  const isPrivate = ['private_ip', 'blocked_host'].includes(error.reason);
  return ApiError.badRequest(error.message, {
    code: isPrivate ? ERROR_CODES.UNSAFE_WEBSITE_URL : ERROR_CODES.INVALID_WEBSITE_URL,
    errors: [{ field: 'websiteUrl', message: error.message }],
  });
}

function validateWebsiteUrl(websiteUrl) {
  try {
    const url = assertSafeUrl(websiteUrl);
    return { url: url.toString(), normalizedDomain: normalizeDomain(websiteUrl) };
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw toUrlApiError(error);
    throw error;
  }
}

/** Enforces the plan's project cap. -1 means unlimited. */
async function assertProjectQuota(user) {
  if (user.role === ROLES.ADMIN) return;

  const plan = await Plan.findOne({ slug: user.plan, active: true }).lean();
  if (!plan || plan.projectLimit === -1) return;

  const activeCount = await BusinessProject.countDocuments({
    userId: user._id,
    status: { $ne: PROJECT_STATUS.ARCHIVED },
  });

  if (activeCount >= plan.projectLimit) {
    throw new ApiError(403, `Your ${plan.name} plan includes ${plan.projectLimit} project${plan.projectLimit === 1 ? '' : 's'}. Upgrade or archive a project to add another.`, {
      code: ERROR_CODES.PROJECT_LIMIT_REACHED,
      errors: [{ field: 'plan', limit: plan.projectLimit, current: activeCount }],
    });
  }
}

export async function createProject({ user, payload }, req) {
  const { url, normalizedDomain } = validateWebsiteUrl(payload.websiteUrl);

  await assertProjectQuota(user);

  const duplicate = await BusinessProject.findOne({
    userId: user._id,
    normalizedDomain,
    status: { $ne: PROJECT_STATUS.ARCHIVED },
  })
    .select('_id projectName')
    .lean();

  if (duplicate) {
    throw ApiError.conflict('You already have a project for this website.', {
      code: ERROR_CODES.DUPLICATE_PROJECT,
      errors: [
        { field: 'websiteUrl', message: `"${duplicate.projectName}" already uses this domain.` },
      ],
    });
  }

  const project = await BusinessProject.create({
    ...payload,
    websiteUrl: url,
    normalizedDomain,
    userId: user._id,
    agencyId: user.role === ROLES.AGENCY ? user._id : null,
    status: PROJECT_STATUS.DRAFT,
  });

  // The business data record is created alongside the project and seeded with
  // what the user typed, marked as manual entry. The scanner later proposes
  // values against this same record rather than creating a competing one.
  await BusinessData.create({
    projectId: project._id,
    identity: {
      businessName: project.businessName,
      businessType: project.businessType,
      websiteUrl: project.websiteUrl,
    },
    address: { addressCountry: project.country },
    extractedFields: [
      {
        field: 'identity.businessName',
        value: project.businessName,
        sourceUrl: '',
        confidence: 100,
        method: 'manual_entry',
        confirmed: true,
        confirmedAt: new Date(),
      },
      {
        field: 'identity.websiteUrl',
        value: project.websiteUrl,
        sourceUrl: '',
        confidence: 100,
        method: 'manual_entry',
        confirmed: true,
        confirmedAt: new Date(),
      },
    ],
    confirmedFields: ['identity.businessName', 'identity.websiteUrl'],
  });

  recordAudit({
    userId: user._id,
    action: AUDIT_ACTIONS.PROJECT_CREATED,
    resourceType: 'BusinessProject',
    resourceId: project._id,
    metadata: { websiteUrl: project.websiteUrl },
    req,
  });

  return project;
}

export async function listProjects({ user, query, filter }) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, SORTABLE_FIELDS);

  const criteria = { ...filter };
  if (query.status) criteria.status = query.status;
  else criteria.status = { $ne: PROJECT_STATUS.ARCHIVED };

  if (query.search) {
    // Escaped so a search string cannot inject regex metacharacters.
    const safe = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(safe, 'i');
    criteria.$and = [
      ...(criteria.$and ?? []),
      { $or: [{ projectName: pattern }, { businessName: pattern }, { normalizedDomain: pattern }] },
    ];
  }

  const [items, total] = await Promise.all([
    BusinessProject.find(criteria).sort(sort).skip(skip).limit(limit).lean(),
    BusinessProject.countDocuments(criteria),
  ]);

  return { items, meta: buildPageMeta({ page, limit, total }) };
}

export async function getProjectDetail(project) {
  const [businessData, latestScan, schemaCount, scanCount] = await Promise.all([
    BusinessData.findOne({ projectId: project._id }).lean(),
    WebsiteScan.findOne({ projectId: project._id }).sort({ createdAt: -1 }).lean(),
    SchemaDocument.countDocuments({ projectId: project._id }),
    WebsiteScan.countDocuments({ projectId: project._id }),
  ]);

  return {
    project,
    businessData: businessData ?? null,
    latestScan: latestScan ?? null,
    counts: { schemas: schemaCount, scans: scanCount },
  };
}

export async function updateProject({ project, payload, user }, req) {
  const patch = { ...payload };

  if (payload.websiteUrl) {
    const { url, normalizedDomain } = validateWebsiteUrl(payload.websiteUrl);
    patch.websiteUrl = url;
    patch.normalizedDomain = normalizedDomain;

    if (normalizedDomain !== project.normalizedDomain) {
      const clash = await BusinessProject.findOne({
        userId: project.userId,
        normalizedDomain,
        _id: { $ne: project._id },
        status: { $ne: PROJECT_STATUS.ARCHIVED },
      })
        .select('_id')
        .lean();

      if (clash) {
        throw ApiError.conflict('You already have a project for this website.', {
          code: ERROR_CODES.DUPLICATE_PROJECT,
          errors: [{ field: 'websiteUrl', message: 'Another project already uses this domain.' }],
        });
      }
    }
  }

  Object.assign(project, patch);
  await project.save();

  recordAudit({
    userId: user._id,
    action: AUDIT_ACTIONS.PROJECT_UPDATED,
    resourceType: 'BusinessProject',
    resourceId: project._id,
    metadata: { fields: Object.keys(patch) },
    req,
  });

  return project;
}

export async function archiveProject({ project, user }, req) {
  if (project.status === PROJECT_STATUS.ARCHIVED) {
    throw ApiError.badRequest('This project is already archived.');
  }

  project.status = PROJECT_STATUS.ARCHIVED;
  project.archivedAt = new Date();
  await project.save();

  recordAudit({
    userId: user._id,
    action: AUDIT_ACTIONS.PROJECT_ARCHIVED,
    resourceType: 'BusinessProject',
    resourceId: project._id,
    req,
  });

  return project;
}

export async function restoreProject({ project, user }, req) {
  if (project.status !== PROJECT_STATUS.ARCHIVED) {
    throw ApiError.badRequest('This project is not archived.');
  }

  // Restoring must not resurrect a domain the user has since re-added.
  const clash = await BusinessProject.findOne({
    userId: project.userId,
    normalizedDomain: project.normalizedDomain,
    _id: { $ne: project._id },
    status: { $ne: PROJECT_STATUS.ARCHIVED },
  })
    .select('projectName')
    .lean();

  if (clash) {
    throw ApiError.conflict(
      `"${clash.projectName}" now uses this domain. Archive it first to restore this project.`,
      { code: ERROR_CODES.DUPLICATE_PROJECT },
    );
  }

  project.status = project.lastScannedAt ? PROJECT_STATUS.READY : PROJECT_STATUS.DRAFT;
  project.archivedAt = null;
  await project.save();

  recordAudit({
    userId: user._id,
    action: AUDIT_ACTIONS.PROJECT_RESTORED,
    resourceType: 'BusinessProject',
    resourceId: project._id,
    req,
  });

  return project;
}

/**
 * Hard delete, cascading to the project's own records. Audit and credit history
 * intentionally survive: they are a record of what happened, not project data.
 */
export async function deleteProject({ project, user }, req) {
  const projectId = project._id;

  await Promise.all([
    BusinessData.deleteMany({ projectId }),
    WebsiteScan.deleteMany({ projectId }),
    SchemaDocument.deleteMany({ projectId }),
  ]);

  await BusinessProject.deleteOne({ _id: projectId });

  recordAudit({
    userId: user._id,
    action: AUDIT_ACTIONS.PROJECT_DELETED,
    resourceType: 'BusinessProject',
    resourceId: projectId,
    metadata: { projectName: project.projectName, websiteUrl: project.websiteUrl },
    req,
  });

  return { deleted: true };
}

export default {
  createProject,
  listProjects,
  getProjectDetail,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
};
