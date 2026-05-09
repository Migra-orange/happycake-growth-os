import { randomUUID } from 'node:crypto';
import type { McpResult, OrderIntent, OwnerApproval } from '../../shared/schema';
import { evaluatePolicy, type PolicyDecision } from './policy-engine';

export type ApprovalQueueRecord = OwnerApproval & {
  createdAt: string;
  expiresAt: string;
  policyDecision: PolicyDecision;
  proposedSideEffects: string[];
  decisionSource?: 'telegram' | 'dashboard' | 'demo';
  executedSideEffects: string[];
};

export type AutopilotTimelineEvent = {
  type: string;
  label: string;
  summary: string;
  status: 'done' | 'pending' | 'scheduled' | 'blocked';
  at: string;
};

export function createApprovalRecord(intent: OrderIntent, sideEffects: string[], now = new Date()): ApprovalQueueRecord {
  const policyDecision = evaluatePolicy(intent, { action: 'create_order' });
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 3).toISOString();
  return {
    approvalId: `own_${randomUUID()}`,
    intentId: intent.intentId,
    status: 'pending',
    ownerChannel: 'telegram',
    summary: `${intent.customerName || intent.customerHandle || 'Customer'} wants ${intent.productPreference || 'a cake'} (${intent.pickupWindow || 'pickup TBD'}). Policy: ${policyDecision.decision}.`,
    sideEffectsIfApproved: sideEffects,
    createdAt,
    expiresAt,
    policyDecision,
    proposedSideEffects: sideEffects,
    executedSideEffects: []
  };
}

export function createAutopilotTimeline(input: {
  intent: OrderIntent;
  approval?: Pick<ApprovalQueueRecord, 'status' | 'policyDecision'> | OwnerApproval;
  offerCode?: string;
  mcpChecks?: (string | McpResult)[];
  now?: Date;
}): AutopilotTimelineEvent[] {
  const at = (input.now || new Date()).toISOString();
  const checks = input.mcpChecks || [];
  const approvalStatus = input.approval?.status || 'pending';
  const maybePolicy = input.approval && 'policyDecision' in input.approval ? input.approval.policyDecision : undefined;
  const blocked = maybePolicy?.decision === 'block';
  return [
    { type: 'visitor_engaged', label: 'Visitor engaged', summary: input.offerCode ? `Wheel offer ${input.offerCode} captured.` : 'Catalog shopper entered funnel.', status: 'done', at },
    { type: 'intent_extracted', label: 'Intent extracted', summary: `${input.intent.productPreference || 'Cake'} request from ${input.intent.channel}.`, status: 'done', at },
    { type: 'source_checked', label: 'MCP sources checked', summary: checks.length ? `${checks.length} sandbox checks recorded.` : 'Catalog/POS/kitchen/evaluator checks queued.', status: checks.length ? 'done' : 'pending', at },
    { type: 'approval_pending', label: 'Owner approval', summary: blocked ? 'Policy blocked side effects.' : `Approval is ${approvalStatus}.`, status: blocked ? 'blocked' : approvalStatus === 'approved' ? 'done' : 'pending', at },
    { type: 'followup_scheduled', label: 'Follow-up scheduled', summary: 'Autopilot will nudge abandoned or pending order intents without making fulfillment promises.', status: 'scheduled', at }
  ];
}

export function summarizeDashboardFromTimeline(timeline: AutopilotTimelineEvent[]) {
  return {
    pending: timeline.filter((event) => event.status === 'pending').length,
    done: timeline.filter((event) => event.status === 'done').length,
    scheduled: timeline.filter((event) => event.status === 'scheduled').length,
    blocked: timeline.filter((event) => event.status === 'blocked').length
  };
}
