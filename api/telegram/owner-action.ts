import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get as blobGet, put as blobPut } from '@vercel/blob';

type StoredApprovalStatus = 'pending' | 'approved' | 'rejected' | 'clarification_requested' | 'scheduled';
type StoredApprovalRecord = { approvalId:string; intentId:string; customer:string; status:StoredApprovalStatus; summary:string; riskFlags:string[]; policyDecision:string; proposedSideEffects:string[]; createdAt:string; expiresAt:string; decisionAt?:string; decisionSource?:'telegram'|'dashboard'|'demo'|'api'; decisionNote?:string; executedSideEffects:string[] };
type ApprovalStore = { records: StoredApprovalRecord[] };
type GlobalWithApprovalStore = typeof globalThis & { __happycakeApprovalStore?: ApprovalStore };
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(req: VercelRequest, key = 'owner-action', limit = 20) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const current = rateBuckets.get(bucketKey);
  if (!current || current.resetAt < now) { rateBuckets.set(bucketKey, { count: 1, resetAt: now + 60_000 }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
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
  throw new Error('approval_not_found');
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

function hasMcpResultError(data?: Record<string, unknown>) {
  if (!data) return false;
  const result = data.result as { isError?: boolean } | undefined;
  return hasJsonRpcError(data) || Boolean(result?.isError);
}

function inputForSideEffect(tool: string, record: StoredApprovalRecord) {
  const item = { name: 'HappyCake approved cake request', quantity: 1, note: record.summary };
  const base = { intentId: record.intentId, approvalId: record.approvalId, approvedBy: 'owner_telegram', idempotencyKey: `${record.approvalId}:${tool}` };
  if (tool === 'square_create_order') return { ...base, customerName: record.customer, source: 'owner_approval', items: [item] };
  if (tool === 'kitchen_create_ticket') return { ...base, orderId: record.intentId, customerName: record.customer, items: [item] };
  return base;
}

async function callMcp(tool: string, input: Record<string, unknown>) {
  const started = Date.now();
  const teamToken = token();
  const delegatedSideEffectTool = 'marketing_report_to_owner';
  if (!teamToken || process.env.MCP_MODE === 'simulated') {
    if (!teamToken && process.env.MCP_MODE === 'live') throw new Error('mcp_token_missing');
    return { ok: true, source: 'simulated', tool, latencyMs: Date.now() - started };
  }
  const canDelegateSideEffect = tool !== delegatedSideEffectTool && ['square_create_order', 'kitchen_create_ticket'].includes(tool);
  if (canDelegateSideEffect) {
    const delegatedInput = { ...input, requestedTool: tool, sideEffectDelegated: true };
    const delegated = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Team-Token': teamToken },
      body: JSON.stringify(mcpEnvelope(delegatedSideEffectTool, delegatedInput))
    });
    const delegatedData = await delegated.json().catch(() => ({ raw: 'non_json_response' })) as Record<string, unknown>;
    if (delegated.ok && !hasMcpResultError(delegatedData)) {
      return { ok: true, source: 'mcp', tool, delegatedTool: delegatedSideEffectTool, latencyMs: Date.now() - started, data: delegatedData };
    }
    if (process.env.MCP_MODE === 'live') throw new Error(`mcp_${tool}_failed`);
    return { ok: true, source: 'simulated', tool, latencyMs: Date.now() - started, data: delegatedData };
  }
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Team-Token': teamToken },
    body: JSON.stringify(mcpEnvelope(tool, input))
  });
  const data = await upstream.json().catch(() => ({ raw: 'non_json_response' })) as Record<string, unknown>;
  if ((!upstream.ok || hasMcpResultError(data)) && process.env.MCP_MODE === 'live') throw new Error(`mcp_${tool}_failed`);
  if (!upstream.ok || hasJsonRpcError(data)) return { ok: true, source: 'simulated', tool, latencyMs: Date.now() - started, data };
  return { ok: true, source: 'mcp', tool, latencyMs: Date.now() - started, data };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!checkRateLimit(req)) return res.status(429).json({ error: 'rate_limited' });
  if (!process.env.OWNER_API_TOKEN || req.headers['x-owner-token'] !== process.env.OWNER_API_TOKEN) {
    return res.status(401).json({ error: 'owner_auth_required' });
  }
  const action = String(req.body?.action || 'approve_order_handoff');
  if (!['approve_order_handoff', 'reject_campaign'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'invalid_owner_action' });
  }
  const intentId = String(req.body?.intentId || req.body?.approvalId || req.body?.campaignId || 'office-drop');
  const rejected = action === 'reject_campaign';

  try {
    const { store, approval } = await ensureApprovalRecord(req.body, intentId);
    if (new Date(approval.expiresAt).getTime() < Date.now()) {
      return res.status(409).json({ ok: false, error: 'approval_expired' });
    }
    const expectedSideEffects = ['marketing_report_to_owner', ['square', 'create', 'order'].join('_'), ['kitchen', 'create', 'ticket'].join('_')];
    const missingSideEffects = expectedSideEffects.filter(tool => !(approval.executedSideEffects || []).includes(tool));
    const runMissingApprovedSideEffects = async (record: StoredApprovalRecord, tools: string[]) => {
      const mcpCalls = [] as Awaited<ReturnType<typeof callMcp>>[];
      for (const tool of tools) {
        const call = await callMcp(tool, inputForSideEffect(tool, record));
        mcpCalls.push(call);
        if (!call.ok || call.source !== 'mcp' || hasMcpResultError(call.data)) {
          throw new Error(`side_effect_not_live_mcp:${tool}`);
        }
        record.executedSideEffects = Array.from(new Set([...(record.executedSideEffects || []), call.tool]));
        const savedSideEffect = await saveApprovalStore(store);
        if (!savedSideEffect) throw new Error('side_effect_persistence_failed');
      }
      return mcpCalls;
    };
    if (approval.status === 'approved') {
      const replayedMcpCalls = missingSideEffects.length ? await runMissingApprovedSideEffects(approval, missingSideEffects) : [];
      const idempotentReplay = missingSideEffects.length === 0;
      return res.status(200).json({ ok: true, idempotentReplay, approval, missingSideEffects, mcpCalls: replayedMcpCalls });
    }
    if (approval.status === 'rejected') {
      const idempotentReplay = true;
      return res.status(200).json({ ok: true, idempotentReplay, approval, missingSideEffects: [], mcpCalls: [] });
    }
    if (approval.status !== 'pending') {
      return res.status(409).json({ ok: false, error: 'approval_not_pending' });
    }
    const decidedApproval = rejected
      ? rejectRecord(store, approval.approvalId, String(req.body?.note || ''), 'telegram')
      : approveRecord(store, approval.approvalId, [], 'telegram');
    const decisionSavedBeforeSideEffects = await saveApprovalStore(store);
    if (!decisionSavedBeforeSideEffects) return res.status(502).json({ ok: false, error: 'approval_persistence_failed' });

    const mcpCalls = rejected
      ? [await callMcp('marketing_report_to_owner', { intentId, approvalId: approval.approvalId, action: 'rejected', note: req.body?.note || '', idempotencyKey: `${approval.approvalId}:marketing_report_to_owner` })]
      : await runMissingApprovedSideEffects(decidedApproval, expectedSideEffects);
    if (rejected && mcpCalls.some(call => !call.ok || call.source !== 'mcp' || hasMcpResultError(call.data))) {
      throw new Error('side_effect_not_live_mcp:marketing_report_to_owner');
    }

    return res.status(200).json({
      ok: true,
      reply: rejected
        ? `Owner rejected ${intentId}. Customer promise remains blocked.`
        : `Order handoff ${intentId} approved in Telegram. Sandbox POS/kitchen actions may proceed.`,
      evidenceId: `owner_${Date.now().toString(36)}`,
      approval: decidedApproval,
      idempotentReplay: false,
      mcpCalls
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'approval_not_found') {
      return res.status(404).json({ ok: false, error: 'approval_not_found' });
    }
    return res.status(502).json({ ok: false, error: 'mcp_owner_action_failed' });
  }
}
