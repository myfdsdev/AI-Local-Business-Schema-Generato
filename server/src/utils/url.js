import net from 'node:net';

/**
 * URL parsing, normalization and SSRF safety checks (spec section 23).
 *
 * Phase 1 uses this to validate project website URLs. The Phase 2 crawler will
 * reuse the same primitives, re-running `assertSafeUrl` on every hop of a
 * redirect chain — a hostname that resolves publicly at project-creation time
 * can still point somewhere private later, so these checks are not a one-off.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Hostnames that always refer to the local machine. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  // Cloud instance metadata services.
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

/** Suffixes used for internal/private network naming. */
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home.arpa'];

/** Link-local address used by AWS/GCP/Azure/DigitalOcean metadata endpoints. */
const METADATA_IPV4 = '169.254.169.254';

export class UnsafeUrlError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'UnsafeUrlError';
    this.reason = reason;
  }
}

export function parseUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;

  let candidate = input.trim();
  // Accept "example.com" as well as a fully qualified URL.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

/** True for IPv4 addresses that are not routable on the public internet. */
export function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true; // Malformed: treat as unsafe rather than guessing.
  }

  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast

  return false;
}

/** True for IPv6 addresses that are not routable on the public internet. */
export function isPrivateIPv6(address) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');

  if (normalized === '::' || normalized === '::1') return true; // unspecified / loopback

  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible forms tunnel the IPv4 rules.
  const mapped = normalized.match(/^::(?:ffff:(?:0{1,4}:)?)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  if (/^f[cd]/.test(normalized)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(normalized)) return true; // fe80::/10 link-local
  if (/^ff/.test(normalized)) return true; // ff00::/8 multicast
  if (normalized.startsWith('64:ff9b:')) return true; // NAT64
  if (normalized.startsWith('2002:')) return true; // 6to4 — can encapsulate private IPv4

  return false;
}

export function isPrivateAddress(address) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return false;
}

/**
 * Rejects URLs that are malformed, non-HTTP, or aimed at private/internal
 * infrastructure. Throws UnsafeUrlError so callers can map the reason onto an
 * API error code.
 */
export function assertSafeUrl(input) {
  const url = parseUrl(input);
  if (!url) throw new UnsafeUrlError('That does not look like a valid website URL.', 'invalid_url');

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError('Only http:// and https:// websites can be scanned.', 'protocol');
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError('Website URLs must not contain embedded credentials.', 'credentials');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) throw new UnsafeUrlError('That URL is missing a hostname.', 'invalid_url');

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname === METADATA_IPV4) {
    throw new UnsafeUrlError('Local and internal addresses cannot be scanned.', 'blocked_host');
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new UnsafeUrlError('Internal network addresses cannot be scanned.', 'blocked_host');
  }

  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new UnsafeUrlError('Private and loopback IP addresses cannot be scanned.', 'private_ip');
  }

  // A bare hostname with no dot cannot be a public domain (e.g. "intranet").
  if (!net.isIP(hostname) && !hostname.includes('.')) {
    throw new UnsafeUrlError('Enter a full public domain, for example example.com.', 'invalid_url');
  }

  return url;
}

export function isSafeUrl(input) {
  try {
    assertSafeUrl(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Canonical host key for a project, used to spot duplicate projects for the
 * same site. Drops protocol, "www." and trailing dots; keeps a non-default port.
 */
export function normalizeDomain(input) {
  const url = parseUrl(input);
  if (!url) return null;

  let host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);

  const isDefaultPort =
    !url.port || (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80');

  return isDefaultPort ? host : `${host}:${url.port}`;
}

/** Origin + path with tracking noise and trailing slashes removed. */
export function normalizeUrl(input) {
  const url = parseUrl(input);
  if (!url) return null;

  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|msclkid|mc_eid|mc_cid|ref)/i.test(key)) url.searchParams.delete(key);
  }

  let pathname = url.pathname.replace(/\/{2,}/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  url.pathname = pathname;

  return url.toString();
}

/** True when `candidate` belongs to the same registrable site as `base`. */
export function isSameSite(candidate, base) {
  const a = normalizeDomain(candidate);
  const b = normalizeDomain(base);
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`);
}
