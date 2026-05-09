import { describe, expect, it } from 'vitest';
import { simulateAssistant } from './simulator';
import { callMcp } from './mcp';
import { handleOwnerAction } from './owner-actions';

describe('HappyCake assistant guardrails', () => {
  it('detects office coordinator leads', () => {
    const res = simulateAssistant({ channel: 'instagram', message: 'Need office birthday cakes today', source: 'test', requireOwnerApproval: true });
    expect(res.ownerSummary).toContain('B2B');
    expect(res.reply).toContain('office');
    expect(res.guardrails).toContain('Use HappyCake spelling exactly.');
  });

  it('escalates complaints instead of marketing', () => {
    const res = simulateAssistant({ channel: 'whatsapp', message: 'My cake was wrong and I am upset', requireOwnerApproval: true });
    expect(res.actions[0].type).toBe('owner_escalation');
  });

  it('keeps MCP public demo runnable without token', async () => {
    process.env.MCP_MODE = 'simulated';
    const res = await callMcp('square_list_catalog', { smoke: true });
    expect(res.ok).toBe(true);
    expect(res.source).toBe('simulated');
  });

  it('supports Telegram owner approval action', async () => {
    const res = await handleOwnerAction({ action: 'approve_campaign', campaignId: 'office-drop' });
    expect(res.reply).toContain('approved');
  });
});
