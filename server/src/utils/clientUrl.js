import { env } from '../config/env.js';

/**
 * The canonical public address of the front end, used to build every link we
 * send a user: buyer logins, password resets, workspace invites, access claims.
 *
 * Defensive on purpose. CLIENT_URL is documented as ONE url, but pasting a
 * comma-separated list into it is an easy mistake — and the result was not a
 * crash but silently malformed links like
 * "https://a.com,https://b.com/claim-access?token=…", which browsers refuse to
 * open. Every recipient of such an email is simply stuck.
 *
 * Taking the first entry keeps those links working; fixing the env var is still
 * what decides WHICH domain customers see.
 */
export function clientUrl() {
  const first = String(env.CLIENT_URL ?? '')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');
  return first;
}

export default clientUrl;
