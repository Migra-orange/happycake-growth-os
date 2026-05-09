import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_CONFIG, normalizeAgentConfigPayload, updateAgentConfigStore } from '../src/server/autopilot/agent-config';

describe('agent config store', () => {
  it('normalizes owner-edited agent configs and clamps unsafe limits', () => {
    const result = normalizeAgentConfigPayload([
      { id: 'sales-concierge', name: 'Sales concierge', enabled: true, mode: 'always_on', tone: 'warm_direct', dailyLimit: 9999, goal: 'x'.repeat(600) },
      { id: 'unknown-agent', name: 'Bad', enabled: true, mode: 'root', tone: 'loud', dailyLimit: -10, goal: 'bad' }
    ]);

    expect(result.ok).toBe(true);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]).toMatchObject({ id: 'sales-concierge', mode: 'always_on', dailyLimit: 500 });
    expect(result.agents[0].goal.length).toBeLessThanOrEqual(280);
  });

  it('updates config store with version and storage metadata', () => {
    const updated = updateAgentConfigStore({ agents: DEFAULT_AGENT_CONFIG, version: 1 }, [
      { id: 'promo-engine', name: 'Promo engine', enabled: false, mode: 'paused', tone: 'concise', dailyLimit: 5, goal: 'Pause promo tests.' }
    ], 'server_memory');

    expect(updated.version).toBe(2);
    expect(updated.storageMode).toBe('server_memory');
    expect(updated.agents.find(agent => agent.id === 'promo-engine')).toMatchObject({ enabled: false, mode: 'paused', dailyLimit: 5 });
  });
});
