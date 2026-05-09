import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AssistantRequestSchema } from '../src/shared/schema';
import { runAssistant } from '../src/server/assistant';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const parsed = AssistantRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_request', issues: parsed.error.issues });
  try {
    const response = await runAssistant(parsed.data);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: 'assistant_failed', message: error instanceof Error ? error.message : 'unknown error' });
  }
}
