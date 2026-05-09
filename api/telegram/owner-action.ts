import type { VercelRequest, VercelResponse } from '@vercel/node';

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';

function token() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

function mcpEnvelope(tool: string, input: Record<string, unknown>) {
  return {
    jsonrpc: '2.0',
    id: `hc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    method: 'tools/call',
    params: { name: tool, arguments: input }
  };
}

function hasJsonRpcError(data: Record<string, unknown>) {
  return Boolean(data && typeof data === 'object' && 'error' in data);
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
    body: JSON.stringify(mcpEnvelope(tool, input))
  });
  const data = await upstream.json().catch(() => ({ raw: 'non_json_response' })) as Record<string, unknown>;
  if ((!upstream.ok || hasJsonRpcError(data)) && process.env.MCP_MODE === 'live') throw new Error(`mcp_${tool}_failed`);
  if (!upstream.ok || hasJsonRpcError(data)) return { ok: true, source: 'simulated', tool, latencyMs: Date.now() - started, data };
  return { ok: true, source: 'mcp', tool, latencyMs: Date.now() - started, data };
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
