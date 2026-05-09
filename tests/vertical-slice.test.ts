import { describe, expect, it } from 'vitest';
import { runSandboxVerticalSlice } from '../src/server/vertical-slice';
import { getRequiredTimeline, hasRequiredTimeline } from '../src/server/evidence';

describe('sandbox product vertical slice', () => {
  it('creates evaluator evidence for lead to MCP to owner to POS/kitchen to reply', async () => {
    process.env.ASSISTANT_MODE = 'simulated';
    process.env.MCP_MODE = 'simulated';

    const result = await runSandboxVerticalSlice({
      channel: 'instagram',
      customerName: 'Maya Chen',
      customerHandle: '@maya.office',
      source: 'Friday Office Dessert Drop',
      message: 'Can I order cake "Honey" for our office birthday today and pick it up after work?',
      approveOwnerAction: true
    });

    expect(result.summary.ok).toBe(true);
    expect(result.summary.orderState).toBe('customer_reply_sent');
    expect(result.summary.mcpSources.every((source) => source === 'simulated')).toBe(true);
    expect(result.summary.requiredEvents).toEqual(getRequiredTimeline());
    expect(hasRequiredTimeline(result.events)).toBe(true);
    expect(result.events.map((event) => event.type)).toContain('pos_order_created');
    expect(result.events.map((event) => event.type)).toContain('kitchen_ticket_created');
    expect(result.customerReply).toContain('HappyCake');
  });
});
