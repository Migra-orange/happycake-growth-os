import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('offer wheel discounts', () => {
  it('uses clear percentage discount slices plus a nothing slice', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const offerStart = source.indexOf('const offers: Offer[]');
    const offerBlock = source.slice(offerStart, source.indexOf('const shopTrustPoints', offerStart));

    for (const label of ['5% off', '10% off', '20% off', '50% off', 'Nothing']) {
      expect(offerBlock).toContain(label);
    }

    for (const oldLabel of ['$5 off today', 'Free candles', 'Gift note', 'Priority request']) {
      expect(offerBlock).not.toContain(oldLabel);
    }
  });

  it('does not reveal a won discount code until the shopper leaves contact details', () => {
    const source = readFileSync('src/web/App.tsx', 'utf8');
    const wheelMarkup = source.slice(source.indexOf('{wheelOpen &&'), source.indexOf('<nav className="topbar">'));

    expect(wheelMarkup).toContain('Send my code');
    expect(source).toContain('/api/discount-claim');
    expect(wheelMarkup).toContain('Where should we send it?');
    expect(wheelMarkup).not.toContain("<strong>{offer.angle === 'none' ? 'Nothing' : offer.code}</strong>");
  });
});
