import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (process.env.OWNER_API_TOKEN && req.headers['x-owner-token'] !== process.env.OWNER_API_TOKEN) {
    return res.status(401).json({ error: 'owner_auth_required' });
  }
  const action = String(req.body?.action || 'approve');
  const campaignId = String(req.body?.campaignId || 'office-drop');
  return res.status(200).json({
    ok: true,
    reply: `Campaign ${campaignId} ${action === 'reject' ? 'rejected' : 'approved'}. It can now be published/simulated.`,
    evidenceId: `owner_${Date.now().toString(36)}`
  });
}
