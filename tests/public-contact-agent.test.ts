import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function appSource() {
  return readFileSync('src/web/App.tsx', 'utf8');
}

function shopMarkup() {
  const source = appSource();
  const start = source.indexOf("{view === 'shop' &&");
  const end = source.indexOf("{view === 'owner'", start);
  if (start === -1 || end === -1) throw new Error('shop_markup_not_found');
  return source.slice(start, end);
}

describe('public contact, reviews, and agent-readable surfaces', () => {
  it('adds Instagram, assistant chat, Google review/location, and machine-readable entry points to the buyer page', () => {
    const shop = shopMarkup();

    expect(shop).toContain('Instagram');
    expect(shop).toContain('Ask HappyCake AI');
    expect(shop).toContain('Google review');
    expect(shop).toContain('Open map');
    expect(shop).toContain('For shopping agents');
    expect(shop).toContain('/llms.txt');
    expect(shop).toContain('/agent-manifest.json');
  });

  it('keeps assistant chat wired to the existing assistant API and channel set to website', () => {
    const source = appSource();

    expect(source).toContain('chatMessages');
    expect(source).toContain('submitChatMessage');
    expect(source).toContain('/api/assistant');
    expect(source).toContain("channel: 'website'");
    expect(source).toContain("source: 'happycake-onsite-chat'");
  });

  it('ships public profile and llms.txt so humans and agents can orient themselves', () => {
    expect(existsSync('public/data/business-profile.json')).toBe(true);
    expect(existsSync('public/llms.txt')).toBe(true);

    const profile = JSON.parse(readFileSync('public/data/business-profile.json', 'utf8'));
    expect(profile.brand).toBe('HappyCake');
    expect(profile.instagram.url).toMatch(/^https:\/\/www\.instagram\.com\//);
    expect(profile.googleMaps.searchUrl).toContain('google.com/maps/search');
    expect(profile.reviews.source).toMatch(/google/i);

    const llms = readFileSync('public/llms.txt', 'utf8');
    expect(llms).toContain('HappyCake');
    expect(llms).toContain('/data/products.json');
    expect(llms).toContain('/api/assistant');
  });
});
