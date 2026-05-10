import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get as blobGet, put as blobPut } from '@vercel/blob';

type AgentMode = 'owner_approval' | 'suggest_only' | 'telegram_first' | 'always_on' | 'paused';
type AgentTone = 'warm_direct' | 'playful' | 'concise' | 'silent';
type AgentConfigRecord = { id:string; name:string; enabled:boolean; mode:AgentMode; tone:AgentTone; dailyLimit:number; goal:string };
type AgentConfigStore = { agents:AgentConfigRecord[]; version:number; updatedAt:string; storageMode:'server_memory'|'upstash_redis'|'vercel_blob' };
type GlobalWithConfigStore = typeof globalThis & { __happycakeAgentConfigStore?: AgentConfigStore };

const DEFAULT_AGENT_CONFIG: AgentConfigRecord[] = [
  { id: 'local-demand-scout', name: 'Local demand scout', enabled: true, mode: 'suggest_only', tone: 'concise', dailyLimit: 60, goal: 'Find cold local demand from Google Maps moments, schools, offices, churches, and neighborhood occasions before they reach the site.' },
  { id: 'content-ad-agent', name: 'Content + ad agent', enabled: true, mode: 'owner_approval', tone: 'playful', dailyLimit: 24, goal: 'Create Instagram/Google content, offer angles, and small ad drafts that pull cold leads into the HappyCake funnel.' },
  { id: 'site-conversion-agent', name: 'Site conversion agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 100, goal: 'Convert catalog visitors into owner-approved order requests with offer codes, pickup details, and safe replies.' },
  { id: 'owner-approval-router', name: 'Owner approval router', enabled: true, mode: 'telegram_first', tone: 'concise', dailyLimit: 140, goal: 'Show the owner exactly what each agent wants to do and block POS/kitchen/customer-impacting side effects until approval.' },
  { id: 'customer-support-agent', name: 'Customer support agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 80, goal: 'Track post-purchase questions, pickup changes, complaints, and handoff status without inventing availability or policies.' },
  { id: 'retention-review-agent', name: 'Retention + review agent', enabled: true, mode: 'owner_approval', tone: 'warm_direct', dailyLimit: 45, goal: 'Trigger reviews, birthday reminders, office reorder nudges, and comeback offers after fulfillment.' },
  { id: 'evidence-auditor', name: 'Evidence auditor', enabled: true, mode: 'always_on', tone: 'silent', dailyLimit: 500, goal: 'Check MCP/source proof, agent actions, and sandbox evidence so owner and judges can trust what happened.' }
];


const allowedIds = new Set(DEFAULT_AGENT_CONFIG.map(agent => agent.id));
const allowedModes = new Set<AgentMode>(['owner_approval', 'suggest_only', 'telegram_first', 'always_on', 'paused']);
const allowedTones = new Set<AgentTone>(['warm_direct', 'playful', 'concise', 'silent']);
const storageKey = 'happycake:owner:agent-config:v1';
const blobPath = 'happycake/owner-agent-config.json';

function hasOwnerToken(req: VercelRequest) {
  return !process.env.OWNER_API_TOKEN || req.headers['x-owner-token'] === process.env.OWNER_API_TOKEN;
}

function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

function blobEnv() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function durableConfigured() {
  return Boolean(redisEnv() || blobEnv());
}

function defaultStore(storageMode: AgentConfigStore['storageMode'] = 'server_memory'): AgentConfigStore {
  return { agents: DEFAULT_AGENT_CONFIG, version: 1, updatedAt: new Date().toISOString(), storageMode };
}

function memoryStore() {
  const globalStore = globalThis as GlobalWithConfigStore;
  if (!globalStore.__happycakeAgentConfigStore) globalStore.__happycakeAgentConfigStore = defaultStore('server_memory');
  return globalStore.__happycakeAgentConfigStore;
}

function normalize(payload: unknown) {
  if (!Array.isArray(payload)) return { ok: false as const, agents: [], error: 'agents_array_required' };
  const agents = payload
    .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === 'object'))
    .filter(raw => typeof raw.id === 'string' && allowedIds.has(raw.id))
    .map(raw => {
      const fallback = DEFAULT_AGENT_CONFIG.find(agent => agent.id === raw.id)!;
      const mode = typeof raw.mode === 'string' && allowedModes.has(raw.mode as AgentMode) ? raw.mode as AgentMode : fallback.mode;
      const tone = typeof raw.tone === 'string' && allowedTones.has(raw.tone as AgentTone) ? raw.tone as AgentTone : fallback.tone;
      const rawLimit = Number(raw.dailyLimit);
      return {
        id: fallback.id,
        name: fallback.name,
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
        mode,
        tone,
        dailyLimit: Number.isFinite(rawLimit) ? Math.max(0, Math.min(500, Math.round(rawLimit))) : fallback.dailyLimit,
        goal: typeof raw.goal === 'string' ? raw.goal.slice(0, 280) : fallback.goal
      };
    });
  return { ok: true as const, agents };
}

function mergeAgents(existing: AgentConfigRecord[], updates: AgentConfigRecord[]) {
  return DEFAULT_AGENT_CONFIG.map(fallback => {
    const current = existing.find(agent => agent.id === fallback.id) || fallback;
    const update = updates.find(agent => agent.id === fallback.id);
    return update ? { ...current, ...update, id: fallback.id, name: fallback.name } : current;
  });
}

async function redisGet() {
  const env = redisEnv();
  if (!env) return null;
  const res = await fetch(`${env.url}/get/${encodeURIComponent(storageKey)}`, { headers: { Authorization: `Bearer ${env.token}` } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null) as { result?: string | null } | null;
  if (!data?.result) return null;
  const parsed = JSON.parse(data.result) as AgentConfigStore;
  return { ...parsed, storageMode: 'upstash_redis' as const };
}

async function redisSet(store: AgentConfigStore) {
  const env = redisEnv();
  if (!env) return false;
  const res = await fetch(`${env.url}/set/${encodeURIComponent(storageKey)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(store)
  });
  return res.ok;
}

async function blobGetStore() {
  if (!blobEnv()) return null;
  try {
    const result = await blobGet(blobPath, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as AgentConfigStore;
    return { ...parsed, storageMode: 'vercel_blob' as const };
  } catch {
    return null;
  }
}

async function blobSetStore(store: AgentConfigStore) {
  if (!blobEnv()) return false;
  try {
    await blobPut(blobPath, JSON.stringify(store), {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60
    });
    return true;
  } catch {
    return false;
  }
}

function migrateStore(store: AgentConfigStore): AgentConfigStore {
  return {
    ...store,
    agents: mergeAgents(store.agents || [], []),
    version: Math.max(store.version || 1, 3),
    updatedAt: store.updatedAt || new Date().toISOString()
  };
}

async function readStore() {
  const store = await redisGet() || await blobGetStore() || memoryStore();
  return migrateStore(store);
}

async function writeStore(agentsPayload: unknown) {
  const normalized = normalize(agentsPayload);
  if (!normalized.ok) throw new Error(normalized.error);
  const current = await readStore();
  const next: AgentConfigStore = {
    agents: mergeAgents(current.agents || DEFAULT_AGENT_CONFIG, normalized.agents),
    version: (current.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    storageMode: redisEnv() ? 'upstash_redis' : blobEnv() ? 'vercel_blob' : 'server_memory'
  };
  const wroteRedis = await redisSet(next);
  const wroteBlob = wroteRedis ? false : await blobSetStore(next);
  if (!wroteRedis && !wroteBlob) {
    const globalStore = globalThis as GlobalWithConfigStore;
    globalStore.__happycakeAgentConfigStore = { ...next, storageMode: 'server_memory' };
    return globalStore.__happycakeAgentConfigStore;
  }
  return { ...next, storageMode: wroteRedis ? 'upstash_redis' : 'vercel_blob' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const store = await readStore();
      return res.status(200).json({ ok: true, ...store, durableConfigured: durableConfigured(), ownerAuthEnabled: Boolean(process.env.OWNER_API_TOKEN) });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (!hasOwnerToken(req)) return res.status(401).json({ ok: false, error: 'owner_auth_required' });
    const store = await writeStore(req.body?.agents);
    return res.status(200).json({ ok: true, ...store, durableConfigured: durableConfigured(), ownerAuthEnabled: Boolean(process.env.OWNER_API_TOKEN) });
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_agent_config' });
  }
}
