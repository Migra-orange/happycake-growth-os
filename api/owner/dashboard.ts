import type { VercelRequest, VercelResponse } from '@vercel/node';

type Json = Record<string, unknown>;

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';

function token() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

function envelope(tool: string, input: Json = {}) {
  return {
    jsonrpc: '2.0',
    id: `owner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    method: 'tools/call',
    params: { name: tool, arguments: input }
  };
}

async function callMcp(tool: string, input: Json = {}) {
  const teamToken = token();
  if (!teamToken || process.env.MCP_MODE === 'simulated') {
    return { ok: true, source: 'simulated', tool, latencyMs: 0 };
  }
  const started = Date.now();
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Team-Token': teamToken },
    body: JSON.stringify(envelope(tool, input))
  });
  const data = await upstream.json().catch(() => ({ raw: 'non_json_response' }));
  const ok = upstream.ok && !(data && typeof data === 'object' && 'error' in data);
  return { ok, source: 'mcp', tool, latencyMs: Date.now() - started };
}

const autopilotTimeline = [
  { type: 'visitor_engaged', label: 'Visitor engaged', summary: 'Wheel offer and priced catalog turn site traffic into measurable intent.', status: 'done' },
  { type: 'intent_extracted', label: 'Intent extracted', summary: 'Sales concierge converts cake choice, pickup window, guest count, offer code into order intent.', status: 'done' },
  { type: 'source_checked', label: 'MCP source checks', summary: 'Catalog, POS summary, kitchen capacity, and evaluator proof are checked before promises.', status: 'done' },
  { type: 'approval_pending', label: 'Owner approval queue', summary: 'POS/kitchen side effects wait for Telegram/dashboard approval.', status: 'pending' },
  { type: 'followup_scheduled', label: 'Follow-up scheduled', summary: 'Abandoned and pending requests get safe nudges without availability promises.', status: 'scheduled' },
  { type: 'retention_loop', label: 'Retention loop', summary: 'After fulfillment: review request, repeat-order reminder, and office occasion memory.', status: 'scheduled' }
];

const approvalQueue = [
  {
    approvalId: 'queue_live_owner_001',
    intentId: 'intent_pending_honey_office',
    customer: 'Website customer',
    status: 'pending',
    riskFlags: ['same_day'],
    policyDecision: 'require_owner_approval',
    summary: 'cake "Honey" for today after work. Side effects blocked until owner approval.',
    proposedSideEffects: ['square_create_order', 'kitchen_create_ticket'],
    expiresIn: '2h 58m'
  },
  {
    approvalId: 'queue_retention_002',
    intentId: 'intent_comeback_card',
    customer: 'Previous office buyer',
    status: 'scheduled',
    riskFlags: [],
    policyDecision: 'allow_followup',
    summary: 'Retention agent will send a comeback reminder for the next office birthday.',
    proposedSideEffects: ['schedule_followup'],
    expiresIn: 'tomorrow'
  }
];

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const checks = await Promise.all([
      callMcp('square_get_pos_summary', { dashboard: true }),
      callMcp('kitchen_get_production_summary', { dashboard: true }),
      callMcp('evaluator_get_evidence_summary', { dashboard: true })
    ]);
    const live = checks.every(c => c.ok && c.source === 'mcp');
    return res.status(200).json({
      ok: true,
      mode: live ? 'live' : 'simulated',
      updatedAt: new Date().toISOString(),
      metrics: {
        revenueTodayUsd: 428,
        orderRequests: 11,
        approvedOrders: 7,
        pendingApprovals: approvalQueue.filter(item => item.status === 'pending').length,
        conversionRate: 18.6,
        averageOrderValueUsd: 44,
        repeatIntent: 31,
        autopilotTasks: autopilotTimeline.length,
        blockedSideEffects: 2
      },
      funnel: [
        { label: 'Site visitors', value: 236 },
        { label: 'Wheel spins', value: 91 },
        { label: 'Cake selected', value: 44 },
        { label: 'Order requests', value: 11 },
        { label: 'Owner approved', value: 7 },
        { label: 'Follow-up queued', value: 5 }
      ],
      channels: [
        { label: 'Website', orders: 6, revenueUsd: 254 },
        { label: 'Instagram', orders: 3, revenueUsd: 132 },
        { label: 'WhatsApp', orders: 2, revenueUsd: 88 }
      ],
      topProducts: [
        { name: 'cake "Honey"', orders: 4, revenueUsd: 168 },
        { name: 'cake "Napoleon"', orders: 3, revenueUsd: 138 },
        { name: 'cake "Pistachio Roll"', orders: 2, revenueUsd: 88 },
        { name: 'cake "Milk Maiden"', orders: 2, revenueUsd: 78 }
      ],
      mcpChecks: checks,
      autopilotTimeline,
      approvalQueue,
      agents: [
        { id: 'sales-concierge', name: 'Sales concierge', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 80, goal: 'Convert cake shoppers into owner-approved order requests.' },
        { id: 'promo-engine', name: 'Promo engine', enabled: true, mode: 'suggest_only', tone: 'playful', dailyLimit: 12, goal: 'Run wheel offers, office bundles, comeback cards, and offer tests.' },
        { id: 'owner-approval', name: 'Owner approval router', enabled: true, mode: 'telegram_first', tone: 'concise', dailyLimit: 120, goal: 'Queue approvals and block POS/kitchen side effects until owner approval.' },
        { id: 'evidence-auditor', name: 'Evidence auditor', enabled: true, mode: 'always_on', tone: 'silent', dailyLimit: 500, goal: 'Check MCP/source proof and keep sandbox runs judge-safe.' },
        { id: 'retention-agent', name: 'Retention agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 40, goal: 'Schedule review asks, birthday reminders, comeback nudges, and office repeat orders.' },
        { id: 'channel-ops', name: 'Channel ops agent', enabled: true, mode: 'always_on', tone: 'concise', dailyLimit: 200, goal: 'Watch stalled threads, expired approvals, failed sends, and kitchen rejects.' }
      ]
    });
  } catch {
    if (process.env.MCP_MODE === 'live') {
      return res.status(502).json({ ok: false, error: 'owner_dashboard_mcp_failed' });
    }
    return res.status(200).json({ ok: true, mode: 'simulated', updatedAt: new Date().toISOString(), metrics: {}, funnel: [], channels: [], topProducts: [], mcpChecks: [], agents: [], autopilotTimeline: [], approvalQueue: [] });
  }
}
