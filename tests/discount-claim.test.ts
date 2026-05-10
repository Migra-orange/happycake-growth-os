import { describe, expect, it } from 'vitest';
import { normalizeDiscountClaim, normalizeEmail, normalizePhone } from '../api/discount-claim';

describe('discount claim capture', () => {
  it('requires a name plus phone or email and returns an individual promo code for a won discount', () => {
    const claim = normalizeDiscountClaim({
      name: '  Maya   K. ',
      phone: '(832) 555-0123',
      email: '',
      discountPercent: 20,
      sourceCode: 'CAKE20',
      source: 'spin-wheel'
    }, new Date('2026-05-10T00:00:00Z'));

    expect(claim.name).toBe('Maya K.');
    expect(claim.phone).toBe('(832) 555-0123');
    expect(claim.email).toBe('');
    expect(claim.discountPercent).toBe(20);
    expect(claim.promoCode).toMatch(/^HC20-[A-Z0-9]{6}$/);
    expect(claim.createdAt).toBe('2026-05-10T00:00:00.000Z');
  });

  it('accepts email instead of phone and rejects missing contact or invalid discount', () => {
    expect(normalizeEmail(' TEST@Example.COM ')).toBe('test@example.com');
    expect(normalizePhone('abc')).toBe('');
    expect(() => normalizeDiscountClaim({ name: 'Maya', discountPercent: 0 })).toThrow('contact_required');
    expect(() => normalizeDiscountClaim({ name: 'Maya', email: 'm@example.com', discountPercent: 15 })).toThrow('valid_discount_required');
  });
});
