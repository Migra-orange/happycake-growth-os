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
  it('adds Instagram posts, always-open assistant chat, and clickable Google review/detail proof', () => {
    const shop = shopMarkup();

    expect(shop).toContain('Latest posts from');
    expect(shop).toContain('instaPost');
    expect(shop).not.toContain('Instagram + location');
    expect(shop).not.toContain('mapVisual');
    expect(shop).toContain('Ask HappyCake AI');
    expect(shop).not.toContain('Open chat');
    expect(shop).toContain('Google ratings');
    expect(shop).toContain('4.7');
    expect(shop).toContain('Open review');
    expect(shop).toContain('tel:+12819798320');
  });

  it('removes agent-readable UI from the public buyer page while keeping machine files public', () => {
    const shop = shopMarkup();

    expect(shop).not.toMatch(/shopping agents/i);
    expect(shop).not.toContain('/agent-manifest.json');
    expect(shop).not.toContain('/llms.txt');
    expect(existsSync('public/llms.txt')).toBe(true);
    expect(existsSync('public/agent-manifest.json')).toBe(true);
  });

  it('keeps occasion cards visual with themed icons and removes the old ordering explainer section', () => {
    const styles = readFileSync('src/web/styles.css', 'utf8');
    const shop = shopMarkup();

    expect(shop).toContain('occasionIcon');
    expect(shop).not.toContain('How ordering works');
    expect(shop).not.toContain('visualFlow');
    expect(styles).toContain('.occasionIcon');
    expect(styles).toContain('.instaPost');
  });

  it('keeps assistant chat wired to the existing assistant API and channel set to website', () => {
    const source = appSource();

    expect(source).toContain('chatMessages');
    expect(source).toContain('submitChatMessage');
    expect(source).toContain('/api/assistant');
    expect(source).toContain("channel: 'website'");
    expect(source).toContain("source: 'happycake-onsite-chat'");
  });

  it('ships public profile with Instagram post URLs, Google Maps metadata, and llms.txt', () => {
    expect(existsSync('public/data/business-profile.json')).toBe(true);
    expect(existsSync('public/llms.txt')).toBe(true);

    const profile = JSON.parse(readFileSync('public/data/business-profile.json', 'utf8'));
    expect(profile.brand).toBe('HappyCake');
    expect(profile.instagram.url).toMatch(/^https:\/\/www\.instagram\.com\//);
    expect(profile.instagram.posts).toHaveLength(3);
    expect(profile.instagram.posts[0].url).toMatch(/instagram\.com/);
    expect(profile.googleMaps.searchUrl).toContain('google.com/maps');
    expect(profile.googleMaps.address).toContain('350 Promenade Wy #500');
    expect(profile.googleMaps.phone).toBe('(281) 979-8320');
    expect(profile.reviews.rating).toBe(4.7);
    expect(profile.reviews.items).toHaveLength(3);
    expect(profile.reviews.items.every((item: { url:string }) => item.url.includes('google.com/maps'))).toBe(true);

    const llms = readFileSync('public/llms.txt', 'utf8');
    expect(llms).toContain('HappyCake');
    expect(llms).toContain('/data/products.json');
    expect(llms).toContain('/api/assistant');
  });
});
