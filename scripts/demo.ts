import fs from 'node:fs';
import path from 'node:path';
import { runAssistant } from '../src/server/assistant';
import { AssistantRequestSchema } from '../src/shared/schema';

process.env.ASSISTANT_MODE = process.env.ASSISTANT_MODE || 'simulated';
const demoRunId = `demo-run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const evidenceDir = path.resolve(process.cwd(), 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const steps = [
  { type: 'campaign_created', summary: 'Friday Office Dessert Drop campaign created with $40 test budget.', channel: 'telegram' },
  { type: 'owner_approval_required', summary: 'Campaign draft blocked until owner approval.', channel: 'telegram' },
  { type: 'owner_approved', summary: 'Owner approved campaign in Telegram command center.', channel: 'telegram' },
  { type: 'lead_received', summary: 'Instagram DM lead asks for office birthday cake today.', channel: 'instagram' }
];

const req = AssistantRequestSchema.parse({ channel: 'instagram', customerName: 'Maya Chen', source: 'Friday Office Dessert Drop', message: 'Can I order something for our office birthday today and pick it up after work?' });
const assistant = await runAssistant(req);

const events = [
  ...steps.map((s, i) => ({ event_id: `sample_${i+1}`, demo_run_id: demoRunId, at: new Date().toISOString(), ...s, data: {} })),
  { event_id: 'sample_assistant', demo_run_id: demoRunId, at: new Date().toISOString(), type: 'assistant_response', channel: 'instagram', summary: assistant.ownerSummary, data: { request: req, response: assistant } },
  { event_id: 'sample_handoff', demo_run_id: demoRunId, at: new Date().toISOString(), type: 'kitchen_pos_handoff', channel: 'demo', summary: 'Qualified lead would create POS order and kitchen ticket after availability check.', data: { posStatus: 'pending_source_of_truth', kitchenStatus: 'pending_source_of_truth' } }
];

const out = path.join(evidenceDir, `${demoRunId}.json`);
fs.writeFileSync(out, JSON.stringify({ demoRunId, generatedAt: new Date().toISOString(), events }, null, 2));
console.log(`Wrote ${out}`);
console.log(JSON.stringify({ demoRunId, assistantMode: assistant.mode, evidenceFile: out }, null, 2));
