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

describe('public contact, reviews, and shopper helper surfaces', () => {
  it('adds Instagram, assistant chat, and Google review/location proof to the buyer page', () => {
    const shop = shopMarkup();

    expect(shop).toContain('Instagram');
    expect(shop).toContain('Ask HappyCake AI');
    expect(shop).toContain('Google rating');
    expect(shop).toContain('4.7');
    expect(shop).toContain('350 Promenade Wy #500');
    expect(shop).toContain('(281) 979-8320');
    expect(shop).toContain('Open Google Maps');
  });

  it('removes agent-readable UI from the public buyer page while keeping machine files public', () => {
    const shop = shopMarkup();

    expect(shop).not.toMatch(/shopping agents/i);
    expect(shop).not.toContain('/agent-manifest.json');
    expect(shop).not.toContain('/llms.txt');
    expect(existsSync('public/llms.txt')).toBe(true);
    expect(existsSync('public/agent-manifest.json')).toBe(true);
  });

  it('turns text-heavy lower blocks into animated visual modules', () => {
    const source = appSource();
    const styles = readFileSync('src/web/styles.css', 'utf8');
    const shop = shopMarkup();

    expect(shop).toContain('visualFlow');
    expect(shop).toContain('motionStack');
    expect(shop).toContain('reviewOrbit');
    expect(styles).toContain('@keyframes floatCake');
    expect(styles).toContain('@keyframes pulsePath');
  });

  it('keeps assistant chat wired to the existing assistant API and channel set to website', () => {
    const source = appSource();

    expect(source).toContain('chatMessages');
    expect(source).toContain('submitChatMessage');
    expect(source).toContain('/api/assistant');
    expect(source).toContain("channel: 'website'");
    expect(source).toContain("source: 'happycake-onsite-chat'");
  });

  it('ships public profile with Google Maps metadata and llms.txt for direct machine access', () => {
    expect(existsSync('public/data/business-profile.json')).toBe(true);
    expect(existsSync('public/llms.txt')).toBe(true);

    const profile = JSON.parse(readFileSync('public/data/business-profile.json', 'utf8'));
    expect(profile.brand).toBe('HappyCake');
    expect(profile.instagram.url).toMatch(/^https:\/\/www\.instagram\.com\//);
    expect(profile.googleMaps.searchUrl).toContain('google.com/maps');
    expect(profile.googleMaps.address).toContain('350 Promenade Wy #500');
    expect(profile.googleMaps.phone).toBe('(281) 979-8320');
    expect(profile.reviews.rating).toBe(4.7);
    expect(profile.reviews.source).toMatch(/google/i);

    const llms = readFileSync('public/llms.txt', 'utf8');
    expect(llms).toContain('HappyCake');
    expect(llms).toContain('/data/products.json');
    expect(llms).toContain('/api/assistant');
  });
});
