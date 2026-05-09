import type { VercelRequest, VercelResponse } from '@vercel/node';

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';

function token() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

function simulated() {
  return {
    ok: true,
    source: 'simulated',
    tool: 'square_list_catalog',
    data: {
      catalogVersion: 'sandbox-2026-05',
      products: ['Honey Layer Cake', 'Classic Napoleon Cake', 'Milk Maiden Cake', 'Pistachio Roll']
    }
  };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  const teamToken = token();

  if (!teamToken || process.env.MCP_MODE === 'simulated') {
    const result = simulated();
    return res.status(200).json({ ...result, latencyMs: Date.now() - started, note: 'Deterministic simulator is active for this deployment.' });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Team-Token': teamToken },
      body: JSON.stringify({ tool: 'square_list_catalog', input: { smoke: true } })
    });
    const data = await upstream.json().catch(() => ({ raw: 'non_json_response' }));
    return res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      source: 'mcp',
      tool: 'square_list_catalog',
      data,
      latencyMs: Date.now() - started,
      note: 'Real Steppe MCP call attempted. Team token stayed server-side.'
    });
  } catch {
    if (process.env.MCP_MODE === 'live') {
      return res.status(502).json({ ok: false, source: 'mcp', tool: 'square_list_catalog', error: 'mcp_smoke_failed' });
    }
    const result = simulated();
    return res.status(200).json({ ...result, latencyMs: Date.now() - started, note: 'MCP unavailable; safe simulator fallback is active.' });
  }
}
