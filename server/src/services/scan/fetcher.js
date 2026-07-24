import dns from 'node:dns/promises';
import net from 'node:net';

import axios from 'axios';

import logger from '../../config/logger.js';
import { UnsafeUrlError, assertSafeUrl, isPrivateAddress } from '../../utils/url.js';

export const USER_AGENT = 'LocalSchemaAI-Scanner/1.0 (+https://localschema.ai/bot)';

const TIMEOUT_MS = 8_000; // a real page answers well under this; slower isn't worth waiting for
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — pages beyond this are not worth parsing
const MAX_REDIRECTS = 5;

/**
 * assertSafeUrl only inspects the hostname *string*, so a public-looking domain
 * that resolves to 10.x / 127.x would still slip through. Resolving first and
 * checking every returned address closes that hole.
 *
 * Note: this is not full DNS-rebinding protection (the address could change
 * between this lookup and the socket connect). Closing that properly needs a
 * pinned-IP agent; this covers the realistic case.
 */
const DNS_TIMEOUT_MS = 5_000;

/** dns.lookup has no built-in timeout, and a hung resolver would hang the scan. */
function lookupWithTimeout(hostname) {
  return Promise.race([
    dns.lookup(hostname, { all: true }),
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('DNS timeout')), DNS_TIMEOUT_MS).unref(),
    ),
  ]);
}

async function assertResolvesToPublicAddress(hostname) {
  if (net.isIP(hostname)) return; // literal IPs are already vetted by assertSafeUrl

  let records;
  try {
    records = await lookupWithTimeout(hostname);
  } catch {
    throw new UnsafeUrlError('That domain could not be resolved.', 'dns_failure');
  }

  for (const { address } of records) {
    if (isPrivateAddress(address)) {
      throw new UnsafeUrlError('That domain resolves to a private address.', 'private_ip');
    }
  }
}

/**
 * Fetches one page with the crawler's safety rules applied.
 *
 * Redirects are followed manually (maxRedirects: 0) so that EVERY hop is
 * re-validated — otherwise an allowed public URL could redirect straight to
 * localhost or a cloud metadata endpoint.
 *
 * Returns a result object rather than throwing for ordinary failures (404,
 * timeout, wrong content type); the crawler records those as failed pages.
 */
export async function fetchPage(rawUrl) {
  let current;
  try {
    current = assertSafeUrl(rawUrl).toString();
  } catch (error) {
    return { ok: false, url: String(rawUrl), status: null, reason: error.message };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let parsed;
    try {
      parsed = assertSafeUrl(current);
      await assertResolvesToPublicAddress(parsed.hostname);
    } catch (error) {
      return { ok: false, url: current, status: null, reason: error.message };
    }

    let response;
    try {
      response = await axios.get(current, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en',
        },
        timeout: TIMEOUT_MS,
        maxRedirects: 0, // handled manually, see above
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        responseType: 'text',
        decompress: true,
        // Treat 3xx as a normal result so we can inspect Location ourselves.
        validateStatus: (status) => status >= 200 && status < 400,
      });
    } catch (error) {
      const status = error.response?.status ?? null;
      return {
        ok: false,
        url: current,
        status,
        reason: status ? `HTTP ${status}` : error.code === 'ECONNABORTED' ? 'Timed out' : error.message,
      };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.location;
      if (!location) {
        return { ok: false, url: current, status: response.status, reason: 'Redirect without a location' };
      }
      try {
        current = new URL(location, current).toString();
      } catch {
        return { ok: false, url: current, status: response.status, reason: 'Invalid redirect target' };
      }
      continue;
    }

    const contentType = String(response.headers?.['content-type'] ?? '');
    if (!contentType.includes('html')) {
      return { ok: false, url: current, status: response.status, reason: `Not HTML (${contentType || 'unknown'})` };
    }

    return {
      ok: true,
      url: current,
      status: response.status,
      contentType,
      html: typeof response.data === 'string' ? response.data : String(response.data ?? ''),
    };
  }

  logger.warn('Scan fetch exceeded redirect limit', { url: rawUrl });
  return { ok: false, url: current, status: null, reason: 'Too many redirects' };
}

/** Plain-text fetch used for robots.txt (no HTML content-type requirement). */
export async function fetchText(rawUrl) {
  try {
    const parsed = assertSafeUrl(rawUrl);
    await assertResolvesToPublicAddress(parsed.hostname);

    const response = await axios.get(parsed.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      timeout: TIMEOUT_MS,
      maxContentLength: 512 * 1024,
      responseType: 'text',
      maxRedirects: 2,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    return { ok: response.status >= 200 && response.status < 300, status: response.status, body: String(response.data ?? '') };
  } catch (error) {
    return { ok: false, status: error.response?.status ?? null, body: '' };
  }
}

export default { fetchPage, fetchText, USER_AGENT };
