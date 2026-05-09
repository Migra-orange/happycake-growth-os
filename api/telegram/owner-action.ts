import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleOwnerAction } from '../../src/server/owner-actions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (process.env.OWNER_API_TOKEN && req.headers['x-owner-token'] !== process.env.OWNER_API_TOKEN) {
    return res.status(401).json({ error: 'owner_auth_required' });
  }
  const result = await handleOwnerAction(req.body);
  return res.status(200).json(result);
}
