import fs from 'node:fs';
import path from 'node:path';
import { runSandboxVerticalSlice } from '../src/server/vertical-slice';
import { getRequiredTimeline, getTimelineVariant, hasRequiredTimeline } from '../src/server/evidence';

process.env.ASSISTANT_MODE = process.env.ASSISTANT_MODE || 'simulated';
process.env.MCP_MODE = process.env.MCP_MODE || 'simulated';

const result = await runSandboxVerticalSlice({
  channel: 'instagram',
  source: 'Friday Office Dessert Drop',
  customerName: 'Evaluator',
  customerHandle: '@evaluator.office',
  message: 'Can I order cake "Honey" for our office birthday today and pick it up after work?',
  approveOwnerAction: true
});

const present = result.events.map((event) => event.type);
const missing = getRequiredTimeline().filter((type) => !present.includes(type));
const liveTokenProvided = Boolean(process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN);
const hasLiveMcp = result.summary.mcpSources.some((source) => source === 'mcp');
const timelineOk = hasRequiredTimeline(result.events);
const sourceOk = !liveTokenProvided || hasLiveMcp || process.env.MCP_MODE !== 'live';
const ok = timelineOk && sourceOk && result.summary.orderState === 'customer_reply_sent';

const eventCounts = present.reduce<Record<string, number>>((counts, type) => {
  counts[type] = (counts[type] || 0) + 1;
  return counts;
}, {});
const proof = {
  schemaVersion: 1,
  ok,
  scenario: 'Friday Office Dessert Drop',
  assistantMode: process.env.ASSISTANT_MODE,
  mcpMode: process.env.MCP_MODE,
  timelineOk,
  sourceOk,
  orderState: result.summary.orderState,
  timelineVariant: getTimelineVariant(result.events),
  requiredTimeline: getRequiredTimeline(),
  missing,
  presentEvents: present,
  eventCounts,
  evidenceEvents: present.length,
  mcpSources: [...new Set(result.summary.mcpSources)].sort(),
  proofFile: 'evidence/evaluator-smoke-latest.json',
  note: 'Deterministic normalized evaluator proof; volatile timestamps, UUIDs, customer PII, and credentials are intentionally omitted.'
};
const serializedProof = JSON.stringify(proof, null, 2);
const secretPatterns = [
  /TELEGRAM_BOT_TOKEN=\d+:/,
  /\b\d{8,}:[A-Za-z0-9_-]{20,}\b/,
  /sbc_team_(?!REPLACE_WITH_YOURS)[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /ghp_[A-Za-z0-9_]{20,}/
];
for (const pattern of secretPatterns) {
  if (pattern.test(serializedProof)) throw new Error(`Secret-like value matched evaluator proof output: ${pattern}`);
}
fs.mkdirSync(path.resolve(process.cwd(), 'evidence'), { recursive: true });
fs.writeFileSync(path.resolve(process.cwd(), 'evidence/evaluator-smoke-latest.json'), `${serializedProof}\n`);

if (!ok) {
  console.error(serializedProof);
  console.error(JSON.stringify({ ok, timelineOk, sourceOk, missing, summary: result.summary }, null, 2));
  process.exit(1);
}
console.log(serializedProof);
