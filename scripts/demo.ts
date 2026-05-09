import fs from 'node:fs';
import path from 'node:path';
import { runSandboxVerticalSlice } from '../src/server/vertical-slice';

process.env.ASSISTANT_MODE = process.env.ASSISTANT_MODE || 'simulated';
process.env.MCP_MODE = process.env.MCP_MODE || 'simulated';

const result = await runSandboxVerticalSlice({
  channel: 'instagram',
  customerName: 'Maya Chen',
  customerHandle: '@maya.office',
  source: 'Friday Office Dessert Drop',
  message: 'Can I order cake "Honey" for our office birthday today and pick it up after work?',
  approveOwnerAction: true
});

const evidenceDir = path.resolve(process.cwd(), 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });
const out = path.join(evidenceDir, `${result.demoRunId}.json`);
fs.writeFileSync(out, JSON.stringify({
  demoRunId: result.demoRunId,
  generatedAt: new Date().toISOString(),
  summary: result.summary,
  customerReply: result.customerReply,
  events: result.events
}, null, 2));

console.log(`Wrote ${out}`);
console.log(JSON.stringify({ demoRunId: result.demoRunId, ok: result.summary.ok, orderState: result.summary.orderState, evidenceFile: out }, null, 2));
