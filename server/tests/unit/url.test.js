import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import {
  assertSafeUrl,
  isPrivateIPv4,
  isPrivateIPv6,
  isSafeUrl,
  normalizeDomain,
  normalizeUrl,
  isSameSite,
} from '../../src/utils/url.js';

// These are pure functions with no DB dependency, so this file runs standalone.

describe('URL safety (SSRF prevention)', () => {
  it('accepts ordinary public URLs', () => {
    assert.equal(isSafeUrl('https://example.com'), true);
    assert.equal(isSafeUrl('example.com'), true);
    assert.equal(isSafeUrl('https://sub.example.co.uk/contact'), true);
  });

  it('blocks localhost and loopback hostnames', () => {
    for (const url of ['http://localhost', 'https://localhost:3000', 'http://ip6-localhost']) {
      assert.equal(isSafeUrl(url), false, `${url} should be blocked`);
    }
  });

  it('blocks loopback and private IPv4 literals', () => {
    for (const url of [
      'http://127.0.0.1',
      'http://127.1.2.3',
      'http://10.0.0.5',
      'http://192.168.1.1',
      'http://172.16.5.4',
      'http://0.0.0.0',
    ]) {
      assert.equal(isSafeUrl(url), false, `${url} should be blocked`);
    }
  });

  it('blocks the cloud metadata endpoint by IP and by hostname', () => {
    assert.equal(isSafeUrl('http://169.254.169.254/latest/meta-data'), false);
    assert.equal(isSafeUrl('http://metadata.google.internal'), false);
  });

  it('blocks private IPv6 and IPv4-mapped IPv6', () => {
    assert.equal(isSafeUrl('http://[::1]'), false);
    assert.equal(isSafeUrl('http://[fd00::1]'), false);
    assert.equal(isSafeUrl('http://[::ffff:127.0.0.1]'), false);
  });

  it('blocks non-HTTP protocols and embedded credentials', () => {
    assert.equal(isSafeUrl('file:///etc/passwd'), false);
    assert.equal(isSafeUrl('ftp://example.com'), false);
    assert.equal(isSafeUrl('gopher://example.com'), false);
    assert.equal(isSafeUrl('https://user:pass@example.com'), false);
  });

  it('blocks internal-network hostname suffixes and bare single-label hosts', () => {
    assert.equal(isSafeUrl('http://db.internal'), false);
    assert.equal(isSafeUrl('http://server.local'), false);
    assert.equal(isSafeUrl('http://intranet'), false);
  });

  it('surfaces a reason on the thrown error', () => {
    assert.throws(() => assertSafeUrl('http://127.0.0.1'), (error) => error.reason === 'private_ip');
    assert.throws(() => assertSafeUrl('ftp://example.com'), (error) => error.reason === 'protocol');
  });

  it('classifies private ranges directly', () => {
    assert.equal(isPrivateIPv4('10.1.1.1'), true);
    assert.equal(isPrivateIPv4('100.64.0.1'), true); // carrier-grade NAT
    assert.equal(isPrivateIPv4('8.8.8.8'), false);
    assert.equal(isPrivateIPv6('fe80::1'), true);
    assert.equal(isPrivateIPv6('2606:4700::1'), false);
  });
});

describe('URL normalization', () => {
  it('reduces a URL to a canonical domain key', () => {
    assert.equal(normalizeDomain('https://www.Example.com/path'), 'example.com');
    assert.equal(normalizeDomain('http://example.com:8080'), 'example.com:8080');
    assert.equal(normalizeDomain('https://example.com:443'), 'example.com');
  });

  it('strips tracking params and trailing slashes', () => {
    assert.equal(
      normalizeUrl('https://example.com/page/?utm_source=x&keep=1'),
      'https://example.com/page?keep=1',
    );
  });

  it('detects same-site relationships', () => {
    assert.equal(isSameSite('https://blog.example.com', 'https://example.com'), true);
    assert.equal(isSameSite('https://evil.com', 'https://example.com'), false);
  });
});

// node:test keeps the process alive if anything registered a handle; nothing
// here did, but be explicit for parity with the DB-backed suites.
after(() => {});
