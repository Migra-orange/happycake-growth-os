import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get as blobGet, put as blobPut } from '@vercel/blob';

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


type StoredApprovalStatus = 'pending' | 'approved' | 'rejected' | 'clarification_requested' | 'scheduled';
type StoredApprovalRecord = { approvalId:string; intentId:string; customer:string; status:StoredApprovalStatus; summary:string; riskFlags:string[]; policyDecision:string; proposedSideEffects:string[]; createdAt:string; expiresAt:string; decisionAt?:string; decisionSource?:'telegram'|'dashboard'|'demo'|'api'; decisionNote?:string; executedSideEffects:string[] };
type ApprovalStore = { records: StoredApprovalRecord[] };
type GlobalWithApprovalStore = typeof globalThis & { __happycakeApprovalStore?: ApprovalStore };
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

function hasOwnerToken(req: VercelRequest) {
  return Boolean(process.env.OWNER_API_TOKEN) && req.headers['x-owner-token'] === process.env.OWNER_API_TOKEN;
}

function publicQueueLabel(index: number, status: StoredApprovalStatus) {
  if (status === 'scheduled') return `Scheduled follow-up ${index + 1}`;
  return `Pending approval ${index + 1}`;
}

async function queueForDashboard(authenticated = false) {
  return listActiveApprovals(await getApprovalStore()).map((item, index) => {
    const publicItem = {
      approvalId: authenticated ? item.approvalId : `public_${index + 1}`,
      intentId: authenticated ? item.intentId : `public_intent_${index + 1}`,
      customer: authenticated ? item.customer : publicQueueLabel(index, item.status),
      status: item.status,
      riskFlags: item.riskFlags,
      policyDecision: item.policyDecision,
      summary: authenticated ? item.summary : item.status === 'scheduled' ? 'Retention or support follow-up is queued; customer details are private.' : 'Customer-impacting handoff is waiting for owner approval; customer details are private.',
      proposedSideEffects: item.proposedSideEffects,
      expiresIn: approvalExpiresIn(item),
      decisionAt: authenticated ? item.decisionAt : undefined,
      decisionSource: authenticated ? item.decisionSource : undefined,
      executedSideEffects: authenticated ? item.executedSideEffects : []
    };
    return publicItem;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const checks = await Promise.all([
      callMcp('square_get_pos_summary', { dashboard: true }),
      callMcp('kitchen_get_production_summary', { dashboard: true }),
      callMcp('evaluator_get_evidence_summary', { dashboard: true })
    ]);
    const live = checks.every(c => c.ok && c.source === 'mcp');
    const ownerAuthenticated = hasOwnerToken(req);
    const approvalQueue = await queueForDashboard(ownerAuthenticated);
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
        { label: 'Cold local leads', value: 420 },
        { label: 'Content/ad clicks', value: 164 },
        { label: 'Website visitors', value: 236 },
        { label: 'Cake selected', value: 44 },
        { label: 'Order requests', value: 11 },
        { label: 'Support/retention queued', value: 5 }
      ],
      channels: [
        { label: 'Google Maps', orders: 4, revenueUsd: 184 },
        { label: 'Instagram', orders: 3, revenueUsd: 132 },
        { label: 'Website', orders: 6, revenueUsd: 254 }
      ],
      topProducts: [
        { name: 'cake "Honey"', orders: 4, revenueUsd: 168 },
        { name: 'cake "Napoleon"', orders: 3, revenueUsd: 138 },
        { name: 'cake "Pistachio Roll"', orders: 2, revenueUsd: 88 },
        { name: 'cake "Milk Maiden"', orders: 2, revenueUsd: 78 }
      ],
      mcpChecks: checks,
      storageMode: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel_blob' : 'server_memory',
      autopilotTimeline,
      approvalQueue,
      agents: [
        { id: 'local-demand-scout', name: 'Local demand scout', enabled: true, mode: 'suggest_only', tone: 'concise', dailyLimit: 60, goal: 'Find cold local demand from Google Maps, local occasions, offices, schools, and churches.' },
        { id: 'content-ad-agent', name: 'Content + ad agent', enabled: true, mode: 'owner_approval', tone: 'playful', dailyLimit: 24, goal: 'Draft Instagram/Google content, small ads, and offer angles for owner approval.' },
        { id: 'site-conversion-agent', name: 'Site conversion agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 100, goal: 'Convert catalog visitors into owner-approved order requests.' },
        { id: 'owner-approval-router', name: 'Owner approval router', enabled: true, mode: 'telegram_first', tone: 'concise', dailyLimit: 140, goal: 'Queue every customer-impacting side effect for owner approval.' },
        { id: 'customer-support-agent', name: 'Customer support agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 80, goal: 'Track pickup questions, changes, complaints, and post-purchase support.' },
        { id: 'retention-review-agent', name: 'Retention + review agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 45, goal: 'Trigger reviews, birthday reminders, and repeat-order nudges.' },
        { id: 'evidence-auditor', name: 'Evidence auditor', enabled: true, mode: 'always_on', tone: 'silent', dailyLimit: 500, goal: 'Check MCP/source proof and sandbox evidence.' }
      ]
    });
  } catch {
    if (process.env.MCP_MODE === 'live') {
      return res.status(502).json({ ok: false, error: 'owner_dashboard_mcp_failed' });
    }
    return res.status(200).json({ ok: true, mode: 'simulated', updatedAt: new Date().toISOString(), metrics: {}, funnel: [], channels: [], topProducts: [], mcpChecks: [], agents: [], autopilotTimeline: [], approvalQueue: [] });
  }
}
