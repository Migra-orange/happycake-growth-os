import { runSandboxVerticalSlice } from '../src/server/vertical-slice';
import { getRequiredTimeline, hasRequiredTimeline } from '../src/server/evidence';

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

if (!ok) {
  console.error(JSON.stringify({ ok, timelineOk, sourceOk, missing, summary: result.summary }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok, demoRunId: result.demoRunId, mcpSources: result.summary.mcpSources, requiredTimeline: getRequiredTimeline(), evidenceEvents: present.length }, null, 2));
