import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function shopMarkup() {
  const source = readFileSync('src/web/App.tsx', 'utf8');
  const start = source.indexOf("{view === 'shop'");
  const end = source.indexOf("{view === 'owner'", start);
  if (start === -1 || end === -1) throw new Error('shop_markup_not_found');
  return source.slice(start, end);
}

describe('public shop copy', () => {
  it('keeps internal agent/runtime language off the buyer-facing storefront', () => {
    const shop = shopMarkup();

    expect(shop).not.toMatch(/agent/i);
    expect(shop).not.toMatch(/Growth OS/i);
    expect(shop).not.toMatch(/whole cake funnel/i);
    expect(shop).not.toMatch(/cold demand/i);
    expect(shop).not.toMatch(/Google Maps/i);
    expect(shop).not.toMatch(/owner/i);
    expect(shop).not.toMatch(/Sandbox proof/i);
    expect(shop).not.toMatch(/\bPOS\b/);
  });
});
