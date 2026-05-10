export type AgentMode = 'owner_approval' | 'suggest_only' | 'telegram_first' | 'always_on' | 'paused';
export type AgentTone = 'warm_direct' | 'playful' | 'concise' | 'silent';

export type AgentConfigRecord = {
  id: string;
  name: string;
  enabled: boolean;
  mode: AgentMode;
  tone: AgentTone;
  dailyLimit: number;
  goal: string;
};

export type AgentConfigStore = {
  agents: AgentConfigRecord[];
  version: number;
  updatedAt?: string;
  storageMode?: 'server_memory' | 'upstash_redis' | 'vercel_blob';
};

export const DEFAULT_AGENT_CONFIG: AgentConfigRecord[] = [
  { id: 'local-demand-scout', name: 'Local demand scout', enabled: true, mode: 'suggest_only', tone: 'concise', dailyLimit: 60, goal: 'Find cold local demand from Google Maps moments, schools, offices, churches, and neighborhood occasions before they reach the site.' },
  { id: 'content-ad-agent', name: 'Content + ad agent', enabled: true, mode: 'owner_approval', tone: 'playful', dailyLimit: 24, goal: 'Create Instagram/Google content, offer angles, and small ad drafts that pull cold leads into the HappyCake funnel.' },
  { id: 'site-conversion-agent', name: 'Site conversion agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 100, goal: 'Convert catalog visitors into owner-approved order requests with offer codes, pickup details, and safe replies.' },
  { id: 'owner-approval-router', name: 'Owner approval router', enabled: true, mode: 'telegram_first', tone: 'concise', dailyLimit: 140, goal: 'Show the owner exactly what each agent wants to do and block POS/kitchen/customer-impacting side effects until approval.' },
  { id: 'customer-support-agent', name: 'Customer support agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 80, goal: 'Track post-purchase questions, pickup changes, complaints, and handoff status without inventing availability or policies.' },
  { id: 'retention-review-agent', name: 'Retention + review agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 45, goal: 'Trigger reviews, birthday reminders, office reorder nudges, and comeback offers after fulfillment.' },
  { id: 'evidence-auditor', name: 'Evidence auditor', enabled: true, mode: 'always_on', tone: 'silent', dailyLimit: 500, goal: 'Check MCP/source proof, agent actions, and sandbox evidence so owner and judges can trust what happened.' }
];


const allowedIds = new Set(DEFAULT_AGENT_CONFIG.map((agent) => agent.id));
const allowedModes = new Set<AgentMode>(['owner_approval', 'suggest_only', 'telegram_first', 'always_on', 'paused']);
const allowedTones = new Set<AgentTone>(['warm_direct', 'playful', 'concise', 'silent']);

export function normalizeAgentConfigPayload(payload: unknown) {
  if (!Array.isArray(payload)) return { ok: false as const, agents: [], error: 'agents_array_required' };
  const agents = payload
    .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === 'object'))
    .filter((raw) => typeof raw.id === 'string' && allowedIds.has(raw.id))
    .map((raw) => {
      const fallback = DEFAULT_AGENT_CONFIG.find((agent) => agent.id === raw.id)!;
      const mode = typeof raw.mode === 'string' && allowedModes.has(raw.mode as AgentMode) ? raw.mode as AgentMode : fallback.mode;
      const tone = typeof raw.tone === 'string' && allowedTones.has(raw.tone as AgentTone) ? raw.tone as AgentTone : fallback.tone;
      const rawLimit = Number(raw.dailyLimit);
      const dailyLimit = Number.isFinite(rawLimit) ? Math.max(0, Math.min(500, Math.round(rawLimit))) : fallback.dailyLimit;
      const goal = typeof raw.goal === 'string' ? raw.goal.slice(0, 280) : fallback.goal;
      return {
        id: fallback.id,
        name: fallback.name,
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
        mode,
        tone,
        dailyLimit,
        goal
      };
    });
  return { ok: true as const, agents };
}

export function mergeAgentConfig(existing: AgentConfigRecord[], updates: AgentConfigRecord[]) {
  return DEFAULT_AGENT_CONFIG.map((fallback) => {
    const current = existing.find((agent) => agent.id === fallback.id) || fallback;
    const update = updates.find((agent) => agent.id === fallback.id);
    return update ? { ...current, ...update, id: fallback.id, name: fallback.name } : current;
  });
}

export function updateAgentConfigStore(store: AgentConfigStore, payload: unknown, storageMode: AgentConfigStore['storageMode'] = 'server_memory') {
  const normalized = normalizeAgentConfigPayload(payload);
  if (!normalized.ok) throw new Error(normalized.error);
  return {
    agents: mergeAgentConfig(store.agents || DEFAULT_AGENT_CONFIG, normalized.agents),
    version: (store.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    storageMode
  } satisfies AgentConfigStore;
}

export function createDefaultAgentConfigStore(storageMode: AgentConfigStore['storageMode'] = 'server_memory') {
  return { agents: DEFAULT_AGENT_CONFIG, version: 1, updatedAt: new Date().toISOString(), storageMode } satisfies AgentConfigStore;
}
