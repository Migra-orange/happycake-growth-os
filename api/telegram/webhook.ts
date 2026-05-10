import type { VercelRequest, VercelResponse } from '@vercel/node';

type TelegramCallback = {
  id?: string;
  data?: string;
  message?: { chat?: { id?: number | string } };
  from?: { id?: number | string };
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(req: VercelRequest, key = 'telegram-webhook', limit = 80) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const current = rateBuckets.get(bucketKey);
  if (!current || current.resetAt < now) { rateBuckets.set(bucketKey, { count: 1, resetAt: now + 60_000 }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function telegramApi(method: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return '';
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  const url = telegramApi('answerCallbackQuery');
  if (!url || !callbackQueryId) return { ok: false, skipped: true };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false })
  });
  return { ok: response.ok };
}

function ownerAllowed(callback: TelegramCallback) {
  const allowed = [
    process.env.TELEGRAM_OWNER_USER_ID,
    process.env.TELEGRAM_OWNER_CHAT_ID,
    ...(process.env.TELEGRAM_ALLOWED_USERS || '').split(',')
  ].map((item) => String(item || '').trim()).filter(Boolean);
  if (!allowed.length) return false;
  return allowed.includes(String(callback.from?.id || ''));
}

async function forwardOwnerAction(req: VercelRequest, action: string, approvalId: string) {
  const configuredBase = process.env.HAPPYCAKE_PUBLIC_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'https://happycake-growth-os.vercel.app';
  const base = configuredBase.startsWith('http') ? configuredBase : `https://${configuredBase}`;
  const response = await fetch(`${base.replace(/\/$/, '')}/api/telegram/owner-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.OWNER_API_TOKEN ? { 'x-owner-token': process.env.OWNER_API_TOKEN } : {})
    },
    body: JSON.stringify({ action, approvalId, intentId: approvalId, source: 'telegram_callback' })
  });
  return response.json().catch(() => ({ ok: response.ok }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, route: 'telegram_webhook', configured: Boolean(process.env.TELEGRAM_BOT_TOKEN), ownerAllowlistConfigured: Boolean(process.env.TELEGRAM_OWNER_USER_ID || process.env.TELEGRAM_OWNER_CHAT_ID || process.env.TELEGRAM_ALLOWED_USERS), secretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET) });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!checkRateLimit(req)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    return res.status(401).json({ ok: false, error: 'telegram_secret_required' });
  }

  const callback = req.body?.callback_query as TelegramCallback | undefined;
  if (!callback) return res.status(200).json({ ok: true, ignored: 'no_callback_query' });
  if (!ownerAllowed(callback)) {
    await answerCallbackQuery(String(callback.id || ''), 'Owner account required.');
    return res.status(403).json({ ok: false, error: 'owner_not_allowed' });
  }

  const data = String(callback.data || '');
  const [, command, approvalId] = data.split(':');
  if (!approvalId || (command !== 'approve' && command !== 'reject')) {
    await answerCallbackQuery(String(callback.id || ''), 'Unknown HappyCake action.');
    return res.status(400).json({ ok: false, error: 'invalid_callback_data' });
  }

  if (!data.startsWith('hc:approve:') && !data.startsWith('hc:reject:')) {
    return res.status(400).json({ ok: false, error: 'invalid_callback_data' });
  }

  const action = command === 'approve' ? 'approve_order_handoff' : 'reject_campaign';
  const result = await forwardOwnerAction(req, action, approvalId);
  await answerCallbackQuery(String(callback.id || ''), command === 'approve' ? 'Approved in HappyCake.' : 'Rejected in HappyCake.');
  return res.status(200).json({ ok: true, result });
}
