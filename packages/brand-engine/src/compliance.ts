import type { BrandRules } from '@morrowlane/shared';

/**
 * Some industries carry claim rules that are not optional. Detecting the category from
 * the site and pre-loading the prohibited language means a credit brand cannot publish
 * "guaranteed approval" on day one, before anyone has configured anything.
 * These are conservative defaults, not legal advice, and the brand can edit them.
 */
export interface CompliancePreset {
  id: string;
  label: string;
  match: RegExp;
  prohibitedTerminology: string[];
  prohibitedClaims: string[];
  regulatoryNotes: string[];
}

export const COMPLIANCE_PRESETS: CompliancePreset[] = [
  {
    id: 'consumer_finance',
    label: 'Consumer finance and credit',
    match: /\b(credit score|credit building|credit builder|credit repair|loan|lending|apr\b|fico|bureau|debt|mortgage|refinanc)/i,
    prohibitedTerminology: ['guaranteed', 'risk-free', 'instant approval'],
    prohibitedClaims: [
      'guaranteed approval',
      'guaranteed results',
      'remove accurate negative information',
      'erase bad credit',
      'raise your score by',
      'no credit check required for approval',
    ],
    regulatoryNotes: [
      'Do not promise a specific score increase or a specific timeframe for one.',
      'Do not describe a savings or builder product as a loan unless it is one.',
      'Results language must be qualified: outcomes depend on the individual credit file.',
    ],
  },
  {
    id: 'health',
    label: 'Health and wellness',
    match: /\b(supplement|wellness|clinical|patient|treatment|therapy|diagnos|nutrition|weight loss)/i,
    prohibitedTerminology: ['cure', 'miracle'],
    prohibitedClaims: ['cures', 'treats disease', 'guaranteed weight loss', 'clinically proven to cure'],
    regulatoryNotes: [
      'Do not claim to diagnose, treat, cure or prevent any disease.',
      'Any outcome shown must be described as an individual result.',
    ],
  },
  {
    id: 'legal',
    label: 'Legal services',
    match: /\b(attorney|law firm|lawyer|litigation|counsel|legal services)\b/i,
    prohibitedTerminology: ['guaranteed'],
    prohibitedClaims: ['guaranteed outcome', 'we always win', 'best lawyer'],
    regulatoryNotes: [
      'Do not guarantee case outcomes.',
      'Past results do not predict future outcomes and must be labelled as such.',
    ],
  },
  {
    id: 'real_estate',
    label: 'Real estate and mortgage',
    match: /\b(realtor|real estate|listing|mortgage|escrow|homebuyer|brokerage)\b/i,
    prohibitedTerminology: [],
    prohibitedClaims: ['guaranteed rate', 'guaranteed approval'],
    regulatoryNotes: [
      'Advertising must not express a preference based on any protected class.',
      'Rate and payment figures require the accompanying disclosures.',
    ],
  },
];

export function detectCompliancePresets(corpus: string): CompliancePreset[] {
  return COMPLIANCE_PRESETS.filter((preset) => preset.match.test(corpus));
}

export function applyCompliancePresets(rules: BrandRules, presets: CompliancePreset[]): BrandRules {
  const merge = (existing: string[], additions: string[]) => [
    ...new Set([...existing, ...additions].map((v) => v.trim()).filter(Boolean)),
  ];

  return {
    ...rules,
    prohibitedTerminology: merge(rules.prohibitedTerminology, presets.flatMap((p) => p.prohibitedTerminology)),
    prohibitedClaims: merge(rules.prohibitedClaims, presets.flatMap((p) => p.prohibitedClaims)),
    regulatoryNotes: merge(rules.regulatoryNotes, presets.flatMap((p) => p.regulatoryNotes)),
  };
}
