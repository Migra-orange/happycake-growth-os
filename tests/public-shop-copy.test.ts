import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function shopMarkup() {
  const source = readFileSync('src/web/App.tsx', 'utf8');
  const start = source.indexOf("{view === 'shop' &&");
  const end = source.indexOf("{view === 'owner'", start);
  if (start === -1 || end === -1) throw new Error('shop_markup_not_found');
  return source.slice(start, end);
}

describe('public shop copy', () => {
  it('keeps internal agent/runtime language off the buyer-facing storefront', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const shop = shopMarkup();
    const customerFacing = [shop, source.slice(source.indexOf('{wheelOpen &&'), source.indexOf('<nav className="topbar">'))]
      .join('\n')
      .replace(/\.replace\(\/owner\/gi, 'bakery'\)/g, '')
      .replace(/\.replace\(\/POS\/gi, 'order system'\)/g, '')
      .replace(/\.replace\(\/MCP\/gi, 'system'\)/g, '')
      .replace(/For shopping agents/g, 'For shopping browsers')
      .replace(/agent-manifest/g, 'browser-manifest')
      .replace(/agentReadableCard/g, 'browserReadableCard')
      .replace(/agentLinks/g, 'browserLinks');

    expect(customerFacing).not.toMatch(/agent/i);
    expect(customerFacing).not.toMatch(/Growth OS/i);
    expect(customerFacing).not.toMatch(/whole cake funnel/i);
    expect(customerFacing).not.toMatch(/cold demand/i);
    expect(customerFacing).not.toMatch(/owner/i);
    expect(customerFacing).not.toMatch(/Sandbox proof/i);
    expect(customerFacing).not.toMatch(/\bPOS\b/);
  });

  it('moves shoppers from hero straight into the cake menu and avoids extra form sections', () => {
    const shop = shopMarkup();
    const heroEnd = shop.indexOf('</section>');
    const afterHero = shop.slice(heroEnd + '</section>'.length).trimStart();

    expect(afterHero.startsWith('<section className="catalogSection catalogAfterHero"')).toBe(true);
    expect(shop).not.toContain('className="funnelMap"');
    expect(shop).not.toContain('className="promoRail"');
    expect(shop).not.toContain('className="birthdayClub"');
    expect(shop).not.toContain('className="marketingSection"');
    expect(shop).toContain('{selected && <section className="orderStage"');
  });

  it('includes premium cake storefront basics without opening the discount wheel automatically', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const shop = shopMarkup();

    expect(shop).toContain('Shop the cake case.');
    expect(shop).toContain('Best sellers');
    expect(shop).toContain('Pick by moment, not just flavor.');
    expect(shop).toContain('How ordering works');
    expect(shop).toContain('Three calm steps.');
    expect(shop).toContain('Spin for a discount');
    expect(source).not.toContain('setTimeout(() => { if (!seen && !ownerRoute) setWheelOpen(true); }');
  });
});
