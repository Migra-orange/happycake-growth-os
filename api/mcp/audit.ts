import type { VercelRequest, VercelResponse } from '@vercel/node';

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';

const readTools = [
  'square_list_catalog',
  'square_get_pos_summary',
  'kitchen_get_production_summary',
  'world_get_scenario_summary',
  'evaluator_get_evidence_summary'
] as const;

const scenarioTools = [
  'world_start_scenario',
  'marketing_create_campaign',
  'marketing_launch_simulated_campaign',
  'marketing_generate_leads',
  'world_next_event',
  'world_advance_time',
  'marketing_report_to_owner',
  'evaluator_score_world_scenario',
  'evaluator_generate_team_report'
] as const;

function token() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

function mcpEnvelope(tool: string, input: Record<string, unknown>) {
  return {
    jsonrpc: '2.0',
    id: `hc_audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    method: 'tools/call',
    params: { name: tool, arguments: input }
  };
}

function jsonRpcError(data: Record<string, unknown>) {
  const maybeError = data?.error;
  if (!maybeError || typeof maybeError !== 'object') return undefined;
  const error = maybeError as Record<string, unknown>;
  return { code: error.code, message: error.message };
}

async function callMcp(tool: string, input: Record<string, unknown>) {
  const started = Date.now();
  const teamToken = token();
  if (!teamToken) throw new Error('mcp_token_missing');

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Team-Token': teamToken },
    body: JSON.stringify(mcpEnvelope(tool, input))
  });
  const data = await upstream.json().catch(() => ({ raw: 'non_json_response' })) as Record<string, unknown>;
  const error = jsonRpcError(data);
  const ok = upstream.ok && !error;
  return {
    ok,
    source: 'mcp',
    tool,
    httpStatus: upstream.status,
    latencyMs: Date.now() - started,
    error,
    resultKeys: data?.result && typeof data.result === 'object' ? Object.keys(data.result as Record<string, unknown>).slice(0, 12) : [],
    data
  };
}

function inputFor(tool: string, runId: string, scenarioId: string, campaignId: string) {
  const base = { runId, scenarioId, campaignId, channel: 'website', source: 'happycake-growth-os-audit' };
  switch (tool) {
    case 'world_start_scenario':
      return { ...base, scenario: 'happycake_growth_os_audit', compressedTime: true };
    case 'marketing_create_campaign':
      return { ...base, name: 'Office birthday audit campaign', budgetUsd: 25, audience: 'Sugar Land office coordinators', ownerApprovalRequired: true };
    case 'marketing_launch_simulated_campaign':
      return { ...base, approvedByOwner: true };
    case 'marketing_generate_leads':
      return { ...base, count: 2, leadType: 'office_birthday' };
    case 'world_next_event':
      return { ...base };
    case 'world_advance_time':
      return { ...base, minutes: 60 };
    case 'marketing_report_to_owner':
      return { ...base, summary: 'Audit report: campaign, lead, order intent, POS and kitchen handoff path checked.' };
    case 'evaluator_score_world_scenario':
      return { ...base };
    case 'evaluator_generate_team_report':
      return { ...base, team: 'happycake-growth-os' };
    case 'evaluator_get_evidence_summary':
      return { ...base };
    case 'square_get_pos_summary':
      return { ...base };
    case 'kitchen_get_production_summary':
      return { ...base, urgency: 'same_day' };
    default:
      return { ...base };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (process.env.MCP_MODE === 'simulated') return res.status(409).json({ ok: false, error: 'simulated_mode_active' });

  const runScenario = req.method === 'POST' && req.body?.confirm === 'happycake-sandbox-audit';
  const runId = `audit_${Date.now().toString(36)}`;
  const scenarioId = `scenario_${runId}`;
  const campaignId = `campaign_${runId}`;
  const tools = runScenario ? [...readTools, ...scenarioTools] : [...readTools];

  try {
    const calls = [];
    for (const tool of tools) {
      calls.push(await callMcp(tool, inputFor(tool, runId, scenarioId, campaignId)));
    }
    const failures = calls.filter((call) => !call.ok);
    return res.status(failures.length ? 502 : 200).json({
      ok: failures.length === 0,
      mode: 'live',
      usedFallback: false,
      runScenario,
      runId,
      totalCalls: calls.length,
      failures: failures.map((call) => ({ tool: call.tool, httpStatus: call.httpStatus, error: call.error })),
      calls: calls.map(({ data, ...safe }) => safe)
    });
  } catch {
    return res.status(502).json({ ok: false, mode: 'live', usedFallback: false, error: 'mcp_audit_failed' });
  }
}
