import { randomUUID } from 'node:crypto';

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

export function newId(kind: IdKind): string {
  return `${ID_PREFIXES[kind]}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

export function isId(kind: IdKind, value: string): boolean {
  return value.startsWith(`${ID_PREFIXES[kind]}_`);
}
