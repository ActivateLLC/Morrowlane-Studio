import type { MetadataRoute } from 'next';

/**
 * The marketing surface (sign-in) is public; everything behind it is a private workspace
 * and must never be indexed, even though it already requires auth.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/brands/', '/settings', '/new', '/api/'] }],
  };
}
