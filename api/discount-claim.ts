import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { get, put } from '@vercel/blob';

type DiscountClaim = {
  id: string;
  name: string;
  phone: string;
  email: string;
  discountPercent: 5 | 10 | 20 | 50;
  sourceCode: string;
  promoCode: string;
  source: string;
  createdAt: string;
};

type DiscountClaimStore = {
  version: number;
  updatedAt: string;
  claims: DiscountClaim[];
};

const BLOB_PATH = 'happycake/discount-claims.json';
const VALID_DISCOUNTS = new Set([5, 10, 20, 50]);
let memoryStore: DiscountClaimStore = { version: 1, updatedAt: new Date(0).toISOString(), claims: [] };

type GlobalWithRateLimit = typeof globalThis & { __happycakeRateBuckets?: Record<string, { count:number; resetAt:number }> };
function clientKey(req: VercelRequest) { return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80); }
function checkRateLimit(req: VercelRequest, bucket = 'public-capture', limit = 25, windowMs = 60_000) {
  const globalStore = globalThis as GlobalWithRateLimit;
  const buckets = globalStore.__happycakeRateBuckets || (globalStore.__happycakeRateBuckets = {});
  const key = `${bucket}:${clientKey(req)}`;
  const now = Date.now();
  const current = buckets[key];
  if (!current || current.resetAt <= now) { buckets[key] = { count: 1, resetAt: now + windowMs }; return { ok: true, remaining: limit - 1, resetAt: buckets[key].resetAt }; }
  current.count += 1;
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function normalizePhone(value: unknown) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!raw) return '';
  if (digits.length < 10 || digits.length > 15) return '';
  return raw.replace(/[^\d+()\-\s.]/g, '').slice(0, 32);
}

export function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase().slice(0, 160);
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function promoSuffix(seed: string) {
  return createHash('sha256').update(`${seed}:${randomUUID()}`).digest('base64url').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
}

export function normalizeDiscountClaim(input: Record<string, unknown>, now = new Date()) {
  const name = cleanText(input.name);
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const discountPercent = Number(input.discountPercent);
  const sourceCode = cleanText(input.sourceCode, `CAKE${discountPercent}`).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);

  if (!name) throw new Error('name_required');
  if (!phone && !email) throw new Error('contact_required');
  if (!VALID_DISCOUNTS.has(discountPercent)) throw new Error('valid_discount_required');

  const promoCode = `HC${discountPercent}-${promoSuffix(`${name}:${phone}:${email}:${discountPercent}:${now.toISOString()}`)}`;
  return {
    id: `claim_${randomUUID()}`,
    name,
    phone,
    email,
    discountPercent: discountPercent as 5 | 10 | 20 | 50,
    sourceCode,
    promoCode,
    source: cleanText(input.source, 'spin-wheel'),
    createdAt: now.toISOString()
  } satisfies DiscountClaim;
}

function encryptionKey() {
  const secret = process.env.OWNER_API_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || 'happycake-dev-discount-claims';
  return createHash('sha256').update(secret).digest();
}

function encryptStore(store: DiscountClaimStore) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(store), 'utf8'), cipher.final()]);
  return { encrypted: true, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function decryptStore(payload: any): DiscountClaimStore | null {
  if (!payload?.encrypted) return Array.isArray(payload?.claims) ? payload as DiscountClaimStore : null;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const json = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8');
  const store = JSON.parse(json);
  return Array.isArray(store?.claims) ? store : null;
}

async function readStore(): Promise<DiscountClaimStore> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memoryStore;
  try {
    const blob = await get(BLOB_PATH, { access: 'private', useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return memoryStore;
    const parsed = decryptStore(await new Response(blob.stream).json());
    if (!parsed) return memoryStore;
    return { version: 1, updatedAt: parsed.updatedAt || new Date(0).toISOString(), claims: parsed.claims };
  } catch {
    return memoryStore;
  }
}

async function writeStore(store: DiscountClaimStore) {
  memoryStore = store;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 'server_memory';
  await put(BLOB_PATH, JSON.stringify(encryptStore(store), null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });
  return 'vercel_blob';
}

function upsertClaim(store: DiscountClaimStore, claim: DiscountClaim): DiscountClaimStore {
  const claims = [claim, ...store.claims.filter(existing => {
    if (claim.email && existing.email === claim.email) return false;
    if (claim.phone && existing.phone === claim.phone) return false;
    return true;
  })].slice(0, 5000);
  return { version: 1, updatedAt: claim.createdAt, claims };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const store = await readStore();
    return res.status(200).json({ ok: true, count: store.claims.length, storageMode: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel_blob' : 'server_memory' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  const rate = checkRateLimit(req, 'discount-claim', 25, 60_000);
  if (!rate.ok) return res.status(429).json({ ok: false, error: 'rate_limited', resetAt: rate.resetAt });

  try {
    const claim = normalizeDiscountClaim(req.body || {});
    const store = upsertClaim(await readStore(), claim);
    const storageMode = await writeStore(store);
    return res.status(200).json({
      ok: true,
      storageMode,
      count: store.claims.length,
      claim: {
        id: claim.id,
        name: claim.name,
        contact: claim.email ? 'email' : 'phone',
        discountPercent: claim.discountPercent,
        promoCode: claim.promoCode
      },
      message: `Saved. Your individual ${claim.discountPercent}% discount code is ${claim.promoCode}.`
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'invalid_discount_claim' });
  }
}
