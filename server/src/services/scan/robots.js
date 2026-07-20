import { fetchText } from './fetcher.js';

/**
 * Minimal robots.txt support: enough to honour the directives that matter for a
 * polite crawler (User-agent grouping, Allow/Disallow, Sitemap), without
 * pulling in a dependency.
 *
 * Matching follows the usual longest-match-wins rule, with Allow beating
 * Disallow on an equal-length match.
 */
function parseRobots(body) {
  const groups = [];
  let current = null;

  for (const rawLine of String(body).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      // Consecutive user-agent lines share one group of rules.
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === 'allow' || field === 'disallow') && current) {
      current.rules.push({ allow: field === 'allow', path: value });
    } else if (field === 'sitemap') {
      groups.sitemaps = groups.sitemaps ?? [];
      groups.sitemaps.push(value);
    }
  }

  return groups;
}

/** Picks the group for our agent, falling back to the wildcard group. */
function rulesFor(groups, userAgent) {
  const agent = userAgent.toLowerCase();
  const specific = groups.find((group) => group.agents.some((a) => a !== '*' && agent.includes(a)));
  if (specific) return specific.rules;

  const wildcard = groups.find((group) => group.agents.includes('*'));
  return wildcard ? wildcard.rules : [];
}

function pathMatches(rulePath, targetPath) {
  if (rulePath === '') return false; // empty Disallow means "allow everything"

  // robots.txt supports * wildcards and $ end-anchors.
  if (rulePath.includes('*') || rulePath.endsWith('$')) {
    const anchored = rulePath.endsWith('$');
    const body = anchored ? rulePath.slice(0, -1) : rulePath;
    const pattern = body
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(targetPath);
  }

  return targetPath.startsWith(rulePath);
}

/**
 * Loads robots.txt for an origin. A missing or unreadable file means "crawl
 * allowed" — that is the convention, and treating it as a block would make the
 * scanner useless on sites that simply have no robots.txt.
 */
export async function loadRobots(origin, userAgent) {
  const result = await fetchText(new URL('/robots.txt', origin).toString());

  if (!result.ok || !result.body.trim()) {
    return {
      status: result.status === 404 ? 'not_found' : result.status ? 'not_found' : 'error',
      isAllowed: () => true,
      sitemaps: [],
    };
  }

  const groups = parseRobots(result.body);
  const rules = rulesFor(groups, userAgent);

  const isAllowed = (targetUrl) => {
    let path;
    try {
      const parsed = new URL(targetUrl);
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      return false;
    }

    let best = null;
    for (const rule of rules) {
      if (!pathMatches(rule.path, path)) continue;
      // Longest match wins; Allow wins ties.
      if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) {
        best = rule;
      }
    }

    return best ? best.allow : true;
  };

  return { status: 'found', isAllowed, sitemaps: groups.sitemaps ?? [] };
}

export default { loadRobots };
