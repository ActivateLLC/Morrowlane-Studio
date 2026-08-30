import type { BrandBrain, ContentItem, ContentSegment } from '@morrowlane/shared';
import { formatProfile, truncate } from '@morrowlane/shared';

/**
 * Translates a content item plus the Brand Brain into render requests for the media
 * services. This is the boundary the spec asks for: ComfyUI and Remotion stay isolated
 * services, and this package owns the only shape they are spoken to in.
 */

export interface ImageRenderRequest {
  kind: 'image';
  contentId: string;
  /** ComfyUI workflow template name under services/creative/workflows. */
  workflow: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  brandColor: string | null;
  logoUrl: string | null;
  /** One request per slide for carousels. */
  slideIndex: number | null;
}

export interface VideoRenderRequest {
  kind: 'video';
  contentId: string;
  composition: 'ShortVideo';
  width: number;
  height: number;
  fps: number;
  beats: Array<{ heading: string | null; body: string; visualDirection: string | null; durationSeconds: number }>;
  brandColor: string | null;
  logoUrl: string | null;
}

export type RenderRequest = ImageRenderRequest | VideoRenderRequest;

/** Canvas per placement: vertical for stories/reels, portrait feed otherwise. */
function canvasFor(item: ContentItem): { width: number; height: number } {
  const meta = formatProfile(item.format);
  if (meta.medium === 'video') return { width: 1080, height: 1920 };
  if (item.format === 'infographic' || item.format === 'pinterest_post') return { width: 1000, height: 1500 };
  return { width: 1080, height: 1350 };
}

export function buildRenderRequests(item: ContentItem, brain: BrandBrain): RenderRequest[] {
  const meta = formatProfile(item.format);
  if (meta.medium === 'text') return [];

  const brandColor = brain.visuals.colors[0] ?? null;
  const logoUrl = brain.visuals.logoUrls[0] ?? null;
  const { width, height } = canvasFor(item);
  const styleWords = [
    brain.identity.category,
    ...brain.voice.traits.slice(0, 3),
    ...brain.rules.visualGuidelines.slice(0, 2),
  ]
    .filter(Boolean)
    .join(', ');

  if (meta.medium === 'video') {
    const beats = (item.segments.length > 0 ? item.segments : fallbackSegments(item)).map((segment) => ({
      heading: segment.heading,
      body: truncate(segment.body, 220),
      visualDirection: segment.visualDirection,
      // Short-form pacing: hook beat is snappier, body beats even.
      durationSeconds: segment.index === 0 ? 2.5 : 4,
    }));
    return [
      {
        kind: 'video',
        contentId: item.id,
        composition: 'ShortVideo',
        width,
        height,
        fps: 30,
        beats,
        brandColor,
        logoUrl,
      },
    ];
  }

  const segments = item.segments.length > 1 ? item.segments : fallbackSegments(item);
  return segments.map((segment, index): ImageRenderRequest => ({
    kind: 'image',
    contentId: item.id,
    workflow: 'branded-image',
    prompt: [segment.visualDirection ?? truncate(segment.body, 160), styleWords].filter(Boolean).join('. '),
    negativePrompt: 'text artifacts, watermark, extra logos, distorted hands',
    width,
    height,
    brandColor,
    logoUrl,
    slideIndex: segments.length > 1 ? index : null,
  }));
}

function fallbackSegments(item: ContentItem): ContentSegment[] {
  return [{ index: 0, heading: item.title, body: item.hook || item.body, visualDirection: null }];
}
