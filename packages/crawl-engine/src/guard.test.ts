import { describe, expect, it } from 'vitest';
import { hostIsPublic, urlIsPublic } from './guard.js';

describe('SSRF guard', () => {
  it('refuses loopback, private and link-local literal IPs', async () => {
    for (const host of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0']) {
      expect(await hostIsPublic(host), host).toBe(false);
    }
  });

  it('refuses loopback and unique-local IPv6', async () => {
    for (const host of ['::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1']) {
      expect(await hostIsPublic(host), host).toBe(false);
    }
  });

  it('refuses localhost and internal service names without resolving them', async () => {
    expect(await hostIsPublic('localhost')).toBe(false);
    expect(await hostIsPublic('redis.railway.internal')).toBe(false);
    expect(await hostIsPublic('')).toBe(false);
  });

  it('allows a public literal IP', async () => {
    expect(await hostIsPublic('93.184.216.34')).toBe(true); // example.com range
    expect(await hostIsPublic('8.8.8.8')).toBe(true);
  });

  it('urlIsPublic rejects a private host in a full URL', async () => {
    expect(await urlIsPublic('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(await urlIsPublic('not a url')).toBe(false);
  });
});
