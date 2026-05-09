import type { VercelRequest, VercelResponse } from '@vercel/node';

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';

function token() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

async function callMcp(tool: string, input: Record<string, unknown>) {
  const started = Date.now();
  const teamToken = token();
  if (!teamToken || process.env.MCP_MODE === 'simulated') {
    if (!teamToken && process.env.MCP_MODE === 'live') throw new Error('mcp_token_missing');
    return { ok: true, source: 'simulated', tool, latencyMs: Date.now() - started };
  }
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Team-Token': teamToken },
    body: JSON.stringify({ tool, input })
  });
  if (!upstream.ok && process.env.MCP_MODE === 'live') throw new Error(`mcp_${tool}_failed`);
  if (!upstream.ok) return { ok: true, source: 'simulated', tool, latencyMs: Date.now() - started };
  return { ok: true, source: 'mcp', tool, latencyMs: Date.now() - started };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (process.env.OWNER_API_TOKEN && req.headers['x-owner-token'] !== process.env.OWNER_API_TOKEN) {
    return res.status(401).json({ error: 'owner_auth_required' });
  }
  const action = String(req.body?.action || 'approve_order_handoff');
  const intentId = String(req.body?.intentId || req.body?.approvalId || req.body?.campaignId || 'office-drop');
  const rejected = action.includes('reject');

  try {
    const mcpCalls = rejected
      ? [await callMcp('owner_action_log', { intentId, action: 'rejected', note: req.body?.note || '' })]
      : [
        await callMcp('owner_action_log', { intentId, action: 'approved', note: req.body?.note || '' }),
        await callMcp('square_create_order', { intentId, approvedBy: 'owner_telegram' }),
        await callMcp('kitchen_create_ticket', { intentId, approvedBy: 'owner_telegram' })
      ];

    return res.status(200).json({
      ok: true,
      reply: rejected
        ? `Owner rejected ${intentId}. Customer promise remains blocked.`
        : `Order handoff ${intentId} approved in Telegram. Sandbox POS/kitchen actions may proceed.`,
      evidenceId: `owner_${Date.now().toString(36)}`,
      mcpCalls
    });
  } catch {
    return res.status(502).json({ ok: false, error: 'mcp_owner_action_failed' });
  }
}
