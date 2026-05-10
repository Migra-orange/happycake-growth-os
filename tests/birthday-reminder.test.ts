import { describe, expect, it } from 'vitest';
import { normalizeBirthday, normalizeBirthdayLead, normalizePhone } from '../api/birthday-reminder';

describe('birthday reminder capture', () => {
  it('normalizes a consented birthday lead and creates a reusable birthday discount code', () => {
    const lead = normalizeBirthdayLead({
      name: '  Maya   K. ',
      phone: '(832) 555-0101',
      birthday: '1992-08-14',
      consent: true,
      source: 'homepage-birthday-card'
    }, new Date('2026-05-10T00:00:00Z'));

    expect(lead.name).toBe('Maya K.');
    expect(lead.phone).toBe('(832) 555-0101');
    expect(lead.reminderMonthDay).toBe('08-14');
    expect(lead.discountCode).toBe('BDAY0814');
    expect(lead.source).toBe('homepage-birthday-card');
  });

  it('rejects unusable phone/date/consent values', () => {
    expect(normalizePhone('abc')).toBe('');
    expect(normalizeBirthday('2026-02-31')).toBe('');
    expect(() => normalizeBirthdayLead({ phone: '8325550101', birthday: '1992-08-14', consent: false })).toThrow('sms_consent_required');
  });
});
