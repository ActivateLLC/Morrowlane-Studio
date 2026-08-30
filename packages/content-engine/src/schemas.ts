import { z } from 'zod';

/** Shape the model must return for one asset. Kept flat so recovery is easy. */
export const generatedSegmentSchema = z.object({
  heading: z.string().nullable().default(null),
  body: z.string().min(1),
  visualDirection: z.string().nullable().default(null),
});

export const generatedAssetSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  body: z.string().min(1),
  segments: z.array(generatedSegmentSchema).default([]),
  hashtags: z.array(z.string()).default([]),
  cta: z.string().nullable().default(null),
  topics: z.array(z.string()).default([]),
});

export const generatedAssetsSchema = z.object({
  assets: z.array(generatedAssetSchema).min(1),
});

export type GeneratedSegment = z.infer<typeof generatedSegmentSchema>;
export type GeneratedAsset = z.infer<typeof generatedAssetSchema>;

export const brandBrainDraftSchema = z.object({
  identity: z.object({
    companyName: z.string().min(1),
    category: z.string().default(''),
    oneLiner: z.string().default(''),
    description: z.string().default(''),
    audience: z.array(z.string()).default([]),
    industries: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
  }),
  voice: z.object({
    traits: z.array(z.string()).default([]),
    readingLevel: z.number().min(1).max(5).default(3),
    personSummary: z.string().default(''),
    sampleSentences: z.array(z.string()).default([]),
    avoid: z.array(z.string()).default([]),
  }),
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.enum(['product', 'service']).default('product'),
        description: z.string().default(''),
        benefits: z.array(z.string()).default([]),
        audience: z.array(z.string()).default([]),
        priceHint: z.string().nullable().default(null),
        sourceUrls: z.array(z.string()).default([]),
        imageUrls: z.array(z.string()).default([]),
        claims: z.array(z.string()).default([]),
        ctas: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  offers: z.array(z.string()).default([]),
  terminology: z.array(z.string()).default([]),
  rules: z
    .object({
      approvedTerminology: z.array(z.string()).default([]),
      prohibitedTerminology: z.array(z.string()).default([]),
      approvedClaims: z.array(z.string()).default([]),
      prohibitedClaims: z.array(z.string()).default([]),
      regulatoryNotes: z.array(z.string()).default([]),
      preferredCtas: z.array(z.string()).default([]),
      visualGuidelines: z.array(z.string()).default([]),
    })
    .default({}),
  notes: z.array(z.string()).default([]),
});

export type BrandBrainDraft = z.infer<typeof brandBrainDraftSchema>;

export const campaignPlanSchema = z.object({
  name: z.string().min(1),
  narrative: z.string().min(1),
  phases: z
    .array(
      z.object({
        kind: z.enum(['problem_awareness', 'education', 'solution', 'proof', 'conversion']),
        title: z.string().min(1),
        narrative: z.string().min(1),
        postCount: z.number().int().min(0),
      }),
    )
    .min(1),
});

export type CampaignPlan = z.infer<typeof campaignPlanSchema>;

export const studioIntentSchema = z.object({
  action: z.enum(['generate_content', 'remix_url', 'plan_campaign', 'fill_calendar']),
  formats: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  count: z.number().int().min(1).max(120).default(5),
  durationDays: z.number().int().min(1).max(90).nullable().default(null),
  url: z.string().nullable().default(null),
  productHint: z.string().nullable().default(null),
  topic: z.string().nullable().default(null),
  goal: z.string().nullable().default(null),
});

export type StudioIntent = z.infer<typeof studioIntentSchema>;
