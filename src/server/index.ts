import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { AssistantRequestSchema } from '../shared/schema';
import { runAssistant } from './assistant';
import { appendEvidence, listEvidence } from './evidence';
import { getManifest } from './manifest';
import { getTelegramBots } from './telegram';
import { handleOwnerAction } from './owner-actions';
import { callMcp } from './mcp';

const app = express();
const port = Number(process.env.PORT || 8787);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));
app.use('/data', express.static(path.resolve(process.cwd(), 'public/data')));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'happycake-growth-os', runtime: 'claude-code-cli', time: new Date().toISOString() }));
app.get('/api/manifest', (_req, res) => res.json(getManifest()));
app.get('/api/evidence', (_req, res) => res.json({ items: listEvidence() }));
app.get('/api/telegram/bots', (_req, res) => res.json({ bots: getTelegramBots().map((b) => ({ ...b, token: undefined })) }));
app.get('/api/mcp/smoke', async (_req, res) => res.json(await callMcp('square_list_catalog', { smoke: true })));

app.post('/api/assistant', async (req, res) => {
  const parsed = AssistantRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_request', issues: parsed.error.issues });
  const demo_run_id = `assistant-${Date.now()}`;
  try {
    const response = await runAssistant(parsed.data);
    appendEvidence({
      demo_run_id,
      type: 'assistant_response',
      channel: parsed.data.channel,
      summary: response.ownerSummary,
      entity_id: response.evidenceId,
      data: { request: parsed.data, response: { ...response, guardrails: response.guardrails } }
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'assistant_failed', message: error instanceof Error ? error.message : 'unknown error' });
  }
});

app.post('/api/telegram/owner-action', async (req, res) => {
  const demo_run_id = `owner-${Date.now()}`;
  const result = await handleOwnerAction(req.body);
  appendEvidence({ demo_run_id, type: 'owner_telegram_action', channel: 'telegram', summary: result.reply, entity_id: req.body?.campaignId || req.body?.action || 'owner_action', data: { request: req.body, result } });
  res.json(result);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`HappyCake Growth OS API listening on http://localhost:${port}`));
}

export default app;
