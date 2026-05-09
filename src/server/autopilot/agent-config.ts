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
  storageMode?: 'server_memory' | 'upstash_redis';
};

export const DEFAULT_AGENT_CONFIG: AgentConfigRecord[] = [
  { id: 'sales-concierge', name: 'Sales concierge', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 80, goal: 'Convert cake shoppers into owner-approved order requests.' },
  { id: 'promo-engine', name: 'Promo engine', enabled: true, mode: 'suggest_only', tone: 'playful', dailyLimit: 12, goal: 'Run wheel offers, office bundles, comeback cards, and offer tests.' },
  { id: 'owner-approval', name: 'Owner approval router', enabled: true, mode: 'telegram_first', tone: 'concise', dailyLimit: 120, goal: 'Queue approvals and block POS/kitchen side effects until owner approval.' },
  { id: 'evidence-auditor', name: 'Evidence auditor', enabled: true, mode: 'always_on', tone: 'silent', dailyLimit: 500, goal: 'Check MCP/source proof and keep sandbox runs judge-safe.' },
  { id: 'retention-agent', name: 'Retention agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 40, goal: 'Schedule review asks, birthday reminders, comeback nudges, and office repeat orders.' },
  { id: 'channel-ops', name: 'Channel ops agent', enabled: true, mode: 'always_on', tone: 'concise', dailyLimit: 200, goal: 'Watch stalled threads, expired approvals, failed sends, and kitchen rejects.' }
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
