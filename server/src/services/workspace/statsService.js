import { APP_ID, MEMBER_STATUS } from '../../config/constants.js';
import { BusinessProject, WebsiteScan, WorkspaceMember } from '../../models/index.js';

const WEEKS = 8;

/** Sunday 00:00 of the week containing `date`. */
function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * Workspace-level overview + an 8-week time series of projects created and
 * scans run. Everything is scoped to the workspace: scans are reached through
 * the workspace's own projects, so no other tenant's data can leak in.
 */
export async function getWorkspaceStats(workspaceId) {
  const projects = await BusinessProject.find({ workspaceId }).select('createdAt').lean();
  const projectIds = projects.map((p) => p._id);

  const scans = projectIds.length
    ? await WebsiteScan.find({ projectId: { $in: projectIds } }).select('createdAt').lean()
    : [];

  const members = await WorkspaceMember.countDocuments({
    appId: APP_ID,
    workspaceId,
    status: MEMBER_STATUS.ACTIVE,
  });

  // Fixed 8 buckets ending this week, so the chart always shows a full range.
  const thisWeek = weekStart(new Date());
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (WEEKS - 1 - i) * 7);
    return { time: start.getTime(), week: `${start.getMonth() + 1}/${start.getDate()}`, projects: 0, scans: 0 };
  });
  const indexByTime = new Map(buckets.map((b, i) => [b.time, i]));
  const bump = (createdAt, key) => {
    const i = indexByTime.get(weekStart(createdAt).getTime());
    if (i !== undefined) buckets[i][key] += 1;
  };

  projects.forEach((p) => bump(p.createdAt, 'projects'));
  scans.forEach((s) => bump(s.createdAt, 'scans'));

  return {
    totals: { members, projects: projects.length, scans: scans.length },
    series: buckets.map(({ week, projects: p, scans: s }) => ({ week, projects: p, scans: s })),
  };
}

export default { getWorkspaceStats };
