import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for the crawler. Every fetch target is a user-pasted URL (brand site,
 * remix link, competitor), so before we make an outbound request we resolve the host
 * and refuse anything that points at private, loopback, link-local or otherwise
 * internal address space. Redirects are re-checked per hop by the caller, because a
 * public host can 302 to an internal one.
 */

function ipv4InBlockedRange(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 192 && b === 0) return true; // 192.0.0/24 protocol assignments incl. 192.0.0.0
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function ipv6InBlockedRange(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4-mapped/compat (::ffff:a.b.c.d) — fall back to the v4 rules.
  const mapped = lower.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4InBlockedRange(mapped[1]!);
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb'))
    return true; // link-local fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  if (lower.startsWith('ff')) return true; // multicast
  return false;
}

function ipIsBlocked(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return ipv4InBlockedRange(ip);
  if (family === 6) return ipv6InBlockedRange(ip);
  return true; // not a recognizable IP → refuse
}

/**
 * Resolves `hostname` and returns true only when every resolved address is a public,
 * routable one. A literal IP is checked directly; a name is resolved (all records) so
 * a DNS answer pointing at 127.0.0.1 or 169.254.169.254 is caught.
 */
export async function hostIsPublic(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false;

  if (isIP(host)) return !ipIsBlocked(host);

  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    return false; // unresolvable → don't fetch
  }
  if (records.length === 0) return false;
  return records.every((r) => !ipIsBlocked(r.address));
}

/** Convenience: parse a URL and confirm its host resolves to public address space. */
export async function urlIsPublic(url: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return hostIsPublic(hostname);
}
