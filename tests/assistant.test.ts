import { describe, expect, it } from 'vitest';
import { simulateAssistant } from '../src/server/simulator';
import { AssistantRequestSchema } from '../src/shared/schema';
import { getManifest } from '../src/server/manifest';

describe('HappyCake assistant', () => {
  it('simulates same-day order intent', () => {
    const req = AssistantRequestSchema.parse({ channel: 'whatsapp', message: 'Need a cake today for pickup' });
    const res = simulateAssistant(req);
    expect(res.runtime).toBe('claude-code-cli');
    expect(res.reply).toContain('today');
  });
  it('manifest declares forbidden frameworks', () => {
    const m = getManifest();
    expect(m.constraints.noAgentSdk).toBe(true);
    expect(m.constraints.noLangGraph).toBe(true);
    expect(m.target.targetMonthlyRevenueUsd).toBe(40000);
  });
});
