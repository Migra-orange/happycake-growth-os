import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, service: 'happycake-growth-os', runtime: 'claude-code-cli', deployment: 'vercel', time: new Date().toISOString() });
}
