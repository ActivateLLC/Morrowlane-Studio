import type {
  BrandProduct,
  BrandVisuals,
  CrawledPage,
  ExtractedFaq,
  ExtractedTestimonial,
} from '@morrowlane/shared';
import { collapseWhitespace, newId, registrableHost, titleCase, truncate } from '@morrowlane/shared';

/**
 * Deterministic facts pulled straight out of the crawl. Nothing here is inferred by a
 * model — these are the things we can point at a page and prove, and they become the
 * grounding the model is not allowed to contradict.
 */
export interface BrandSignals {
  companyName: string;
  oneLiner: string;
  description: string;
  products: BrandProduct[];
  offers: string[];
  faqs: ExtractedFaq[];
  testimonials: ExtractedTestimonial[];
  visuals: BrandVisuals;
  ctas: string[];
  socialLinks: string[];
  terminology: string[];
  articleUrls: string[];
  locations: string[];
}

export function extractSignals(pages: CrawledPage[], websiteUrl: string, siteColors: string[]): BrandSignals {
  const home = pages.find((p) => p.pageType === 'homepage') ?? pages[0];
  const organization = readOrganizationSchema(pages);

  const companyName =
    organization?.name ??
    cleanCompanyName(home?.title ?? '') ??
    titleCase(registrableHost(websiteUrl)?.split('.')[0] ?? 'Your brand');

  const description =
    organization?.description ??
    home?.metaDescription ??
    truncate(home?.text ?? '', 600);

  return {
    companyName,
    oneLiner: home?.headings[0] ?? home?.metaDescription ?? truncate(description, 140),
    description: truncate(description, 900),
    products: extractProducts(pages),
    offers: extractOffers(pages),
    faqs: dedupeFaqs(pages.flatMap((p) => p.faqs)),
    testimonials: dedupeTestimonials(pages.flatMap((p) => p.testimonials)),
    visuals: extractVisuals(pages, siteColors),
    ctas: rankCtas(pages),
    socialLinks: [...new Set(pages.flatMap((p) => p.socialLinks))],
    terminology: extractTerminology(pages),
    articleUrls: pages.filter((p) => p.pageType === 'article').map((p) => p.url),
    locations: extractLocations(pages, organization),
  };
}

interface OrganizationSchema {
  name?: string;
  description?: string;
  address?: unknown;
}

function readOrganizationSchema(pages: CrawledPage[]): OrganizationSchema | null {
  for (const page of pages) {
    for (const block of page.structuredData) {
      const record = asRecord(block);
      if (!record) continue;
      const type = String(record['@type'] ?? '');
      if (!/^(Organization|Corporation|LocalBusiness|OnlineBusiness|FinancialService)$/i.test(type)) continue;
      return {
        name: typeof record['name'] === 'string' ? record['name'] : undefined,
        description: typeof record['description'] === 'string' ? record['description'] : undefined,
        address: record['address'],
      };
    }
  }
  return null;
}

/** "Orca Credit — Build credit without the guesswork" is a title, not a company name. */
function cleanCompanyName(title: string): string | null {
  const parts = title.split(/\s+[—–|·-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // Titles usually put the brand on whichever side is shorter.
  const candidate = parts.length === 1 ? parts[0]! : parts.reduce((a, b) => (a.length <= b.length ? a : b));
  return candidate.length <= 60 ? candidate : null;
}

function extractProducts(pages: CrawledPage[]): BrandProduct[] {
  const productPages = pages.filter((p) => p.pageType === 'product' || p.pageType === 'service');

  return productPages.map((page): BrandProduct => {
    const schema = readProductSchema(page);
    const name = schema?.name ?? page.headings[0] ?? cleanCompanyName(page.title ?? '') ?? 'Untitled';
    const benefits = extractBenefits(page);

    return {
      id: newId('product'),
      name: collapseWhitespace(name),
      kind: page.pageType === 'service' ? 'service' : 'product',
      description: truncate(schema?.description ?? page.metaDescription ?? page.text, 600),
      benefits,
      audience: [],
      priceHint: page.prices[0] ?? schema?.price ?? null,
      sourceUrls: [page.url],
      imageUrls: page.images.filter((i) => i.role === 'hero' || i.role === 'content').map((i) => i.url).slice(0, 6),
      // Claims are the sentences the page itself makes; the rule engine screens them later.
      claims: extractClaims(page),
      ctas: page.ctas,
    };
  });
}

interface ProductSchema {
  name?: string;
  description?: string;
  price?: string;
}

function readProductSchema(page: CrawledPage): ProductSchema | null {
  for (const block of page.structuredData) {
    const record = asRecord(block);
    if (!record) continue;
    const type = String(record['@type'] ?? '');
    if (!/^(Product|Service|SoftwareApplication)$/i.test(type)) continue;
    const offers = asRecord(record['offers']);
    const price = offers && typeof offers['price'] === 'string' ? `$${offers['price']}` : undefined;
    return {
      name: typeof record['name'] === 'string' ? record['name'] : undefined,
      description: typeof record['description'] === 'string' ? record['description'] : undefined,
      price,
    };
  }
  return null;
}

/** Benefit lists on marketing pages are almost always bullets under a benefits heading. */
function extractBenefits(page: CrawledPage): string[] {
  const benefits: string[] = [];
  const text = page.text;

  const headingIndex = text.search(/\b(benefits|what you get|why|features|how it helps)\b/i);
  if (headingIndex !== -1) {
    const section = text.slice(headingIndex, headingIndex + 900);
    for (const sentence of section.split(/(?<=[.!?])\s+|\s{2,}/)) {
      const cleaned = collapseWhitespace(sentence).replace(/^[•\-–*]\s*/, '');
      if (cleaned.length >= 15 && cleaned.length <= 160 && !/^(benefits|what you get|features)$/i.test(cleaned)) {
        benefits.push(cleaned);
      }
      if (benefits.length >= 6) break;
    }
  }

  if (benefits.length === 0) {
    for (const heading of page.headings.slice(1, 7)) {
      if (heading.length >= 12 && heading.length <= 120) benefits.push(heading);
    }
  }

  return benefits.slice(0, 6);
}

/** Sentences that assert something about the product — the compliance surface. */
function extractClaims(page: CrawledPage): string[] {
  const claims: string[] = [];
  for (const sentence of page.text.split(/(?<=[.!?])\s+/)) {
    const cleaned = collapseWhitespace(sentence);
    if (cleaned.length < 20 || cleaned.length > 200) continue;
    if (/\b(we|our|it|this)\b.*\b(reports?|helps?|builds?|saves?|guarantees?|improves?|includes?|never|no)\b/i.test(cleaned)) {
      claims.push(cleaned);
    }
    if (claims.length >= 8) break;
  }
  return claims;
}

function extractOffers(pages: CrawledPage[]): string[] {
  const offers = new Set<string>();
  for (const page of pages.filter((p) => p.pageType === 'pricing' || p.pageType === 'landing')) {
    for (const price of page.prices) offers.add(price);
    for (const heading of page.headings.slice(1, 8)) {
      if (/\b(free|trial|off|save|plan|tier|bundle)\b/i.test(heading) && heading.length <= 90) offers.add(heading);
    }
  }
  return [...offers].slice(0, 12);
}

function extractVisuals(pages: CrawledPage[], siteColors: string[]): BrandVisuals {
  const logos = new Set<string>();
  const images = new Set<string>();

  for (const page of pages) {
    for (const image of page.images) {
      if (image.role === 'logo') logos.add(image.url);
      else if (image.role === 'hero' || image.role === 'content') images.add(image.url);
    }
  }

  return {
    logoUrls: [...logos].slice(0, 6),
    colors: siteColors.slice(0, 6),
    imageUrls: [...images].slice(0, 40),
    fontHints: [],
  };
}

/** A CTA repeated across the site is the brand's real CTA; a one-off is a page quirk. */
function rankCtas(pages: CrawledPage[]): string[] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const cta of new Set(page.ctas)) counts.set(cta, (counts.get(cta) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([cta]) => cta);
}

/** Multi-word phrases the site repeats — the words this brand uses for its own things. */
function extractTerminology(pages: CrawledPage[]): string[] {
  const counts = new Map<string, number>();

  for (const page of pages) {
    const phrases = new Set<string>();
    for (const heading of page.headings) {
      const cleaned = collapseWhitespace(heading.toLowerCase());
      const words = cleaned.split(' ');
      for (let size = 2; size <= 3; size += 1) {
        for (let i = 0; i + size <= words.length; i += 1) {
          const phrase = words.slice(i, i + size).join(' ');
          if (phrase.length >= 8 && phrase.length <= 40 && /^[a-z][a-z ]+$/.test(phrase)) phrases.add(phrase);
        }
      }
    }
    for (const phrase of phrases) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([phrase]) => phrase);
}

function extractLocations(pages: CrawledPage[], organization: OrganizationSchema | null): string[] {
  const locations = new Set<string>();
  const address = asRecord(organization?.address);
  if (address) {
    for (const key of ['addressLocality', 'addressRegion', 'addressCountry']) {
      const value = address[key];
      if (typeof value === 'string') locations.add(value);
    }
  }
  for (const page of pages.filter((p) => p.pageType === 'contact' || p.pageType === 'about')) {
    for (const match of page.text.matchAll(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)?),\s*([A-Z]{2})\b/g)) {
      locations.add(`${match[1]}, ${match[2]}`);
    }
  }
  return [...locations].slice(0, 8);
}

function dedupeFaqs(faqs: ExtractedFaq[]): ExtractedFaq[] {
  const seen = new Set<string>();
  return faqs.filter((faq) => {
    const key = faq.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

function dedupeTestimonials(testimonials: ExtractedTestimonial[]): ExtractedTestimonial[] {
  const seen = new Set<string>();
  return testimonials.filter((t) => {
    const key = t.quote.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
