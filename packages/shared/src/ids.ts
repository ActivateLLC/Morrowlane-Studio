/** Prefixed, sortable-enough identifiers. Prefixes make logs and URLs readable. */
export const ID_PREFIXES = {
  organization: 'org',
  membership: 'mem',
  brand: 'brd',
  page: 'pag',
  product: 'prd',
  asset: 'ast',
  content: 'cnt',
  campaign: 'cmp',
  campaignPhase: 'cph',
  schedule: 'sch',
  connection: 'con',
  job: 'job',
  competitor: 'cpt',
  trend: 'trn',
  insight: 'ins',
  event: 'evt',
  remix: 'rmx',
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

/**
 * The Web Crypto API rather than `node:crypto`: this package is imported by client
 * components (channel labels, formats, domain types), and a bare `node:` specifier
 * fails the browser bundle for every one of them. `globalThis.crypto` is present in
 * Node 18+, Workers and browsers alike.
 */
function randomHex(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID().replace(/-/g, '');
  }
  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function newId(kind: IdKind): string {
  return `${ID_PREFIXES[kind]}_${randomHex().slice(0, 24)}`;
}

export function isId(kind: IdKind, value: string): boolean {
  return value.startsWith(`${ID_PREFIXES[kind]}_`);
}
