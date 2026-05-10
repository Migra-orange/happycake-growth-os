import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_CONFIG, normalizeAgentConfigPayload, updateAgentConfigStore } from '../src/server/autopilot/agent-config';

describe('agent config store', () => {
  it('defines an owner-controlled full-funnel agent team', () => {
    const ids = DEFAULT_AGENT_CONFIG.map(agent => agent.id);

    expect(ids).toEqual([
      'local-demand-scout',
      'content-ad-agent',
      'site-conversion-agent',
      'owner-approval-router',
      'customer-support-agent',
      'retention-review-agent',
      'evidence-auditor'
    ]);
    expect(DEFAULT_AGENT_CONFIG.find(agent => agent.id === 'local-demand-scout')?.goal).toContain('Google Maps');
    expect(DEFAULT_AGENT_CONFIG.find(agent => agent.id === 'content-ad-agent')?.goal).toContain('Instagram');
    expect(DEFAULT_AGENT_CONFIG.find(agent => agent.id === 'customer-support-agent')?.goal).toContain('post-purchase');
  });

  it('normalizes owner-edited agent configs and clamps unsafe limits', () => {
    const result = normalizeAgentConfigPayload([
      { id: 'site-conversion-agent', name: 'Site conversion agent', enabled: true, mode: 'always_on', tone: 'warm_direct', dailyLimit: 9999, goal: 'x'.repeat(600) },
      { id: 'unknown-agent', name: 'Bad', enabled: true, mode: 'root', tone: 'loud', dailyLimit: -10, goal: 'bad' }
    ]);

    expect(result.ok).toBe(true);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]).toMatchObject({ id: 'site-conversion-agent', mode: 'always_on', dailyLimit: 500 });
    expect(result.agents[0].goal.length).toBeLessThanOrEqual(280);
  });

  it('migrates older saved configs into the new full-funnel roster', () => {
    const updated = updateAgentConfigStore({ agents: DEFAULT_AGENT_CONFIG.slice(0, 2), version: 1 }, [
      { id: 'content-ad-agent', name: 'Content + ad agent', enabled: false, mode: 'paused', tone: 'concise', dailyLimit: 5, goal: 'Pause ad experiments.' }
    ], 'server_memory');

    expect(updated.version).toBe(2);
    expect(updated.storageMode).toBe('server_memory');
    expect(updated.agents).toHaveLength(DEFAULT_AGENT_CONFIG.length);
    expect(updated.agents.find(agent => agent.id === 'content-ad-agent')).toMatchObject({ enabled: false, mode: 'paused', dailyLimit: 5 });
    expect(updated.agents.find(agent => agent.id === 'customer-support-agent')?.enabled).toBe(true);
  });
});
