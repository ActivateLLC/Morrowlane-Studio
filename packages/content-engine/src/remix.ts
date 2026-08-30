import type { BrandBrain, ContentFormat, ContentItem, CrawledPage } from '@morrowlane/shared';
import { truncate } from '@morrowlane/shared';
import type { AiGateway } from './gateway/index.js';
import { generateContent } from './generate.js';

export interface RemixRecipeItem {
  format: ContentFormat;
  count: number;
  label: string;
}

/**
 * The distribution tree from the spec: one source page becomes a full campaign's
 * worth of assets. The default recipe is what the Remix screen offers before the
 * user edits it.
 */
export const DEFAULT_REMIX_RECIPE: RemixRecipeItem[] = [
  { format: 'instagram_post', count: 10, label: '10 social posts' },
  { format: 'instagram_carousel', count: 3, label: '3 carousels' },
  { format: 'short_video', count: 5, label: '5 short-video scripts' },
  { format: 'blog_article', count: 1, label: '1 blog post' },
  { format: 'promotional_email', count: 1, label: '1 email campaign' },
  { format: 'educational_graphic', count: 5, label: '5 image concepts' },
];

export interface RemixRequest {
  brain: BrandBrain;
  page: CrawledPage;
  recipe?: RemixRecipeItem[];
  instruction?: string | null;
}

export interface RemixResult {
  items: ContentItem[];
  /** Per-format outcome so the UI can show partial success honestly. */
  breakdown: Array<{ format: ContentFormat; requested: number; produced: number; error: string | null }>;
}

export async function remixUrl(gateway: AiGateway, request: RemixRequest): Promise<RemixResult> {
  const recipe = request.recipe ?? DEFAULT_REMIX_RECIPE;
  const excerpt = buildExcerpt(request.page);
  const topic = request.page.title ?? request.page.headings[0] ?? null;

  const items: ContentItem[] = [];
  const breakdown: RemixResult['breakdown'] = [];

  // Sequential rather than parallel: a remix is a burst of large generations and
  // fanning them all out at once is the fastest way to hit a provider rate limit.
  for (const step of recipe) {
    try {
      const result = await generateContent(gateway, {
        brain: request.brain,
        format: step.format,
        count: step.count,
        instruction: request.instruction ?? null,
        topic,
        sourceUrl: request.page.url,
        sourceExcerpt: excerpt,
        lineage: {
          sourceType: 'remix',
          sourceUrl: request.page.url,
          sourceId: request.page.id,
          instruction: request.instruction ?? null,
        },
      });
      items.push(...result.items);
      breakdown.push({ format: step.format, requested: step.count, produced: result.items.length, error: null });
    } catch (error) {
      breakdown.push({
        format: step.format,
        requested: step.count,
        produced: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { items, breakdown };
}

/** Feeds the generator the page's actual argument, not its navigation chrome. */
function buildExcerpt(page: CrawledPage): string {
  const parts = [
    page.title ? `Title: ${page.title}` : '',
    page.metaDescription ? `Summary: ${page.metaDescription}` : '',
    page.headings.length > 0 ? `Sections: ${page.headings.slice(0, 12).join(' | ')}` : '',
    page.prices.length > 0 ? `Prices on the page: ${page.prices.slice(0, 6).join(', ')}` : '',
    page.ctas.length > 0 ? `Calls to action: ${page.ctas.join(', ')}` : '',
    page.faqs.length > 0
      ? `FAQs: ${page.faqs.slice(0, 4).map((f) => `${f.question} — ${truncate(f.answer, 200)}`).join(' | ')}`
      : '',
    page.testimonials.length > 0
      ? `Testimonials: ${page.testimonials.slice(0, 3).map((t) => `"${truncate(t.quote, 160)}"`).join(' | ')}`
      : '',
    `Body: ${truncate(page.text, 4000)}`,
  ];
  return parts.filter(Boolean).join('\n');
}
