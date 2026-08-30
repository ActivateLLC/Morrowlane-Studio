import { describe, expect, it } from 'vitest';
import { parseStudioIntent } from './intent.js';

describe('parseStudioIntent', () => {
  it('reads a plain product promotion as a content generation', () => {
    const intent = parseStudioIntent('Promote our credit builder.');
    expect(intent.action).toBe('generate_content');
    expect(intent.productHint).toBe('credit builder');
  });

  it('reads a channel and a duration out of a week request', () => {
    const intent = parseStudioIntent('Create a week of Instagram content.');
    expect(intent.channels).toEqual(['instagram']);
    expect(intent.durationDays).toBe(7);
  });

  it('treats a pasted product URL as a remix', () => {
    const intent = parseStudioIntent('Promote https://brand.com/product/widget');
    expect(intent.action).toBe('remix_url');
    expect(intent.url).toBe('https://brand.com/product/widget');
  });

  it('recognises an explicit remix instruction', () => {
    const intent = parseStudioIntent('Turn this article into a campaign: https://brand.com/blog/x');
    expect(intent.action).toBe('remix_url');
    expect(intent.url).toBe('https://brand.com/blog/x');
  });

  it('routes a 30-day ask to the calendar filler, not to 30 posts', () => {
    const intent = parseStudioIntent('Generate 30 days of content.');
    expect(intent.action).toBe('fill_calendar');
    expect(intent.durationDays).toBe(30);
  });

  it('reads an explicit count and format', () => {
    const intent = parseStudioIntent('Give me 10 tiktok scripts about credit utilization');
    expect(intent.count).toBe(10);
    expect(intent.formats).toContain('tiktok_script');
    expect(intent.topic).toBe('credit utilization');
  });

  it('retargets a generic "posts" to the named channel', () => {
    expect(parseStudioIntent('write 5 linkedin posts').formats).toEqual(['linkedin_post']);
    expect(parseStudioIntent('write 5 posts').formats).toEqual(['instagram_post']);
  });

  it('prefers the longer alias when both match', () => {
    expect(parseStudioIntent('write a blog post about credit').formats).toContain('blog_article');
  });

  it('detects a campaign request', () => {
    const intent = parseStudioIntent('Run a 30 day campaign to generate qualified customers on instagram and tiktok');
    expect(intent.action).toBe('plan_campaign');
    expect(intent.durationDays).toBe(30);
    expect(intent.channels).toEqual(expect.arrayContaining(['instagram', 'tiktok']));
  });

  it('does not mistake ordinary prose for a URL', () => {
    expect(parseStudioIntent('Create posts about our newest service.').url).toBeNull();
  });

  it('reads spelled-out counts', () => {
    expect(parseStudioIntent('write three carousels').count).toBe(3);
  });
});
