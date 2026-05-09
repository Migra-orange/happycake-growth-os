import { describe, expect, it } from 'vitest';
import {
  approveRecord,
  createEmptyApprovalStore,
  listActiveApprovals,
  rejectRecord,
  upsertApprovalRecord
} from '../src/server/autopilot/approval-store';

describe('approval queue store', () => {
  it('keeps pending approvals queryable without duplicating the same approval id', () => {
    const store = createEmptyApprovalStore();
    const record = upsertApprovalRecord(store, {
      approvalId: 'own_test_001',
      intentId: 'intent_test_001',
      customer: 'Didar',
      status: 'pending',
      summary: 'Napoleon cake today after work.',
      riskFlags: ['same_day'],
      policyDecision: 'require_owner_approval',
      proposedSideEffects: ['square_create_order', 'kitchen_create_ticket'],
      createdAt: '2026-05-09T20:00:00.000Z',
      expiresAt: '2026-05-09T23:00:00.000Z'
    });

    upsertApprovalRecord(store, { ...record, summary: 'Updated owner summary.' });

    const active = listActiveApprovals(store, new Date('2026-05-09T21:00:00.000Z'));
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      approvalId: 'own_test_001',
      status: 'pending',
      summary: 'Updated owner summary.',
      proposedSideEffects: ['square_create_order', 'kitchen_create_ticket']
    });
  });

  it('approves and rejects records idempotently while preserving executed side effects', () => {
    const store = createEmptyApprovalStore();
    upsertApprovalRecord(store, {
      approvalId: 'own_test_002',
      intentId: 'intent_test_002',
      customer: 'Website customer',
      status: 'pending',
      summary: 'Honey cake request.',
      riskFlags: [],
      policyDecision: 'require_owner_approval',
      proposedSideEffects: ['square_create_order', 'kitchen_create_ticket'],
      createdAt: '2026-05-09T20:00:00.000Z',
      expiresAt: '2026-05-09T23:00:00.000Z'
    });

    const approved = approveRecord(store, 'own_test_002', ['square_create_order', 'kitchen_create_ticket']);
    const approvedAgain = approveRecord(store, 'own_test_002', ['square_create_order']);

    expect(approved.status).toBe('approved');
    expect(approvedAgain.executedSideEffects).toEqual(['square_create_order', 'kitchen_create_ticket']);
    const activeAfterApproval = listActiveApprovals(store, new Date('2026-05-09T21:00:00.000Z'));
    expect(activeAfterApproval[0].status).toBe('approved');

    const rejected = rejectRecord(store, 'own_test_002', 'owner changed mind');
    expect(rejected.status).toBe('approved');
    expect(rejected.decisionNote).toBe('already_approved');
  });
});
