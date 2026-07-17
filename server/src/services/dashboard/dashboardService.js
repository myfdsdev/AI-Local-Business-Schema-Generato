import { PROJECT_STATUS, SCAN_STATUS, SCHEMA_STATUS } from '../../config/constants.js';
import {
  BusinessProject,
  Location,
  Plan,
  SchemaDocument,
  WebsiteScan,
} from '../../models/index.js';
import { ownershipFilter } from '../../middleware/ownership.js';

/**
 * Dashboard statistics (spec section 17), computed from real collections.
 *
 * The counts run as one aggregation with $facet rather than a dozen
 * countDocuments calls, so the dashboard costs a single round trip.
 */
export async function getDashboardStats(user) {
  const scope = ownershipFilter(user);
  const projectScope = Object.keys(scope).length > 0 ? scope : {};

  const projectIds = await BusinessProject.find(projectScope).distinct('_id');

  const [projectFacet] = await BusinessProject.aggregate([
    { $match: projectScope },
    {
      $facet: {
        total: [{ $match: { status: { $ne: PROJECT_STATUS.ARCHIVED } } }, { $count: 'count' }],
        active: [{ $match: { status: PROJECT_STATUS.READY } }, { $count: 'count' }],
        archived: [{ $match: { status: PROJECT_STATUS.ARCHIVED } }, { $count: 'count' }],
        avgHealth: [
          { $match: { schemaHealthScore: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: '$schemaHealthScore' } } },
        ],
        needsAttention: [
          {
            $match: {
              status: { $ne: PROJECT_STATUS.ARCHIVED },
              $or: [{ schemaHealthScore: { $lt: 60 } }, { lastScannedAt: null }],
            },
          },
          { $count: 'count' },
        ],
      },
    },
  ]);

  const [schemaFacet] = await SchemaDocument.aggregate([
    { $match: { projectId: { $in: projectIds } } },
    {
      $facet: {
        total: [{ $count: 'count' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      },
    },
  ]);

  const [totalLocations, scansUsed, plan] = await Promise.all([
    Location.countDocuments({ projectId: { $in: projectIds }, active: true }),
    WebsiteScan.countDocuments({
      projectId: { $in: projectIds },
      status: { $in: [SCAN_STATUS.COMPLETED, SCAN_STATUS.RUNNING] },
    }),
    Plan.findOne({ slug: user.plan, active: true }).lean(),
  ]);

  const first = (facetSlice) => facetSlice?.[0]?.count ?? 0;
  const statusCount = (status) =>
    schemaFacet?.byStatus?.find((entry) => entry._id === status)?.count ?? 0;

  const avgHealth = projectFacet?.avgHealth?.[0]?.avg;

  return {
    totalProjects: first(projectFacet?.total),
    activeWebsites: first(projectFacet?.active),
    archivedProjects: first(projectFacet?.archived),
    totalLocations,
    schemasGenerated: first(schemaFacet?.total),
    validSchemas: statusCount(SCHEMA_STATUS.VALID),
    schemasWithWarnings: statusCount(SCHEMA_STATUS.WARNING),
    schemasWithErrors: statusCount(SCHEMA_STATUS.ERROR),
    averageSchemaHealthScore: avgHealth === undefined ? null : Math.round(avgHealth),
    projectsNeedingAttention: first(projectFacet?.needsAttention),
    scansUsed,
    remainingCredits: user.scanCredits,
    plan: plan
      ? { name: plan.name, slug: plan.slug, projectLimit: plan.projectLimit, pageScanLimit: plan.pageScanLimit }
      : null,
  };
}

export async function getRecentActivity(user, { limit = 5 } = {}) {
  const scope = ownershipFilter(user);
  const projectIds = await BusinessProject.find(scope).distinct('_id');

  const [recentProjects, recentScans] = await Promise.all([
    BusinessProject.find({ ...scope, status: { $ne: PROJECT_STATUS.ARCHIVED } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    WebsiteScan.find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('projectId', 'projectName websiteUrl')
      .lean(),
  ]);

  return { recentProjects, recentScans };
}

/**
 * Distribution for the dashboard's validation status chart. Returns explicit
 * zeros rather than an empty array so the chart renders a real empty state.
 */
export async function getValidationBreakdown(user) {
  const scope = ownershipFilter(user);
  const projectIds = await BusinessProject.find(scope).distinct('_id');

  const rows = await SchemaDocument.aggregate([
    { $match: { projectId: { $in: projectIds } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));

  return [
    { status: 'valid', label: 'Valid', count: counts[SCHEMA_STATUS.VALID] ?? 0 },
    { status: 'warning', label: 'Warnings', count: counts[SCHEMA_STATUS.WARNING] ?? 0 },
    { status: 'error', label: 'Errors', count: counts[SCHEMA_STATUS.ERROR] ?? 0 },
    { status: 'draft', label: 'Draft', count: counts[SCHEMA_STATUS.DRAFT] ?? 0 },
  ];
}

export default { getDashboardStats, getRecentActivity, getValidationBreakdown };
