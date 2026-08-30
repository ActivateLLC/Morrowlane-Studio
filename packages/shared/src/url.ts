/** URL helpers shared by the crawler, remix flow, and every "paste a link" input. */

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  // Only http(s) is crawlable; a bare domain is the common paste, so it gets a scheme.
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) return null;
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;

  url.hash = '';
  // Tracking parameters create duplicate pages that pollute the knowledge graph.
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|msclkid|mc_cid|mc_eid|ref|_hs)/i.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function originOf(input: string): string | null {
  const normalized = normalizeUrl(input);
  if (!normalized) return null;
  return new URL(normalized).origin;
}

export function registrableHost(input: string): string | null {
  const normalized = normalizeUrl(input);
  if (!normalized) return null;
  return new URL(normalized).hostname.replace(/^www\./, '');
}

/** Same-site check that tolerates the www/apex split most marketing sites have. */
export function isSameSite(a: string, b: string): boolean {
  const hostA = registrableHost(a);
  const hostB = registrableHost(b);
  return hostA !== null && hostA === hostB;
}

export function resolveUrl(base: string, href: string): string | null {
  try {
    return normalizeUrl(new URL(href, base).toString());
  } catch {
    return null;
  }
}

export function pathSegments(input: string): string[] {
  const normalized = normalizeUrl(input);
  if (!normalized) return [];
  return new URL(normalized).pathname.split('/').filter(Boolean);
}
