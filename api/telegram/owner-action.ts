import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (process.env.OWNER_API_TOKEN && req.headers['x-owner-token'] !== process.env.OWNER_API_TOKEN) {
    return res.status(401).json({ error: 'owner_auth_required' });
  }
  const action = String(req.body?.action || 'approve_order_handoff');
  const intentId = String(req.body?.intentId || req.body?.approvalId || req.body?.campaignId || 'office-drop');
  const rejected = action.includes('reject');
  return res.status(200).json({
    ok: true,
    reply: rejected
      ? `Owner rejected ${intentId}. Customer promise remains blocked.`
      : `Order handoff ${intentId} approved in Telegram. Sandbox POS/kitchen actions may proceed.`,
    evidenceId: `owner_${Date.now().toString(36)}`
  });
}
