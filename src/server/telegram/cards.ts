import { randomUUID } from 'node:crypto';
import type { OwnerApproval, OrderIntent } from '../../shared/schema';
import { appendEvidence } from '../evidence';
import { callMcp } from '../mcp';

export function buildOwnerApproval(intent: OrderIntent, mcpEvidenceSummary: string[]): OwnerApproval {
  return {
    approvalId: `own_${randomUUID()}`,
    intentId: intent.intentId,
    status: 'pending',
    ownerChannel: 'telegram',
    summary: `${intent.customerName || intent.customerHandle || 'Customer'} wants ${intent.productPreference || 'a cake'} for ${intent.occasion || 'an occasion'} (${intent.pickupWindow || 'pickup TBD'}). Evidence: ${mcpEvidenceSummary.join('; ')}`,
    sideEffectsIfApproved: ['create Square sandbox draft order', 'create kitchen sandbox ticket', 'send customer reply through source channel']
  };
}

export async function requestOwnerApproval(approval: OwnerApproval, demoRunId: string, channel = 'telegram') {
  const mcp = await callMcp('owner_action_log', { approval, status: 'pending' }, { demoRunId, channel, entityId: approval.approvalId });
  appendEvidence({
    demo_run_id: demoRunId,
    type: 'owner_approval_requested',
    channel: 'telegram',
    entity_id: approval.approvalId,
    summary: approval.summary,
    data: { approval, mcp }
  });
  return { approval, mcp };
}

export async function approveOwnerAction(approval: OwnerApproval, demoRunId: string) {
  const approved: OwnerApproval = { ...approval, status: 'approved' };
  const mcp = await callMcp('owner_action_log', { approval: approved, status: 'approved' }, { demoRunId, channel: 'telegram', entityId: approval.approvalId });
  appendEvidence({
    demo_run_id: demoRunId,
    type: 'owner_approved',
    channel: 'telegram',
    entity_id: approval.approvalId,
    summary: `Owner approved ${approval.intentId} in Telegram command center.`,
    data: { approval: approved, mcp }
  });
  return approved;
}
