/**
 * Angles are the reason a batch of ten posts is not the same post ten times.
 * Each one asks a different question of the same brand facts.
 */
export const ANGLES = [
  'problem',
  'benefit',
  'objection',
  'proof',
  'how_it_works',
  'myth',
  'checklist',
  'question',
  'offer',
  'comparison',
] as const;

export type Angle = (typeof ANGLES)[number];

export const ANGLE_LABELS: Record<Angle, string> = {
  problem: 'Problem awareness',
  benefit: 'Benefit spotlight',
  objection: 'Objection handling',
  proof: 'Customer proof',
  how_it_works: 'How it works',
  myth: 'Myth correction',
  checklist: 'Practical checklist',
  question: 'Audience question',
  offer: 'Offer',
  comparison: 'Before and after',
};

/** Deterministic 32-bit hash so the same brief always produces the same batch. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pick<T>(items: readonly T[], seed: number): T | undefined {
  if (items.length === 0) return undefined;
  return items[seed % items.length];
}

/** Angles ordered for a campaign phase, so a phase reads as one argument. */
export const PHASE_ANGLES: Record<string, Angle[]> = {
  problem_awareness: ['problem', 'question', 'myth'],
  education: ['how_it_works', 'checklist', 'benefit'],
  solution: ['benefit', 'comparison', 'how_it_works'],
  proof: ['proof', 'objection', 'comparison'],
  conversion: ['offer', 'objection', 'benefit'],
};
