import { collapseWhitespace, keywords, slugify, truncate } from '@morrowlane/shared';
import type { GeneratedAsset, GeneratedSegment } from '../schemas.js';
import { ANGLE_LABELS, ANGLES, PHASE_ANGLES, hashString, pick, type Angle } from './angles.js';
import { readBrief, type BriefView } from './brief.js';

/**
 * Deterministic content composition from brand facts. This is what runs when no
 * model provider is configured: it will never write like a great copywriter, but
 * every sentence is traceable to something the crawler actually found, which makes
 * it the right thing to test against and a usable demo out of the box.
 */
export function composeContent(brief: Record<string, unknown>): { assets: GeneratedAsset[] } {
  const view = readBrief(brief);
  const { request } = view;
  const seedBase = hashString(
    [request.format, request.channel, request.instruction ?? '', request.topic ?? '', request.sourceUrl ?? '', view.company].join('|'),
  );

  const angles = anglesFor(view, request.count, seedBase);
  const assets = angles.map((angle, index) => composeAsset(view, angle, seedBase + index * 7919));

  return { assets };
}

function anglesFor(view: BriefView, count: number, seed: number): Angle[] {
  const phaseKind = view.request.phase?.title ? phaseKindFromTitle(view.request.phase.title) : null;
  const pool = phaseKind && PHASE_ANGLES[phaseKind] ? PHASE_ANGLES[phaseKind]! : [...ANGLES];

  // Filter out angles we have no material for, then rotate so a batch stays varied.
  const usable = pool.filter((angle) => hasMaterial(view, angle));
  const source = usable.length > 0 ? usable : ['benefit' as Angle];
  const offset = seed % source.length;
  return Array.from({ length: count }, (_, i) => source[(offset + i) % source.length]!);
}

function phaseKindFromTitle(title: string): string | null {
  const normalized = title.toLowerCase();
  if (normalized.includes('problem') || normalized.includes('awareness')) return 'problem_awareness';
  if (normalized.includes('educat')) return 'education';
  if (normalized.includes('solution')) return 'solution';
  if (normalized.includes('proof')) return 'proof';
  if (normalized.includes('conver')) return 'conversion';
  return null;
}

function hasMaterial(view: BriefView, angle: Angle): boolean {
  switch (angle) {
    case 'proof':
      return view.testimonials.length > 0;
    case 'objection':
    case 'question':
    case 'myth':
      return view.faqs.length > 0;
    case 'offer':
      return view.offers.length > 0 || Boolean(view.product?.priceHint);
    case 'benefit':
    case 'checklist':
    case 'comparison':
      return (view.product?.benefits.length ?? 0) > 0;
    case 'how_it_works':
      return Boolean(view.product?.description) || Boolean(view.description);
    case 'problem':
      return true;
  }
}

interface Composed {
  title: string;
  hook: string;
  paragraphs: string[];
  topics: string[];
  visualIdea: string;
}

function composeAsset(view: BriefView, angle: Angle, seed: number): GeneratedAsset {
  const core = composeCore(view, angle, seed);
  const { request } = view;

  const cta = chooseCta(view, angle, seed);
  const link = request.linkAllowedInBody ? (request.sourceUrl ?? view.product?.url ?? null) : null;

  const bodyParts = [core.hook, ...core.paragraphs];
  if (cta) bodyParts.push(link ? `${cta} → ${link}` : cta);

  let body = bodyParts.join('\n\n');
  const hashtags = buildHashtags(view, core.topics, request.maxHashtags);

  // Trim to the channel ceiling rather than emitting content that cannot publish.
  if (request.maxCharacters !== null) {
    const budget = request.maxCharacters - hashtagLength(hashtags) - 2;
    if (body.length > budget) body = fitToBudget(bodyParts, budget);
  }

  return {
    title: core.title,
    hook: core.hook,
    body,
    segments: buildSegments(view, core, angle, seed),
    hashtags,
    cta,
    topics: core.topics,
  };
}

function composeCore(view: BriefView, angle: Angle, seed: number): Composed {
  const product = view.product;
  const productName = product?.name ?? view.company;
  const audience = pick(view.audience, seed) ?? 'people like your customers';
  const benefit = pick(product?.benefits ?? [], seed);
  const faq = pick(view.faqs, seed);
  const testimonial = pick(view.testimonials, seed);
  const offer = pick(view.offers, seed) ?? product?.priceHint ?? null;
  const topicSeed = view.request.topic ?? view.request.sourceExcerpt ?? view.description;
  const topics = uniq([
    ...(view.request.topic ? [view.request.topic] : []),
    ...keywords(`${topicSeed} ${product?.description ?? ''}`, 4),
  ]).slice(0, 5);

  switch (angle) {
    case 'problem':
      return {
        title: `${productName}: the problem worth naming`,
        hook: `Most ${audience} do not fail at this because they are careless. They fail because nobody explained the rules.`,
        paragraphs: [
          view.oneLiner || view.description
            ? truncate(view.oneLiner || view.description, 300)
            : `${view.company} works in ${view.category || 'this space'} every day.`,
          `That is the gap ${productName} was built to close.`,
        ],
        topics,
        visualIdea: `A plain statement of the problem in large type, on the brand's primary colour.`,
      };

    case 'benefit':
      return {
        title: `${productName} — ${truncate(benefit ?? 'what it gives you', 60)}`,
        hook: benefit ? `${capitalize(benefit)}.` : `Here is what ${productName} actually does for you.`,
        paragraphs: [
          truncate(product?.description || view.description, 320),
          benefit ? `That is not a feature list item. It is the reason ${audience} stay.` : `Built for ${audience}.`,
        ],
        topics,
        visualIdea: `The benefit as a single line of type over a product photograph.`,
      };

    case 'objection':
      return {
        // Framed as the hesitation, not as the question itself, so it stays distinct
        // from the 'question' angle when both draw on the same FAQ.
        title: faq ? `Before you decide: ${truncate(faq.question, 60)}` : `Answering the question we hear most`,
        hook: faq
          ? `The thing people want settled before they sign up: ${faq.question}`
          : `There is one hesitation we hear more than any other.`,
        paragraphs: [faq ? truncate(faq.answer, 420) : truncate(product?.description || view.description, 320)],
        topics,
        visualIdea: `Question on the first frame, answer on the second.`,
      };

    case 'proof':
      return {
        title: `What ${audience} say about ${productName}`,
        hook: testimonial ? `"${truncate(testimonial.quote, 180)}"` : `Real results, in their words.`,
        paragraphs: [
          testimonial?.attribution ? `— ${testimonial.attribution}` : `— a ${productName} customer`,
          benefit ? `${capitalize(benefit)}. That is what makes the difference.` : truncate(product?.description || view.description, 260),
        ],
        topics,
        visualIdea: `Pull quote in large type with the attribution beneath it.`,
      };

    case 'how_it_works':
      return {
        title: `How ${productName} works`,
        hook: `How ${productName} works, in plain language:`,
        paragraphs: [
          truncate(product?.description || view.description, 400),
          ...(product?.benefits.slice(0, 3).map((b, i) => `${i + 1}. ${capitalize(b)}`) ?? []),
        ],
        topics,
        visualIdea: `Numbered steps, one per slide, minimal type.`,
      };

    case 'myth':
      return {
        title: faq ? `Myth: ${truncate(faq.question.replace(/\?$/, ''), 60)}` : `A myth worth correcting`,
        hook: faq ? `A lot of ${audience} believe this. It is not true.` : `Here is a myth that costs people money.`,
        paragraphs: [faq ? `The question: ${faq.question}` : '', faq ? truncate(faq.answer, 380) : truncate(view.description, 320)].filter(Boolean),
        topics,
        visualIdea: `"Myth" struck through, "fact" underneath.`,
      };

    case 'checklist':
      return {
        title: `${productName}: what to check`,
        hook: `A short checklist before you decide on ${view.category || productName}:`,
        paragraphs: (product?.benefits.slice(0, 5) ?? [view.description]).map((b) => `• ${capitalize(truncate(b, 120))}`),
        topics,
        visualIdea: `Checklist with ticks appearing one line at a time.`,
      };

    case 'question':
      return {
        title: faq ? truncate(faq.question, 70) : `A question for ${audience}`,
        hook: faq ? faq.question : `Quick question for ${audience}:`,
        paragraphs: [
          faq ? truncate(faq.answer, 360) : truncate(view.description, 320),
          `Tell us where you are with this — we answer every reply.`,
        ],
        topics,
        visualIdea: `The question alone, centred, high contrast.`,
      };

    case 'offer':
      return {
        title: `${productName}${offer ? ` — ${truncate(offer, 40)}` : ''}`,
        hook: offer ? `${capitalize(truncate(offer, 120))}.` : `${productName} is open for new customers.`,
        paragraphs: [
          truncate(product?.description || view.description, 300),
          benefit ? `What you get: ${benefit}.` : '',
        ].filter(Boolean),
        topics,
        visualIdea: `Offer terms in large type with the product in frame.`,
      };

    case 'comparison':
      return {
        title: `Before and after ${productName}`,
        hook: `Before: guesswork. After: ${truncate(benefit ?? 'a plan you can follow', 80)}.`,
        paragraphs: [
          `Most ${audience} start out without a clear picture of where they stand.`,
          truncate(product?.description || view.description, 300),
        ],
        topics,
        visualIdea: `Split frame, before on the left and after on the right.`,
      };
  }
}

function buildSegments(view: BriefView, core: Composed, angle: Angle, seed: number): GeneratedSegment[] {
  const count = view.request.segments;
  if (count <= 1) return [];

  const material = [core.hook, ...core.paragraphs];
  const product = view.product;

  // Pad from real brand material rather than repeating, so slide 6 still says something.
  const filler = [
    ...(product?.benefits.map((b) => capitalize(b)) ?? []),
    ...view.faqs.map((f) => `${f.question} ${truncate(f.answer, 160)}`),
    ...view.testimonials.map((t) => `"${truncate(t.quote, 140)}"`),
    ...view.offers,
  ];

  const segments: GeneratedSegment[] = [];
  for (let i = 0; i < count; i += 1) {
    const body = material[i] ?? pick(filler, seed + i * 31) ?? truncate(view.description, 200);
    segments.push({
      heading: i === 0 ? core.title : `${ANGLE_LABELS[angle]} ${i + 1}`,
      body: collapseWhitespace(body),
      visualDirection: core.visualIdea,
    });
  }

  // The last slide of a carousel and the last beat of a script always convert.
  const last = segments[segments.length - 1]!;
  const cta = chooseCta(view, angle, seed);
  if (cta) {
    last.body = `${last.body}\n\n${cta}`;
    last.heading = 'Next step';
  }

  return segments;
}

function chooseCta(view: BriefView, angle: Angle, seed: number): string | null {
  if (view.preferredCtas.length > 0) {
    // Conversion-shaped angles get the strongest CTA the brand actually uses.
    if (angle === 'offer' || angle === 'proof') return view.preferredCtas[0]!;
    return pick(view.preferredCtas, seed) ?? view.preferredCtas[0]!;
  }
  return null;
}

function buildHashtags(view: BriefView, topics: string[], max: number): string[] {
  if (max <= 0) return [];
  const candidates = uniq([
    ...topics,
    ...view.approvedTerminology.slice(0, 4),
    view.category,
    view.company,
  ])
    .filter(Boolean)
    .map((value) => slugify(value).replace(/-/g, ''))
    .filter((value) => value.length >= 3 && value.length <= 24);
  return uniq(candidates).slice(0, max).map((value) => `#${value}`);
}

function hashtagLength(hashtags: string[]): number {
  return hashtags.length === 0 ? 0 : hashtags.join(' ').length;
}

/** Drops whole trailing paragraphs before it resorts to cutting a sentence. */
function fitToBudget(parts: string[], budget: number): string {
  const kept: string[] = [];
  let length = 0;
  for (const part of parts) {
    const addition = kept.length === 0 ? part.length : part.length + 2;
    if (length + addition > budget) break;
    kept.push(part);
    length += addition;
  }
  if (kept.length === 0) return truncate(parts[0] ?? '', Math.max(1, budget));
  return kept.join('\n\n');
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed[0]!.toUpperCase() + trimmed.slice(1) : trimmed;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}
