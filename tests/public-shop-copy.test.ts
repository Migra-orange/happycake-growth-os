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
    expect(shop).toContain('<section className="orderStage"');
  });

  it('includes premium cake storefront basics without opening the discount wheel automatically', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const shop = shopMarkup();

    expect(shop).toContain('Shop the cake case.');
    expect(shop).toContain('Best sellers');
    expect(shop).toContain('Pick by moment, not just flavor.');
    expect(shop).toContain('occasionIcon');
    expect(shop).not.toContain('How ordering works');
    expect(shop).not.toContain('Three calm steps.');
    expect(shop).toContain('Spin for a discount');
    expect(source).not.toContain('setTimeout(() => { if (!seen && !ownerRoute) setWheelOpen(true); }');
  });

  it('asks buyers for a reply contact before sending an order request without forwarding raw contact text', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const shop = shopMarkup();

    expect(source).toContain("const [contactDetail, setContactDetail] = useState('');");
    expect(shop).toContain('Reply contact');
    expect(shop).toContain('Instagram handle, WhatsApp number, or email');
    expect(source).toContain("Contact provided: ${contactDetail.trim() ? 'yes' : 'not provided'}");
    expect(source).toContain('contactProvided: Boolean(contactDetail.trim())');
    expect(source).not.toContain("Contact: ${contactDetail.trim() || 'not provided'}");
  });

  it('uses HappyCake spelling in public-facing local proof copy', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const businessProfile = readFileSync('public/data/business-profile.json', 'utf8');

    expect(source).toContain('HappyCake on Google Maps');
    expect(source).toContain('HappyCake is listed on Google Maps');
    expect(businessProfile).toContain('HappyCake on Google Maps');
    expect(businessProfile).toContain('HappyCake is listed on Google Maps');
  });

  it('does not overstate product price source or publish unverified structured offer prices', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const shop = shopMarkup();
    const products = readFileSync('public/data/products.json', 'utf8');
    const submission = readFileSync('SUBMISSION.md', 'utf8');
    const manifest = readFileSync('public/agent-manifest.json', 'utf8');

    expect(products).toContain('Displayed prices are demo menu values for internal evaluator calculations only');
    expect(products).not.toContain("Prices and product names come from HappyCake's published cake menu.");
    expect(shop).toContain('Browse best-selling cakes by size and serving guide. Send a pickup request and the bakery will confirm current pricing, availability, and pickup timing before anything is finalized.');
    expect(shop).not.toContain('Demo menu prices');
    expect(shop).not.toMatch(/p\.priceUsd|selected\.priceUsd|featured\.priceUsd/);
    expect(source).not.toContain('product.priceUsd');
    expect(source).not.toContain("price: p.priceUsd, priceCurrency: 'USD'");
    expect(source).not.toContain('`, $${product.priceUsd}.`');
    expect(submission).toContain('public Vercel demo proves live Steppe MCP integration and owner-safety flows');
    expect(manifest).toContain('claudeCodeCliProof');
    expect(manifest).not.toContain('"/api/assistant"]');
  });

  it('places the selected-cake order form immediately after the catalog CTA target', () => {
    const shop = shopMarkup();
    const catalog = shop.indexOf('className="catalogSection catalogAfterHero"');
    const orderStage = shop.indexOf('<section className="orderStage"', catalog);
    const occasions = shop.indexOf('className="landingSection occasionSection"', catalog);

    expect(catalog).toBeGreaterThan(-1);
    expect(orderStage).toBeGreaterThan(catalog);
    expect(occasions).toBeGreaterThan(orderStage);
    expect(shop).toContain('button className="orderButton" type="button" onClick={() => startOrder(p)}>Order this cake</button>');
  });

  it('requires an explicit cake selection before sending a buyer request', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const shop = shopMarkup();

    expect(source).toContain('const product = selected;');
    expect(source).not.toContain('const product = selected || featured;');
    expect(shop).toContain('disabled={loading || !selected}');
    expect(shop).toContain("{!selected ? 'Choose a cake first' : loading ? 'Sending order request…' : 'Send order request'}");
  });

  it('opens the owner cockpit for every documented owner hash route', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');

    expect(source).toContain("/^#owner(?:$|[/?])/.test(hash)");
    expect(source).toContain("new URLSearchParams(search).get('owner') === '1'");
    expect(source).toContain("history.replaceState(null, '', '#owner/dashboard')");
    expect(source).not.toContain("hash.startsWith('#owner')");
    expect(source).not.toContain("search.includes('owner=1')");
  });

  it('responds when evaluators navigate from the shop hash to the owner hash without a full reload', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');

    expect(source).toContain("window.addEventListener('hashchange', syncHashRoute)");
    expect(source).toContain("window.removeEventListener('hashchange', syncHashRoute)");
    expect(source).toContain("setView(isOwnerRoute(window.location.hash, window.location.search) ? 'owner' : 'shop')");
  });
});
