import { runAssistant } from '../src/server/assistant';
import { callMcp } from '../src/server/mcp';
import { handleOwnerAction } from '../src/server/owner-actions';

process.env.ASSISTANT_MODE = process.env.ASSISTANT_MODE || 'simulated';
process.env.MCP_MODE = process.env.MCP_MODE || 'simulated';

const assistant = await runAssistant({
  channel: 'instagram',
  source: 'Friday Office Dessert Drop',
  customerName: 'Evaluator',
  message: 'Can I order something for our office birthday today and pick it up after work?',
  requireOwnerApproval: true
});

const mcp = await callMcp('square_list_catalog', { scenario: 'evaluator_smoke' });
const owner = await handleOwnerAction({ action: 'approve_campaign', campaignId: 'office-drop', note: 'Evaluator smoke approval' });

const ok = assistant.reply.includes('office') && mcp.ok && owner.reply.includes('approved');
if (!ok) {
  console.error({ assistant, mcp, owner });
  process.exit(1);
}
console.log(JSON.stringify({ ok, assistantMode: assistant.mode, mcpSource: mcp.source, owner: owner.reply }, null, 2));
