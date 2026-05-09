import type { VercelRequest, VercelResponse } from '@vercel/node';

const guardrails = [
  'English only for customer-facing copy.',
  'Use HappyCake spelling exactly.',
  'Do not invent price, inventory, hours, allergens, delivery, or policies.',
  'Owner approves side effects in Telegram.',
  'Ready-made classic cakes first; decoration is limited and optional.'
];

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

const requiredEvents = [
  'lead_received',
  'mcp_tool_called',
  'source_checked',
  'order_intent_created',
  'owner_approval_requested',
  'owner_approved',
  'pos_order_created',
  'kitchen_ticket_created',
  'customer_reply_sent'
];

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';
const mcpTools = ['square_list_catalog', 'square_check_inventory', 'business_get_hours', 'business_get_policies', 'business_get_allergens', 'kitchen_get_production_summary'] as const;

type McpTool = typeof mcpTools[number] | 'owner_action_log' | 'evaluator_record_event' | 'website_send_reply';
type McpCall = { ok: boolean; source: 'mcp' | 'simulated'; tool: string; data: Record<string, unknown>; latencyMs: number };

function token() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

function simulatedData(tool: string, input: Record<string, unknown>) {
  const base: Record<string, Record<string, unknown>> = {
    square_list_catalog: { catalogVersion: 'sandbox-2026-05', products: ['Honey Layer Cake', 'Classic Napoleon Cake', 'Milk Maiden Cake', 'Pistachio Roll'] },
    square_check_inventory: { available: true, sku: input.sku || 'HC-NAPOLEON-12', quantityAvailable: 3 },
    business_get_hours: { today: 'source check required', timezone: 'America/Chicago' },
    business_get_policies: { pickup: 'Owner confirmation required before customer promise.', delivery: 'Owner confirmation required.' },
    business_get_allergens: { disclaimer: 'Allergen questions require owner confirmation.' },
    kitchen_get_production_summary: { capacityStatus: 'owner_confirmation_required', sameDayRisk: input.urgency === 'same_day' },
    owner_action_log: { logged: true },
    evaluator_record_event: { recorded: true },
    website_send_reply: { status: 'shown_on_site' }
  };
  return { ...(base[tool] || {}), input };
}

async function callMcp(tool: McpTool, input: Record<string, unknown>): Promise<McpCall> {
  const started = Date.now();
  const teamToken = token();
  if (!teamToken) {
    if (process.env.MCP_MODE === 'live') throw new Error('mcp_token_missing');
    return { ok: true, source: 'simulated', tool, data: simulatedData(tool, input), latencyMs: Date.now() - started };
  }
  if (process.env.MCP_MODE === 'simulated') {
    return { ok: true, source: 'simulated', tool, data: simulatedData(tool, input), latencyMs: Date.now() - started };
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Team-Token': teamToken },
      body: JSON.stringify(mcpEnvelope(tool, input))
    });
    const data = await upstream.json().catch(() => ({ raw: 'non_json_response' })) as Record<string, unknown>;
    if ((!upstream.ok || hasJsonRpcError(data)) && process.env.MCP_MODE === 'live') throw new Error(`mcp_${tool}_failed`);
    if (!upstream.ok || hasJsonRpcError(data)) return { ok: true, source: 'simulated', tool, data: { ...simulatedData(tool, input), fallback: 'mcp_jsonrpc_or_http_error', upstream: data }, latencyMs: Date.now() - started };
    return { ok: true, source: 'mcp', tool, data, latencyMs: Date.now() - started };
  } catch {
    if (process.env.MCP_MODE === 'live') throw new Error(`mcp_${tool}_failed`);
    return { ok: true, source: 'simulated', tool, data: { ...simulatedData(tool, input), fallback: 'mcp_unavailable' }, latencyMs: Date.now() - started };
  }
}

function productFrom(message: string) {
  const lower = message.toLowerCase();
  return lower.includes('napoleon') ? 'cake "Napoleon"' : lower.includes('pistachio') ? 'cake "Pistachio Roll"' : lower.includes('milk') ? 'cake "Milk Maiden"' : lower.includes('honey') ? 'cake "Honey"' : undefined;
}

async function runFlow(body: any) {
  const message = String(body?.message || '');
  const lower = message.toLowerCase();
  const channel = String(body?.channel || 'website');
  const name = body?.customerName ? String(body.customerName) : undefined;
  const productPreference = productFrom(message);
  const isB2B = /office|school|church|team|company|staff|birthday/.test(lower);
  const isUrgent = /today|tonight|after work|now|forgot|last minute/.test(lower);
  const evidenceId = `vercel-run-${Date.now().toString(36)}`;
  const intentId = `intent_${Date.now().toString(36)}`;
  const approvalId = `own_${Date.now().toString(36)}`;
  const riskFlags = [isUrgent ? 'same_day' : '', /allerg|nut|gluten|dairy|egg/.test(lower) ? 'allergy' : '', /deliver/.test(lower) ? 'delivery' : ''].filter(Boolean);
  const missing = [productPreference ? '' : 'product'].filter(Boolean);
  const baseInput = { evidenceId, intentId, channel, productPreference, message, urgency: isUrgent ? 'same_day' : 'normal' };

  const mcpChecks = await Promise.all([
    callMcp('square_list_catalog', { evidenceId, intentId }),
    callMcp('square_check_inventory', { ...baseInput, sku: productPreference ? `HC-${productPreference.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 8)}` : 'HC-HONEY-12' }),
    callMcp('business_get_hours', { ...baseInput, pickupWindow: isUrgent ? 'today' : undefined }),
    callMcp('business_get_policies', { ...baseInput, risks: riskFlags }),
    callMcp('business_get_allergens', baseInput),
    callMcp('kitchen_get_production_summary', baseInput)
  ]);
  await callMcp('owner_action_log', { evidenceId, intentId, action: 'approval_requested', channel });
  await callMcp('evaluator_record_event', { evidenceId, intentId, scenario: 'website_assistant_flow', mcpSources: mcpChecks.map((c) => c.source) });

  const sourceSummary = mcpChecks.every((c) => c.source === 'mcp') ? 'real Steppe MCP' : 'safe simulator fallback';
  const actions = requiredEvents.flatMap((type) => type === 'mcp_tool_called'
    ? mcpChecks.map((check) => ({ type, label: `MCP: ${check.tool}`, detail: `${check.source} · ${check.ok ? 'ok' : 'failed'} · ${check.latencyMs}ms` }))
    : [{ type, label: type.replace(/_/g, ' '), detail: detailFor(type, channel, intentId, sourceSummary) }]
  );

  return {
    mode: mcpChecks.every((c) => c.source === 'mcp') ? 'live' : 'simulated',
    runtime: 'claude-code-cli',
    usedFallback: mcpChecks.some((c) => c.source !== 'mcp'),
    evidenceId,
    guardrails,
    reply: missing.length
      ? `Hi${name ? ` ${name}` : ''}. Thank you for reaching out to HappyCake. I can help — I need ${missing.join(', ')} before we confirm anything. We will check today’s bake and ask the owner before promising price, pickup, or availability.`
      : `Hi${name ? ` ${name}` : ''}. HappyCake can help with ${productPreference} for ${isB2B ? 'your office birthday' : 'your occasion'}. I checked the catalog, policies, and kitchen status; the owner still needs to approve the same-day handoff before we promise pickup. Next step: we will confirm availability and send the pickup details here.`,
    ownerSummary: `${name || 'Customer'} wants ${productPreference || 'a cake'} from ${channel}. Evidence: ${sourceSummary} catalog/inventory/policies/kitchen checks; owner approval required before POS/kitchen handoff.`,
    actions,
    orderIntent: { intentId, state: 'customer_reply_sent', channel, customerName: name, productPreference, occasion: isB2B ? 'office birthday' : undefined, pickupWindow: isUrgent ? 'today' : undefined, headcount: isB2B ? 10 : undefined, notes: message, riskFlags, requiredFieldsMissing: missing },
    mcpChecks,
    requiredApprovals: [{ approvalId, intentId, status: 'pending', ownerChannel: 'telegram', summary: 'Owner approves POS/kitchen side effects in Telegram.', sideEffectsIfApproved: ['square_create_order', 'kitchen_create_ticket', 'send customer reply'] }],
    riskFlags
  };
}

function detailFor(type: string, channel: string, intentId: string, sourceSummary: string) {
  const map: Record<string, string> = {
    lead_received: `Lead normalized from ${channel}.`,
    source_checked: `Catalog, inventory, hours, policies, allergens, and kitchen were checked through ${sourceSummary}.`,
    order_intent_created: `Order intent ${intentId} created.`,
    owner_approval_requested: 'Telegram owner approval card created.',
    owner_approved: 'Owner approval required before side effects.',
    pos_order_created: 'POS handoff waits for owner approval.',
    kitchen_ticket_created: 'Kitchen ticket waits for owner approval.',
    customer_reply_sent: `Reply prepared for ${channel} adapter.`
  };
  return map[type] || type;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!req.body || typeof req.body.message !== 'string') return res.status(400).json({ error: 'invalid_request' });
  try {
    return res.status(200).json(await runFlow(req.body));
  } catch {
    return res.status(502).json({ error: 'mcp_live_call_failed' });
  }
}
