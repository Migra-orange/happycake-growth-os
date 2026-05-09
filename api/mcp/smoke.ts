import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callMcp } from '../../src/server/mcp';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json(await callMcp('square_list_catalog', { smoke: true }));
}
