import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { get, put } from '@vercel/blob';

type BirthdayLead = {
  id: string;
  name: string;
  phone: string;
  birthday: string;
  discountCode: string;
  reminderMonthDay: string;
  consent: boolean;
  source: string;
  createdAt: string;
};

type BirthdayStore = {
  version: number;
  updatedAt: string;
  leads: BirthdayLead[];
};

const BLOB_PATH = 'happycake/birthday-reminders.json';
let memoryStore: BirthdayStore = { version: 1, updatedAt: new Date(0).toISOString(), leads: [] };

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function normalizePhone(value: unknown) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';
  return raw.replace(/[^\d+()\-\s.]/g, '').slice(0, 32);
}

export function normalizeBirthday(value: unknown) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  const [year, month, day] = raw.split('-').map(Number);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return '';
  return raw;
}

export function normalizeBirthdayLead(input: Record<string, unknown>, now = new Date()) {
  const name = cleanText(input.name, 'HappyCake customer');
  const phone = normalizePhone(input.phone);
  const birthday = normalizeBirthday(input.birthday);
  const consent = input.consent === true;

  if (!phone) throw new Error('valid_phone_required');
  if (!birthday) throw new Error('valid_birthday_required');
  if (!consent) throw new Error('sms_consent_required');

  const reminderMonthDay = birthday.slice(5);
  const discountCode = `BDAY${reminderMonthDay.replace('-', '')}`;
  return {
    id: `bday_${randomUUID()}`,
    name,
    phone,
    birthday,
    discountCode,
    reminderMonthDay,
    consent,
    source: cleanText(input.source, 'happycake-birthday-capture'),
    createdAt: now.toISOString()
  } satisfies BirthdayLead;
}

function encryptionKey() {
  const secret = process.env.OWNER_API_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || 'happycake-dev-birthday-store';
  return createHash('sha256').update(secret).digest();
}

function encryptStore(store: BirthdayStore) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(store), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: true, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: tag.toString('base64'), data: data.toString('base64') };
}

function decryptStore(payload: any): BirthdayStore | null {
  if (!payload?.encrypted) return Array.isArray(payload?.leads) ? payload as BirthdayStore : null;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const json = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8');
  const store = JSON.parse(json);
  return Array.isArray(store?.leads) ? store : null;
}

async function readStore(): Promise<BirthdayStore> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memoryStore;
  try {
    const blob = await get(BLOB_PATH, { access: 'public', useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return memoryStore;
    const parsed = decryptStore(await new Response(blob.stream).json());
    if (!parsed) return memoryStore;
    return { version: 1, updatedAt: parsed.updatedAt || new Date(0).toISOString(), leads: parsed.leads };
  } catch {
    return memoryStore;
  }
}

async function writeStore(store: BirthdayStore) {
  memoryStore = store;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 'server_memory';
  await put(BLOB_PATH, JSON.stringify(encryptStore(store), null, 2), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true
  });
  return 'vercel_blob';
}

function upsertLead(store: BirthdayStore, lead: BirthdayLead): BirthdayStore {
  const leads = [lead, ...store.leads.filter(existing => existing.phone !== lead.phone)].slice(0, 5000);
  return { version: 1, updatedAt: lead.createdAt, leads };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const store = await readStore();
    return res.status(200).json({ ok: true, count: store.leads.length, storageMode: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel_blob' : 'server_memory' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const lead = normalizeBirthdayLead(req.body || {});
    const store = upsertLead(await readStore(), lead);
    const storageMode = await writeStore(store);
    return res.status(200).json({
      ok: true,
      storageMode,
      count: store.leads.length,
      lead: {
        id: lead.id,
        name: lead.name,
        birthday: lead.birthday,
        reminderMonthDay: lead.reminderMonthDay,
        discountCode: lead.discountCode
      },
      message: `Saved. We'll text a birthday cake reminder with code ${lead.discountCode}.`
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'invalid_birthday_lead' });
  }
}
