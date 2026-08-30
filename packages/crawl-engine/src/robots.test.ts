import { describe, expect, it } from 'vitest';
import { isAllowed, parseRobots } from './robots.js';

const ROBOTS = `# comment
User-agent: BadBot
Disallow: /

User-agent: *
Disallow: /account/
Disallow: /cart
Allow: /account/public
Crawl-delay: 1.5

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml
`;

describe('parseRobots', () => {
  it('collects sitemaps regardless of which group they appear in', () => {
    const rules = parseRobots(ROBOTS);
    expect(rules.sitemaps).toEqual(['https://example.com/sitemap.xml', 'https://example.com/sitemap-news.xml']);
  });

  it('only applies directives from the wildcard or matching group', () => {
    const rules = parseRobots(ROBOTS);
    // "Disallow: /" belongs to BadBot and must not leak into our rules.
    expect(rules.disallow).toEqual(['/account/', '/cart']);
    expect(rules.allow).toEqual(['/account/public']);
    expect(rules.crawlDelaySeconds).toBe(1.5);
  });
});

describe('isAllowed', () => {
  const rules = parseRobots(ROBOTS);

  it('blocks disallowed paths', () => {
    expect(isAllowed(rules, '/account/settings')).toBe(false);
    expect(isAllowed(rules, '/cart')).toBe(false);
  });

  it('lets a longer Allow override a shorter Disallow', () => {
    expect(isAllowed(rules, '/account/public')).toBe(true);
  });

  it('allows anything not mentioned', () => {
    expect(isAllowed(rules, '/pricing')).toBe(true);
  });

  it('honours wildcards and end anchors', () => {
    const wildcard = parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp/*/private');
    expect(isAllowed(wildcard, '/files/report.pdf')).toBe(false);
    expect(isAllowed(wildcard, '/files/report.pdf.html')).toBe(true);
    expect(isAllowed(wildcard, '/tmp/a/private')).toBe(false);
  });
});
