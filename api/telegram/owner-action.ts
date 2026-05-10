import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get as blobGet, put as blobPut } from '@vercel/blob';

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


async function ensureApprovalRecord(body: any, intentId: string) {
  const approvalId = String(body?.approvalId || intentId);
  const store = await getApprovalStore();
  const found = findApproval(store, approvalId) || findApproval(store, intentId);
  if (found) return { store, approval: found };
  const approval = upsertApprovalRecord(store, {
    approvalId,
    intentId,
    customer: String(body?.customer || 'Website customer'),
    status: 'pending',
    summary: String(body?.note || 'Owner approval required before POS/kitchen handoff.'),
    riskFlags: Array.isArray(body?.riskFlags) ? body.riskFlags.map(String) : [],
    policyDecision: 'require_owner_approval',
    proposedSideEffects: ['square_create_order', 'kitchen_create_ticket'],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString()
  });
  await saveApprovalStore(store);
  return { store, approval };
}

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
    const { store, approval } = await ensureApprovalRecord(req.body, intentId);
    const mcpCalls = rejected
      ? [await callMcp('marketing_report_to_owner', { intentId, approvalId: approval.approvalId, action: 'rejected', note: req.body?.note || '' })]
      : [
        await callMcp('marketing_report_to_owner', { intentId, approvalId: approval.approvalId, action: 'approved', note: req.body?.note || '' }),
        await callMcp('square_create_order', { intentId, approvalId: approval.approvalId, approvedBy: 'owner_telegram' }),
        await callMcp('kitchen_create_ticket', { intentId, approvalId: approval.approvalId, approvedBy: 'owner_telegram' })
      ];
    const decidedApproval = rejected
      ? rejectRecord(store, approval.approvalId, String(req.body?.note || ''), 'telegram')
      : approveRecord(store, approval.approvalId, mcpCalls.map((call) => call.tool), 'telegram');
    await saveApprovalStore(store);

    return res.status(200).json({
      ok: true,
      reply: rejected
        ? `Owner rejected ${intentId}. Customer promise remains blocked.`
        : `Order handoff ${intentId} approved in Telegram. Sandbox POS/kitchen actions may proceed.`,
      evidenceId: `owner_${Date.now().toString(36)}`,
      approval: decidedApproval,
      mcpCalls
    });
  } catch {
    return res.status(502).json({ ok: false, error: 'mcp_owner_action_failed' });
  }
}
