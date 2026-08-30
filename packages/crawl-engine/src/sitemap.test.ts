import { describe, expect, it } from 'vitest';
import { parseSitemap } from './sitemap.js';

describe('parseSitemap', () => {
  it('recognises a sitemap index and returns its children', () => {
    const xml = `<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap><sitemap><loc>/s2.xml</loc></sitemap></sitemapindex>`;
    const result = parseSitemap(xml, 'https://a.com/sitemap.xml');
    expect(result.kind).toBe('index');
    expect(result.children).toEqual(['https://a.com/s1.xml', 'https://a.com/s2.xml']);
  });

  it('reads urlset entries with lastmod and priority', () => {
    const xml = `<urlset><url><loc>https://a.com/p</loc><lastmod>2026-01-02</lastmod><priority>0.8</priority></url></urlset>`;
    const result = parseSitemap(xml, 'https://a.com/sitemap.xml');
    expect(result.kind).toBe('urlset');
    expect(result.entries[0]).toEqual({ url: 'https://a.com/p', lastModified: '2026-01-02', priority: 0.8 });
  });

  it('handles CDATA and entity-encoded locations', () => {
    const xml = `<urlset><url><loc><![CDATA[https://a.com/x?a=1&amp;b=2]]></loc></url></urlset>`;
    expect(parseSitemap(xml, 'https://a.com/').entries[0]?.url).toBe('https://a.com/x?a=1&b=2');
  });

  it('parses RSS items and Atom entries as feeds', () => {
    const rss = `<rss><channel><item><link>https://a.com/post-1</link><pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate></item></channel></rss>`;
    expect(parseSitemap(rss, 'https://a.com/').kind).toBe('feed');

    const atom = `<feed><entry><link href="https://a.com/post-2"/><updated>2026-07-01T00:00:00Z</updated></entry></feed>`;
    const parsed = parseSitemap(atom, 'https://a.com/');
    expect(parsed.kind).toBe('feed');
    expect(parsed.entries[0]?.url).toBe('https://a.com/post-2');
  });

  it('reports unknown for markup that is not a sitemap', () => {
    expect(parseSitemap('<html><body>hi</body></html>', 'https://a.com/').kind).toBe('unknown');
  });
});
