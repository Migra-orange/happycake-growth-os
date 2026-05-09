import { describe, expect, it } from 'vitest';
import { runAssistantVerticalSlice, runSandboxVerticalSlice } from '../src/server/vertical-slice';
import { createOrderIntent } from '../src/server/orders/order-intent';
import { evaluatePolicy } from '../src/server/autopilot/policy-engine';
import { createApprovalRecord, createAutopilotTimeline } from '../src/server/autopilot/state-machine';

describe('autopilot backbone', () => {
  it('does not create POS or kitchen side effects while owner approval is only required', async () => {
    process.env.ASSISTANT_MODE = 'simulated';
    process.env.MCP_MODE = 'simulated';

    const result = await runAssistantVerticalSlice({
      channel: 'website',
      customerName: 'Didar',
      message: 'Order request: cake "Honey", $42. Pickup: Today after work. Headcount: 10.',
      source: 'test',
      requireOwnerApproval: true
    });

    const eventTypes = result.actions.map((event) => event.type);
    expect(result.requiredApprovals?.[0]?.status).toBe('pending');
    expect(result.orderIntent?.state).toBe('customer_reply_sent');
    expect(eventTypes).toContain('owner_approval_requested');
    expect(eventTypes).not.toContain('owner_approved');
    expect(eventTypes).not.toContain('pos_order_created');
    expect(eventTypes).not.toContain('kitchen_ticket_created');
  });

  it('can still run a demo-approved scenario explicitly', async () => {
    process.env.ASSISTANT_MODE = 'simulated';
    process.env.MCP_MODE = 'simulated';

    const result = await runSandboxVerticalSlice({
      channel: 'instagram',
      customerName: 'Maya Chen',
      customerHandle: '@maya.office',
      source: 'Friday Office Dessert Drop',
      message: 'Can I order cake "Honey" for our office birthday today and pick it up after work?',
      autoApproveForDemoOnly: true
    });

    const eventTypes = result.events.map((event) => event.type);
    expect(eventTypes).toContain('owner_approved');
    expect(eventTypes).toContain('pos_order_created');
    expect(eventTypes).toContain('kitchen_ticket_created');
    expect(result.autopilotTimeline.find((event) => event.type === 'approval_pending')?.status).toBe('done');
  });

  it('treats approval-pending evidence as a valid timeline variant', async () => {
    process.env.ASSISTANT_MODE = 'simulated';
    process.env.MCP_MODE = 'simulated';

    const result = await runSandboxVerticalSlice({
      channel: 'website',
      customerName: 'Ana',
      message: 'Order request: cake "Honey". Pickup: Today after work.',
      requiresOwnerApproval: true
    });

    expect(result.summary.ok).toBe(true);
    expect(result.summary.variant).toBe('approval_pending');
    expect(result.events.map((event) => event.type)).not.toContain('pos_order_created');
  });

  it('policy engine requires approval for side effects and blocks unsafe promises', () => {
    const allergyIntent = createOrderIntent({
      channel: 'website',
      message: 'I need cake "Napoleon" today after work, gluten allergy, can you deliver?',
      customerName: 'Sam',
      requireOwnerApproval: true
    }, 'intent_policy');

    const decision = evaluatePolicy(allergyIntent, { action: 'create_order' });
    expect(decision.decision).toBe('require_owner_approval');
    expect(decision.reasons).toEqual(expect.arrayContaining(['allergy_risk', 'delivery_not_confirmed', 'same_day_request']));

    const replyDecision = evaluatePolicy(allergyIntent, { action: 'send_customer_reply' });
    expect(replyDecision.decision).toBe('ask_clarifying_question');
  });

  it('creates approval records and an autopilot timeline from intent state', () => {
    const intent = createOrderIntent({
      channel: 'website',
      message: 'Order request: cake "Honey". Pickup: Today after work.',
      customerName: 'Ana',
      requireOwnerApproval: true
    }, 'intent_queue');
    const approval = createApprovalRecord(intent, ['square_create_order', 'kitchen_create_ticket']);
    const timeline = createAutopilotTimeline({ intent, approval, offerCode: 'SWEET5', mcpChecks: ['square_list_catalog:mcp:ok'] });

    expect(approval.status).toBe('pending');
    expect(approval.policyDecision.decision).toBe('require_owner_approval');
    expect(timeline.map((event) => event.type)).toEqual(expect.arrayContaining([
      'visitor_engaged',
      'intent_extracted',
      'source_checked',
      'approval_pending',
      'followup_scheduled'
    ]));
  });
});
