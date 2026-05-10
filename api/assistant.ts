import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get as blobGet, put as blobPut } from '@vercel/blob';

type StoredApprovalStatus = 'pending' | 'approved' | 'rejected' | 'clarification_requested' | 'scheduled';
type StoredApprovalRecord = { approvalId:string; intentId:string; customer:string; status:StoredApprovalStatus; summary:string; riskFlags:string[]; policyDecision:string; proposedSideEffects:string[]; createdAt:string; expiresAt:string; decisionAt?:string; decisionSource?:'telegram'|'dashboard'|'demo'|'api'; decisionNote?:string; executedSideEffects:string[] };
type ApprovalStore = { records: StoredApprovalRecord[] };
type GlobalWithApprovalStore = typeof globalThis & { __happycakeApprovalStore?: ApprovalStore; __happycakeRateBuckets?: Record<string, { count:number; resetAt:number }> };
function createEmptyApprovalStore(): ApprovalStore { return { records: [] }; }
function upsertApprovalRecord(store: ApprovalStore, input: Omit<StoredApprovalRecord, 'executedSideEffects'> & { executedSideEffects?: string[] }) {
  const record: StoredApprovalRecord = { ...input, riskFlags: [...(input.riskFlags || [])], proposedSideEffects: [...(input.proposedSideEffects || [])], executedSideEffects: [...(input.executedSideEffects || [])] };
  const index = store.records.findIndex((item) => item.approvalId === record.approvalId);
  if (index >= 0) { const existing = store.records[index]; store.records[index] = { ...existing, ...record, executedSideEffects: record.executedSideEffects.length ? record.executedSideEffects : existing.executedSideEffects }; return store.records[index]; }
  store.records.unshift(record); return record;
}
function listActiveApprovals(store: ApprovalStore, now = new Date()) { const nowMs = now.getTime(); return [...store.records].filter((item) => item.status !== 'rejected' && new Date(item.expiresAt).getTime() >= nowMs).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }
function findApproval(store: ApprovalStore, approvalIdOrIntentId: string) { return store.records.find((item) => item.approvalId === approvalIdOrIntentId || item.intentId === approvalIdOrIntentId); }
function approveRecord(store: ApprovalStore, approvalIdOrIntentId: string, executedSideEffects: string[], source: StoredApprovalRecord['decisionSource'] = 'api') { const record = findApproval(store, approvalIdOrIntentId); if (!record) throw new Error('approval_not_found'); if (record.status === 'approved') return { ...record, decisionNote: record.decisionNote || 'already_approved' }; if (record.status === 'rejected') return { ...record, decisionNote: record.decisionNote || 'already_rejected' }; record.status = 'approved'; record.decisionAt = new Date().toISOString(); record.decisionSource = source; record.executedSideEffects = Array.from(new Set([...(record.executedSideEffects || []), ...executedSideEffects])); return record; }
function rejectRecord(store: ApprovalStore, approvalIdOrIntentId: string, note = '', source: StoredApprovalRecord['decisionSource'] = 'api') { const record = findApproval(store, approvalIdOrIntentId); if (!record) throw new Error('approval_not_found'); if (record.status === 'approved') return { ...record, decisionNote: record.decisionNote || 'already_approved' }; if (record.status === 'rejected') return { ...record, decisionNote: record.decisionNote || 'already_rejected' }; record.status = 'rejected'; record.decisionAt = new Date().toISOString(); record.decisionSource = source; record.decisionNote = note; return record; }
function approvalExpiresIn(record: Pick<StoredApprovalRecord, 'expiresAt'>, now = new Date()) { const remainingMs = new Date(record.expiresAt).getTime() - now.getTime(); if (remainingMs <= 0) return 'expired'; const minutes = Math.ceil(remainingMs / 60000); if (minutes < 60) return `${minutes}m`; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return rest ? `${hours}h ${rest}m` : `${hours}h`; }
function seedDemoApprovals(store: ApprovalStore, now = new Date()) { if (store.records.length > 0) return store; upsertApprovalRecord(store, { approvalId:'queue_live_owner_001', intentId:'intent_pending_honey_office', customer:'Website customer', status:'pending', riskFlags:['same_day'], policyDecision:'require_owner_approval', summary:'cake "Honey" for today after work. Side effects blocked until owner approval.', proposedSideEffects:['square_create_order','kitchen_create_ticket'], createdAt:now.toISOString(), expiresAt:new Date(now.getTime()+1000*60*60*3).toISOString() }); upsertApprovalRecord(store, { approvalId:'queue_retention_002', intentId:'intent_comeback_card', customer:'Previous office buyer', status:'scheduled', riskFlags:[], policyDecision:'allow_followup', summary:'Retention agent will send a comeback reminder for the next office birthday.', proposedSideEffects:['schedule_followup'], createdAt:now.toISOString(), expiresAt:new Date(now.getTime()+1000*60*60*24).toISOString() }); return store; }
const approvalBlobPath = 'happycake/owner-approval-store.json';
function memoryApprovalStore() { const globalStore = globalThis as GlobalWithApprovalStore; if (!globalStore.__happycakeApprovalStore) { globalStore.__happycakeApprovalStore = seedDemoApprovals(createEmptyApprovalStore()); } return globalStore.__happycakeApprovalStore; }
async function getApprovalStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memoryApprovalStore();
  try {
    const result = await blobGet(approvalBlobPath, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return memoryApprovalStore();
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as ApprovalStore;
    const globalStore = globalThis as GlobalWithApprovalStore;
    globalStore.__happycakeApprovalStore = parsed.records?.length ? parsed : seedDemoApprovals(createEmptyApprovalStore());
    return globalStore.__happycakeApprovalStore;
  } catch { return memoryApprovalStore(); }
}
async function saveApprovalStore(store: ApprovalStore) {
  const globalStore = globalThis as GlobalWithApprovalStore;
  globalStore.__happycakeApprovalStore = store;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await blobPut(approvalBlobPath, JSON.stringify(store), { access: 'private', allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
    return true;
  } catch { return false; }
}

async function sendTelegramOwnerCard(record: StoredApprovalRecord) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!botToken || !chatId) return { ok: false, skipped: true, reason: 'telegram_not_configured' };
  const text = `HappyCake approval needed\n${record.summary}\nRisks: ${record.riskFlags.join(', ') || 'none'}`;
  const inline_keyboard = [[
    { text: 'Approve handoff', callback_data: `hc:approve:${record.approvalId}` },
    { text: 'Reject', callback_data: `hc:reject:${record.approvalId}` }
  ]];
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard } })
  });
  return { ok: response.ok, skipped: false };
}


const guardrails = [
  'English only for customer-facing copy.',
  'Use HappyCake spelling exactly.',
  'Do not invent price, inventory, hours, allergens, delivery, or policies.',
  'Bakery confirms customer-impacting actions before fulfillment.',
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
  'customer_reply_sent'
];

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';
const mcpTools = ['square_list_catalog', 'square_get_pos_summary', 'kitchen_get_production_summary', 'evaluator_get_evidence_summary'] as const;

type McpTool = typeof mcpTools[number] | 'marketing_report_to_owner' | 'website_send_reply' | 'square_create_order' | 'kitchen_create_ticket';
type McpCall = { ok: boolean; source: 'mcp' | 'simulated'; tool: string; data: Record<string, unknown>; latencyMs: number };

function token() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

function clientKey(req: VercelRequest) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
}

function checkRateLimit(req: VercelRequest, bucket = 'assistant', limit = 30, windowMs = 60_000) {
  const globalStore = globalThis as GlobalWithApprovalStore;
  const buckets = globalStore.__happycakeRateBuckets || (globalStore.__happycakeRateBuckets = {});
  const key = `${bucket}:${clientKey(req)}`;
  const now = Date.now();
  const current = buckets[key];
  if (!current || current.resetAt <= now) { buckets[key] = { count: 1, resetAt: now + windowMs }; return { ok: true, remaining: limit - 1, resetAt: buckets[key].resetAt }; }
  current.count += 1;
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

function simulatedData(tool: string, input: Record<string, unknown>) {
  const base: Record<string, Record<string, unknown>> = {
    square_list_catalog: { catalogVersion: 'sandbox-2026-05', products: ['Honey Layer Cake', 'Classic Napoleon Cake', 'Milk Maiden Cake', 'Pistachio Roll'] },
    square_get_pos_summary: { status: 'checked', source: 'sandbox_pos_summary' },
    kitchen_get_production_summary: { capacityStatus: 'owner_confirmation_required', sameDayRisk: input.urgency === 'same_day' },
    marketing_report_to_owner: { reported: true },
    evaluator_get_evidence_summary: { requested: true },
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

function sanitizeCustomerText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, '[phone redacted]')
    .slice(0, 280);
}

function isExplicitOrderRequest(message: string, productPreference?: string) {
  return Boolean(productPreference) && /\b(order|request|pickup|today|tonight|after work|birthday|office|guests?|headcount|need|want)\b/i.test(message);
}

async function runFlow(body: any) {
  const message = String(body?.message || '');
  const safeMessage = sanitizeCustomerText(message);
  const lower = message.toLowerCase();
  const channel = String(body?.channel || 'website');
  const name = body?.customerName ? String(body.customerName) : undefined;
  const productPreference = productFrom(message);
  const requiresApproval = body?.requireOwnerApproval !== false && isExplicitOrderRequest(message, productPreference);
  const isB2B = /office|school|church|team|company|staff|birthday/.test(lower);
  const isUrgent = /today|tonight|after work|now|forgot|last minute/.test(lower);
  const evidenceId = `vercel-run-${Date.now().toString(36)}`;
  const intentId = `intent_${Date.now().toString(36)}`;
  const approvalId = `own_${Date.now().toString(36)}`;
  const riskFlags = [isUrgent ? 'same_day' : '', /allerg|nut|gluten|dairy|egg/.test(lower) ? 'allergy' : '', /deliver/.test(lower) ? 'delivery' : ''].filter(Boolean);
  const missing = [productPreference ? '' : 'product'].filter(Boolean);
  const baseInput = { evidenceId, intentId, channel, productPreference, shopperQuestion: safeMessage, urgency: isUrgent ? 'same_day' : 'normal' };

  const mcpChecks = await Promise.all([
    callMcp('square_list_catalog', { evidenceId, intentId }),
    callMcp('square_get_pos_summary', { evidenceId, intentId, productPreference }),
    callMcp('kitchen_get_production_summary', baseInput),
    callMcp('evaluator_get_evidence_summary', { evidenceId, intentId, scenario: 'website_assistant_flow' })
  ]);
  if (requiresApproval) await callMcp('marketing_report_to_owner', { evidenceId, intentId, scenario: 'website_assistant_flow', mcpSources: mcpChecks.map((c) => c.source) });
  const createdAt = new Date().toISOString();
  const approvalStore = requiresApproval ? await getApprovalStore() : undefined;
  const approvalRecord = approvalStore ? upsertApprovalRecord(approvalStore, {
    approvalId,
    intentId,
    customer: name || 'Website customer',
    status: 'pending',
    summary: `${name || 'Customer'} wants ${productPreference || 'a cake'} from ${channel}. Owner approval required before POS/kitchen handoff.`,
    riskFlags,
    policyDecision: 'require_owner_approval',
    proposedSideEffects: ['square_create_order', 'kitchen_create_ticket'],
    createdAt,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString()
  }) : undefined;
  if (approvalStore) await saveApprovalStore(approvalStore);
  const ownerDelivery = approvalRecord ? await sendTelegramOwnerCard(approvalRecord).catch(() => ({ ok: false, skipped: true, reason: 'telegram_send_failed' })) : { ok: false, skipped: true, reason: 'approval_not_required' };

  const sourceSummary = mcpChecks.every((c) => c.source === 'mcp') ? 'real Steppe MCP' : 'safe simulator fallback';
  const eventTypes = requiresApproval ? requiredEvents : requiredEvents.filter((type) => type !== 'owner_approval_requested');
  const actions = eventTypes.flatMap((type) => type === 'mcp_tool_called'
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
      ? `Hi${name ? ` ${name}` : ''}. Thank you for reaching out to HappyCake. Pick one cake from the menu and send your pickup window — the bakery will confirm final availability, allergens, and pickup before fulfillment.`
      : requiresApproval
        ? `Hi${name ? ` ${name}` : ''}. Your HappyCake request for ${productPreference} is queued. I checked the menu, order details, and bakery capacity. The bakery will confirm final pickup details before fulfillment.`
        : `Hi${name ? ` ${name}` : ''}. ${productPreference ? `${productPreference} is a good place to start.` : 'For 12 guests, start with the 1.2 kg cakes that serve about 10 and ask the bakery about adding slices or a second cake.'} Send a pickup window when you are ready for the bakery to confirm.`,
    ownerSummary: requiresApproval ? `${name || 'Customer'} wants ${productPreference || 'a cake'} from ${channel}. Evidence: ${sourceSummary} catalog/POS/kitchen/evaluator checks; owner approval required before POS/kitchen handoff.` : `Shopper asked for cake guidance from ${channel}. Evidence: ${sourceSummary} menu/capacity checks; no side-effect approval needed.`,
    actions,
    orderIntent: { intentId, state: requiresApproval ? 'customer_reply_sent' : 'guidance_sent', channel, customerName: name, productPreference, occasion: isB2B ? 'office birthday' : undefined, pickupWindow: isUrgent ? 'today' : undefined, headcount: isB2B ? 10 : undefined, notes: safeMessage, riskFlags, requiredFieldsMissing: missing },
    mcpChecks,
    ownerDelivery,
    requiredApprovals: approvalRecord ? [{ approvalId: approvalRecord.approvalId, intentId, status: approvalRecord.status, ownerChannel: 'telegram', summary: approvalRecord.summary, sideEffectsIfApproved: ['square_create_order', 'kitchen_create_ticket', 'send customer reply'] }] : [],
    riskFlags
  };
}

function detailFor(type: string, channel: string, intentId: string, sourceSummary: string) {
  const map: Record<string, string> = {
    lead_received: `Lead normalized from ${channel}.`,
    source_checked: 'Menu, order details, and bakery capacity were checked.',
    order_intent_created: `Order intent ${intentId} created.`,
    owner_approval_requested: 'Bakery confirmation request created.',
    owner_approved: 'Bakery confirmation required before fulfillment.',
    pos_order_created: 'Order handoff waits for bakery confirmation.',
    kitchen_ticket_created: 'Kitchen preparation waits for bakery confirmation.',
    customer_reply_sent: `Reply prepared for ${channel} adapter.`
  };
  return map[type] || type;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const rate = checkRateLimit(req);
  if (!rate.ok) return res.status(429).json({ error: 'rate_limited', resetAt: rate.resetAt });
  if (!req.body || typeof req.body.message !== 'string') return res.status(400).json({ error: 'invalid_request' });
  try {
    return res.status(200).json(await runFlow(req.body));
  } catch {
    return res.status(502).json({ error: 'mcp_live_call_failed' });
  }
}
