import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callMcp } from '../../src/server/mcp';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const result = await callMcp('square_list_catalog', { smoke: true });
    return res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      source: result.source,
      tool: result.tool,
      latencyMs: result.latencyMs,
      note: result.source === 'mcp'
        ? 'Real Steppe MCP call succeeded. Team token stayed server-side.'
        : 'Deterministic simulator is active for this deployment.'
    });
  } catch {
    return res.status(502).json({ ok: false, source: 'mcp', tool: 'square_list_catalog', error: 'mcp_smoke_failed' });
  }
}
