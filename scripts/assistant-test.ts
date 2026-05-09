import { runAssistant } from '../src/server/assistant';
import { AssistantRequestSchema } from '../src/shared/schema';

process.env.ASSISTANT_MODE = process.env.ASSISTANT_MODE || 'simulated';

const req = AssistantRequestSchema.parse({
  channel: 'instagram',
  message: 'I forgot a cake for our office birthday today. Can we pick something up after work?',
  customerName: 'Maya',
  source: 'assistant-test'
});

const result = await runAssistant(req);
if (!result.reply || result.runtime !== 'claude-code-cli') throw new Error('Invalid assistant response');
console.log(JSON.stringify(result, null, 2));
