export type StoredApprovalStatus = 'pending' | 'approved' | 'rejected' | 'clarification_requested' | 'scheduled';

export type StoredApprovalRecord = {
  approvalId: string;
  intentId: string;
  customer: string;
  status: StoredApprovalStatus;
  summary: string;
  riskFlags: string[];
  policyDecision: string;
  proposedSideEffects: string[];
  createdAt: string;
  expiresAt: string;
  decisionAt?: string;
  decisionSource?: 'telegram' | 'dashboard' | 'demo' | 'api';
  decisionNote?: string;
  executedSideEffects: string[];
};

export type ApprovalStore = {
  records: StoredApprovalRecord[];
};

export function createEmptyApprovalStore(): ApprovalStore {
  return { records: [] };
}

export function upsertApprovalRecord(store: ApprovalStore, input: Omit<StoredApprovalRecord, 'executedSideEffects'> & { executedSideEffects?: string[] }) {
  const record: StoredApprovalRecord = {
    ...input,
    riskFlags: [...(input.riskFlags || [])],
    proposedSideEffects: [...(input.proposedSideEffects || [])],
    executedSideEffects: [...(input.executedSideEffects || [])]
  };
  const index = store.records.findIndex((item) => item.approvalId === record.approvalId);
  if (index >= 0) {
    const existing = store.records[index];
    store.records[index] = {
      ...existing,
      ...record,
      executedSideEffects: record.executedSideEffects.length ? record.executedSideEffects : existing.executedSideEffects
    };
    return store.records[index];
  }
  store.records.unshift(record);
  return record;
}

export function listActiveApprovals(store: ApprovalStore, now = new Date()) {
  const nowMs = now.getTime();
  return [...store.records]
    .filter((item) => item.status !== 'rejected' && new Date(item.expiresAt).getTime() >= nowMs)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function findApproval(store: ApprovalStore, approvalIdOrIntentId: string) {
  return store.records.find((item) => item.approvalId === approvalIdOrIntentId || item.intentId === approvalIdOrIntentId);
}

export function approveRecord(store: ApprovalStore, approvalIdOrIntentId: string, executedSideEffects: string[], source: StoredApprovalRecord['decisionSource'] = 'api') {
  const record = findApproval(store, approvalIdOrIntentId);
  if (!record) throw new Error('approval_not_found');
  if (record.status === 'approved') return { ...record, decisionNote: record.decisionNote || 'already_approved' };
  if (record.status === 'rejected') return { ...record, decisionNote: record.decisionNote || 'already_rejected' };
  record.status = 'approved';
  record.decisionAt = new Date().toISOString();
  record.decisionSource = source;
  record.executedSideEffects = Array.from(new Set([...(record.executedSideEffects || []), ...executedSideEffects]));
  return record;
}

export function rejectRecord(store: ApprovalStore, approvalIdOrIntentId: string, note = '', source: StoredApprovalRecord['decisionSource'] = 'api') {
  const record = findApproval(store, approvalIdOrIntentId);
  if (!record) throw new Error('approval_not_found');
  if (record.status === 'approved') return { ...record, decisionNote: record.decisionNote || 'already_approved' };
  if (record.status === 'rejected') return { ...record, decisionNote: record.decisionNote || 'already_rejected' };
  record.status = 'rejected';
  record.decisionAt = new Date().toISOString();
  record.decisionSource = source;
  record.decisionNote = note;
  return record;
}

export function approvalExpiresIn(record: Pick<StoredApprovalRecord, 'expiresAt'>, now = new Date()) {
  const remainingMs = new Date(record.expiresAt).getTime() - now.getTime();
  if (remainingMs <= 0) return 'expired';
  const minutes = Math.ceil(remainingMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function seedDemoApprovals(store: ApprovalStore, now = new Date()) {
  if (store.records.length > 0) return store;
  upsertApprovalRecord(store, {
    approvalId: 'queue_live_owner_001',
    intentId: 'intent_pending_honey_office',
    customer: 'Website customer',
    status: 'pending',
    riskFlags: ['same_day'],
    policyDecision: 'require_owner_approval',
    summary: 'cake "Honey" for today after work. Side effects blocked until owner approval.',
    proposedSideEffects: ['square_create_order', 'kitchen_create_ticket'],
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 3).toISOString()
  });
  upsertApprovalRecord(store, {
    approvalId: 'queue_retention_002',
    intentId: 'intent_comeback_card',
    customer: 'Previous office buyer',
    status: 'scheduled',
    riskFlags: [],
    policyDecision: 'allow_followup',
    summary: 'Retention agent will send a comeback reminder for the next office birthday.',
    proposedSideEffects: ['schedule_followup'],
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString()
  });
  return store;
}
