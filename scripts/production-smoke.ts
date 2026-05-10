import fs from 'node:fs';
import path from 'node:path';

const hostInput = process.env.PRODUCTION_HOST || 'https://happycake-growth-os.vercel.app';
const parsedHost = new URL(hostInput);
if (parsedHost.username || parsedHost.password) throw new Error('PRODUCTION_HOST must not include URL credentials');
const base = `${parsedHost.protocol}//${parsedHost.host}${parsedHost.pathname.replace(/\/$/, '')}`;
const evidenceDir = path.resolve(process.cwd(), 'evidence');
const outPath = path.join(evidenceDir, 'production-smoke-latest.json');

const endpoints = [
  { name: 'health', path: '/api/health', expect: (body: any) => body?.ok === true && body?.runtime === 'claude-code-cli' },
  { name: 'manifest', path: '/api/manifest', expect: (body: any) => body?.runtime === 'claude-code-cli' && body?.ownerUi === 'telegram' },
  { name: 'mcpSmoke', path: '/api/mcp/smoke', expect: (body: any) => body?.ok === true && body?.source === 'mcp' && body?.usedFallback === false && body?.mode === 'live' },
  { name: 'mcpAudit', path: '/api/mcp/audit', expect: (body: any) => body?.ok === true && body?.usedFallback === false && Array.isArray(body?.failures) && body.failures.length === 0 },
  { name: 'ownerDashboard', path: '/api/owner/dashboard', expect: (body: any) => body?.mode === 'live' && body?.storageMode === 'vercel_blob' && Array.isArray(body?.agents) && body.agents.length >= 7 && Array.isArray(body?.mcpChecks) && body.mcpChecks.every((check: any) => check?.source === 'mcp') },
  { name: 'ownerConfig', path: '/api/owner/config', expect: (body: any) => body?.storageMode === 'vercel_blob' && body?.ownerAuthEnabled === true && body?.durableConfigured === true },
  { name: 'ownerActionUnauth', path: '/api/telegram/owner-action', method: 'POST', body: { action: 'approve_order_handoff', approvalId: 'synthetic_no_token' }, expectStatus: 401, expect: (body: any) => body?.error === 'owner_auth_required' },
  { name: 'agentManifest', path: '/agent-manifest.json', expect: (body: any) => body?.runtime?.command === 'claude -p' && body?.runtime?.ownerUi === 'Telegram' },
  { name: 'products', path: '/data/products.json', expect: (body: any) => body?.brand === 'HappyCake' && Array.isArray(body?.products) && body.products.length > 0 }
];

function stableBody(endpoint: string, body: any) {
  if (endpoint === 'health') return { ok: body?.ok, service: body?.service, runtime: body?.runtime, localRuntime: body?.localRuntime, productionRuntime: body?.productionRuntime, claudeCliProductionExecuted: body?.claudeCliProductionExecuted, localProofPath: body?.localProofPath, deployment: body?.deployment };
  if (endpoint === 'manifest') return { name: body?.name, runtime: body?.runtime, ownerUi: body?.ownerUi, publicDemo: body?.publicDemo };
  if (endpoint === 'mcpSmoke') return { ok: body?.ok, source: body?.source, tool: body?.tool };
  if (endpoint === 'mcpAudit') return {
    ok: body?.ok,
    mode: body?.mode,
    usedFallback: body?.usedFallback,
    totalCalls: body?.totalCalls,
    failures: body?.failures,
    tools: Array.isArray(body?.calls) ? body.calls.map((call: any) => ({ ok: call?.ok, source: call?.source, tool: call?.tool, httpStatus: call?.httpStatus })) : []
  };
  if (endpoint === 'ownerDashboard') return {
    mode: body?.mode,
    storageMode: body?.storageMode,
    agentCount: Array.isArray(body?.agents) ? body.agents.length : 0,
    mcpChecks: Array.isArray(body?.mcpChecks) ? body.mcpChecks.map((check: any) => ({ ok: check?.ok, source: check?.source, tool: check?.tool })) : []
  };
  if (endpoint === 'ownerConfig') return { storageMode: body?.storageMode, ownerAuthEnabled: body?.ownerAuthEnabled, durableConfigured: body?.durableConfigured, agentCount: Array.isArray(body?.agents) ? body.agents.length : 0 };
  if (endpoint === 'ownerActionUnauth') return { error: body?.error };
  if (endpoint === 'agentManifest') return { name: body?.name, version: body?.version, runtime: body?.runtime, capabilities: body?.capabilities };
  if (endpoint === 'products') return { brand: body?.brand, locality: body?.locality, productCount: Array.isArray(body?.products) ? body.products.length : 0, guardrails: body?.guardrails };
  return {};
}

function assertNoSecrets(value: unknown) {
  const text = JSON.stringify(value);
  const secretPatterns = [
    /TELEGRAM_BOT_TOKEN=\d+:/,
    /\b\d{8,}:[A-Za-z0-9_-]{20,}\b/,
    /sbc_team_(?!REPLACE_WITH_YOURS)[A-Za-z0-9_-]+/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /ghp_[A-Za-z0-9_]{20,}/
  ];
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) throw new Error(`Secret-like value matched production smoke output: ${pattern}`);
  }
}

const checks = [];
for (const endpoint of endpoints) {
  const url = `${base}${endpoint.path}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(url, {
      method: endpoint.method || 'GET',
      headers: { 'user-agent': 'HappyCake-Production-Smoke/1.0', ...(endpoint.body ? { 'content-type': 'application/json' } : {}) },
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    const stable = stableBody(endpoint.name, body);
    const expectedStatus = endpoint.expectStatus || 200;
    checks.push({ name: endpoint.name, path: endpoint.path, httpStatus: response.status, ok: response.status === expectedStatus && endpoint.expect(body), body: stable });
  } catch (error) {
    checks.push({ name: endpoint.name, path: endpoint.path, httpStatus: 0, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const report = {
  schemaVersion: 1,
  host: base,
  ok: checks.every((check) => check.ok),
  checks,
  proofFile: 'evidence/production-smoke-latest.json',
  note: 'Deterministic normalized production smoke proof; volatile timestamps, run IDs, latencies, and credentials are intentionally omitted.'
};

assertNoSecrets(report);
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
