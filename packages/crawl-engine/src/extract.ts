import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { ExtractedFaq, ExtractedImage, ExtractedTestimonial } from '@morrowlane/shared';
import { collapseWhitespace, isSameSite, resolveUrl, truncate } from '@morrowlane/shared';

export interface ExtractedPage {
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  language: string | null;
  headings: string[];
  text: string;
  images: ExtractedImage[];
  internalLinks: string[];
  externalLinks: string[];
  socialLinks: string[];
  faqs: ExtractedFaq[];
  testimonials: ExtractedTestimonial[];
  ctas: string[];
  prices: string[];
  colors: string[];
  structuredData: unknown[];
  structuredDataTypes: string[];
  publishedAt: string | null;
  openGraphImage: string | null;
}

const SOCIAL_HOSTS =
  /(instagram\.com|facebook\.com|fb\.com|tiktok\.com|linkedin\.com|twitter\.com|x\.com|threads\.net|youtube\.com|youtu\.be|pinterest\.|bsky\.app|business\.google\.com|g\.page)/i;

const CTA_PATTERN =
  /^(get started|start (free|now|today)|sign up|book( a)? (demo|call)|request( a)? (demo|quote)|contact (us|sales)|learn more|try (it )?free|apply now|shop now|buy now|subscribe|download|join( now)?|see plans|get( a)? quote|schedule.*)$/i;

const PRICE_PATTERN = /(?:[$£€]\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP)\b)(?:\s?\/\s?(?:mo|month|yr|year|user))?/gi;

const HEX_COLOR_PATTERN = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi;

/** Elements whose text is chrome, not content. */
const NOISE_SELECTOR = 'script, style, noscript, template, svg, iframe, nav, header, footer, form';

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const structuredData = readStructuredData($);
  const structuredDataTypes = collectSchemaTypes(structuredData);

  const canonical = $('link[rel="canonical"]').attr('href');
  const language = $('html').attr('lang')?.split('-')[0] ?? null;

  const headings: string[] = [];
  $('h1, h2, h3').each((_, element) => {
    const text = collapseWhitespace($(element).text());
    if (text && text.length <= 200) headings.push(text);
  });

  const body = $.root().clone();
  body.find(NOISE_SELECTOR).remove();
  const text = collapseWhitespace(body.find('body').text() || body.text());

  const { internalLinks, externalLinks, socialLinks, ctas } = readLinks($, pageUrl);

  return {
    title: collapseWhitespace($('title').first().text()) || $('meta[property="og:title"]').attr('content') || null,
    metaDescription:
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      null,
    canonicalUrl: canonical ? resolveUrl(pageUrl, canonical) : null,
    language,
    headings: headings.slice(0, 60),
    text: text.slice(0, 60_000),
    images: readImages($, pageUrl),
    internalLinks,
    externalLinks,
    socialLinks,
    faqs: readFaqs($, structuredData),
    testimonials: readTestimonials($),
    ctas,
    prices: readPrices(text),
    colors: readColors(html),
    structuredData,
    structuredDataTypes,
    publishedAt: readPublishedAt($, structuredData),
    openGraphImage: resolveMaybe(pageUrl, $('meta[property="og:image"]').attr('content')),
  };
}

function resolveMaybe(base: string, href: string | undefined): string | null {
  return href ? resolveUrl(base, href) : null;
}

function readStructuredData($: CheerioAPI): unknown[] {
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // Malformed JSON-LD is extremely common; skipping it is the right call.
    }
  });
  return blocks.slice(0, 40);
}

function collectSchemaTypes(blocks: unknown[]): string[] {
  const types = new Set<string>();
  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    const rawType = record['@type'];
    if (typeof rawType === 'string') types.add(rawType);
    else if (Array.isArray(rawType)) for (const t of rawType) if (typeof t === 'string') types.add(t);
    for (const value of Object.values(record)) visit(value, depth + 1);
  };
  visit(blocks, 0);
  return [...types];
}

function readImages($: CheerioAPI, pageUrl: string): ExtractedImage[] {
  const seen = new Set<string>();
  const images: ExtractedImage[] = [];

  const push = (src: string | undefined, alt: string | null, role: ExtractedImage['role']) => {
    const url = resolveMaybe(pageUrl, src);
    if (!url || seen.has(url)) return;
    if (/\.(svg)(\?|$)/i.test(url) && role !== 'logo') return;
    seen.add(url);
    images.push({ url, alt, role });
  };

  $('img').each((_, element) => {
    const el = $(element);
    const src = el.attr('src') ?? el.attr('data-src') ?? el.attr('data-lazy-src');
    const alt = el.attr('alt')?.trim() || null;
    const hint = `${el.attr('class') ?? ''} ${el.attr('id') ?? ''} ${alt ?? ''} ${src ?? ''}`;
    const inHeader = el.parents('header, nav').length > 0;
    let role: ExtractedImage['role'] = 'content';
    if (/logo|brandmark|wordmark/i.test(hint) || (inHeader && /logo/i.test(hint))) role = 'logo';
    else if (/hero|banner|masthead|cover/i.test(hint)) role = 'hero';
    else if (/icon|badge|sprite|avatar/i.test(hint)) role = 'icon';
    push(src, alt, role);
  });

  push($('link[rel~="icon"]').first().attr('href'), 'favicon', 'icon');

  return images.slice(0, 80);
}

function readLinks($: CheerioAPI, pageUrl: string) {
  const internal = new Set<string>();
  const external = new Set<string>();
  const social = new Set<string>();
  const ctas = new Set<string>();

  $('a[href]').each((_, element) => {
    const el = $(element);
    const href = el.attr('href');
    if (!href || href.startsWith('#')) return;
    const url = resolveUrl(pageUrl, href);
    if (!url) return;

    if (SOCIAL_HOSTS.test(url) && !isSameSite(url, pageUrl)) social.add(url);
    else if (isSameSite(url, pageUrl)) internal.add(url);
    else external.add(url);

    const label = collapseWhitespace(el.text());
    if (label && label.length <= 40 && CTA_PATTERN.test(label)) ctas.add(label);
  });

  $('button').each((_, element) => {
    const label = collapseWhitespace($(element).text());
    if (label && label.length <= 40 && CTA_PATTERN.test(label)) ctas.add(label);
  });

  return {
    internalLinks: [...internal].slice(0, 400),
    externalLinks: [...external].slice(0, 100),
    socialLinks: [...social].slice(0, 30),
    ctas: [...ctas].slice(0, 20),
  };
}

function readFaqs($: CheerioAPI, structuredData: unknown[]): ExtractedFaq[] {
  const faqs: ExtractedFaq[] = [];

  // Schema.org FAQPage is the highest-fidelity source when it exists.
  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record['@type'] === 'Question' && typeof record['name'] === 'string') {
      const accepted = record['acceptedAnswer'];
      const answerText =
        accepted && typeof accepted === 'object' && 'text' in (accepted as Record<string, unknown>)
          ? String((accepted as Record<string, unknown>)['text'])
          : null;
      if (answerText) {
        faqs.push({
          question: collapseWhitespace(record['name']),
          answer: truncate(cheerio.load(answerText).text(), 900),
        });
      }
    }
    for (const value of Object.values(record)) visit(value, depth + 1);
  };
  visit(structuredData, 0);

  if (faqs.length === 0) {
    // Fall back to accordion markup and question-shaped headings.
    $('details').each((_, element) => {
      const el = $(element);
      const question = collapseWhitespace(el.find('summary').first().text());
      const clone = el.clone();
      clone.find('summary').remove();
      const answer = collapseWhitespace(clone.text());
      if (question && answer) faqs.push({ question, answer: truncate(answer, 900) });
    });

    $('h2, h3, h4').each((_, element) => {
      const question = collapseWhitespace($(element).text());
      if (!question.endsWith('?') || question.length > 180) return;
      const answer = collapseWhitespace($(element).nextAll('p').first().text());
      if (answer) faqs.push({ question, answer: truncate(answer, 900) });
    });
  }

  const seen = new Set<string>();
  return faqs.filter((faq) => !seen.has(faq.question) && seen.add(faq.question)).slice(0, 40);
}

function readTestimonials($: CheerioAPI): ExtractedTestimonial[] {
  const testimonials: ExtractedTestimonial[] = [];
  const seen = new Set<string>();

  const push = (quote: string, attribution: string | null) => {
    const cleaned = collapseWhitespace(quote).replace(/^[“"']|[”"']$/g, '');
    // Real testimonials are sentences, not labels or paragraphs of body copy.
    if (cleaned.length < 40 || cleaned.length > 600 || seen.has(cleaned)) return;
    seen.add(cleaned);
    testimonials.push({ quote: cleaned, attribution: attribution ? collapseWhitespace(attribution) : null });
  };

  $('blockquote').each((_, element) => {
    const el = $(element);
    const cite = el.find('cite, footer').first().text() || el.next('cite, figcaption').text();
    const clone = el.clone();
    clone.find('cite, footer').remove();
    push(clone.text(), cite || null);
  });

  $('[class*="testimonial" i], [class*="review" i], [class*="quote" i]').each((_, element) => {
    const el = $(element);
    if (el.find('[class*="testimonial" i], [class*="review" i]').length > 0) return;
    const cite = el.find('[class*="author" i], [class*="name" i], cite').first().text();
    push(el.text(), cite || null);
  });

  return testimonials.slice(0, 30);
}

function readPrices(text: string): string[] {
  const matches = text.match(PRICE_PATTERN) ?? [];
  const seen = new Set<string>();
  return matches
    .map((m) => collapseWhitespace(m))
    .filter((m) => !seen.has(m) && seen.add(m))
    .slice(0, 25);
}

function readColors(html: string): string[] {
  const counts = new Map<string, number>();
  for (const raw of html.match(HEX_COLOR_PATTERN) ?? []) {
    const hex = expandHex(raw.toLowerCase());
    // Near-black, near-white and greys are page furniture, not brand colors.
    if (isNeutral(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => hex);
}

function expandHex(hex: string): string {
  if (hex.length === 4) return `#${hex[1]!}${hex[1]!}${hex[2]!}${hex[2]!}${hex[3]!}${hex[3]!}`;
  return hex;
}

function isNeutral(hex: string): boolean {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  // Near-black and near-white read as background and text, not as a brand accent,
  // even when technically saturated (Tailwind's #111827 is a saturated navy-grey).
  return saturation < 0.15 || max < 56 || min > 236;
}

function readPublishedAt($: CheerioAPI, structuredData: unknown[]): string | null {
  const meta =
    $('meta[property="article:published_time"]').attr('content') ??
    $('meta[itemprop="datePublished"]').attr('content') ??
    $('time[datetime]').first().attr('datetime');
  if (meta) {
    const parsed = new Date(meta);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  let found: string | null = null;
  const visit = (node: unknown, depth: number) => {
    if (found || depth > 6 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    const value = record['datePublished'];
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        found = parsed.toISOString();
        return;
      }
    }
    for (const child of Object.values(record)) visit(child, depth + 1);
  };
  visit(structuredData, 0);
  return found;
}
