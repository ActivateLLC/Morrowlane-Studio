import { describe, expect, it } from 'vitest';
import { isSameSite, normalizeUrl, pathSegments, registrableHost, resolveUrl } from './url.js';

describe('normalizeUrl', () => {
  it('adds a scheme when the user pastes a bare domain', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('strips tracking parameters and fragments', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x&id=7#top')).toBe('https://example.com/a?id=7');
  });

  it('drops trailing slashes on deep paths but keeps the root slash', () => {
    expect(normalizeUrl('https://example.com/blog/post/')).toBe('https://example.com/blog/post');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('rejects non-http schemes and hostless input', () => {
    expect(normalizeUrl('mailto:a@b.com')).toBeNull();
    expect(normalizeUrl('localhost')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });
});

describe('site helpers', () => {
  it('treats www and apex as the same site', () => {
    expect(isSameSite('https://www.example.com/a', 'https://example.com/b')).toBe(true);
    expect(isSameSite('https://example.com', 'https://other.com')).toBe(false);
  });

  it('resolves relative hrefs against the page', () => {
    expect(resolveUrl('https://example.com/blog/post', '../pricing')).toBe('https://example.com/pricing');
  });

  it('returns the registrable host and path segments', () => {
    expect(registrableHost('https://www.Example.com/x')).toBe('example.com');
    expect(pathSegments('https://example.com/a/b/c')).toEqual(['a', 'b', 'c']);
  });
});
