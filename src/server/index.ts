import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { AssistantRequestSchema } from '../shared/schema';
import { runAssistant } from './assistant';
import { appendEvidence, listEvidence, summarizeTimeline } from './evidence';
import { getManifest } from './manifest';
import { getTelegramBots } from './telegram';
import { handleOwnerAction } from './owner-actions';
import { callMcp } from './mcp';
import { normalizeLead, leadToAssistantRequest } from './channels/types';
import { runSandboxVerticalSlice } from './vertical-slice';

const app = express();
const port = Number(process.env.PORT || 8787);
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));
app.use('/data', express.static(path.resolve(process.cwd(), 'public/data')));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'happycake-growth-os', runtime: 'claude-code-cli', time: new Date().toISOString() }));
app.get('/api/manifest', (_req, res) => res.json(getManifest()));
app.get('/api/evidence', (_req, res) => res.json({ items: listEvidence() }));
app.get('/api/evidence/:runId', (req, res) => res.json(summarizeTimeline(req.params.runId)));
app.get('/api/telegram/bots', (_req, res) => res.json({ bots: getTelegramBots().map((b) => ({ ...b, token: undefined })) }));
app.get('/api/mcp/smoke', async (_req, res) => {
  const demoRunId = `smoke-${Date.now()}`;
  const results = await Promise.all([
    callMcp('square_list_catalog', { smoke: true }, { demoRunId, channel: 'demo' }),
    callMcp('kitchen_get_production_summary', { smoke: true }, { demoRunId, channel: 'demo' }),
    callMcp('business_get_policies', { smoke: true }, { demoRunId, channel: 'demo' }),
    callMcp('evaluator_get_summary', { smoke: true }, { demoRunId, channel: 'demo' })
  ]);
  res.json({ ok: results.every((r) => r.ok), demoRunId, results });
});

app.post('/api/assistant', async (req, res) => {
  const parsed = AssistantRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_request', issues: parsed.error.issues });
  try {
    const response = await runAssistant(parsed.data);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'assistant_failed', message: error instanceof Error ? error.message : 'unknown error' });
  }
});

app.post('/api/webhooks/instagram', async (req, res) => {
  const lead = normalizeLead(req.body, { channel: 'instagram' });
  const demoRunId = `instagram-${Date.now()}`;
  const response = await runAssistant(leadToAssistantRequest(lead, demoRunId));
  res.json({ ok: true, demoRunId, lead, response });
});

app.post('/api/webhooks/whatsapp', async (req, res) => {
  const lead = normalizeLead(req.body, { channel: 'whatsapp' });
  const demoRunId = `whatsapp-${Date.now()}`;
  const response = await runAssistant(leadToAssistantRequest(lead, demoRunId));
  res.json({ ok: true, demoRunId, lead, response });
});

app.post('/api/demo/vertical-slice', async (req, res) => {
  const result = await runSandboxVerticalSlice({
    channel: req.body?.channel || 'instagram',
    customerName: req.body?.customerName || 'Maya Chen',
    customerHandle: req.body?.customerHandle || '@maya.office',
    source: req.body?.source || 'Friday Office Dessert Drop',
    message: req.body?.message || 'Can I order cake "Honey" for our office birthday today and pick it up after work?',
    approveOwnerAction: req.body?.approveOwnerAction !== false
  });
  res.json(result);
});

app.post('/api/telegram/owner-action', async (req, res) => {
  if (process.env.OWNER_API_TOKEN && req.header('x-owner-token') !== process.env.OWNER_API_TOKEN) {
    return res.status(401).json({ error: 'owner_auth_required' });
  }
  const demo_run_id = `owner-${Date.now()}`;
  const result = await handleOwnerAction(req.body);
  appendEvidence({ demo_run_id, type: 'owner_telegram_action', channel: 'telegram', summary: result.reply, entity_id: req.body?.campaignId || req.body?.intentId || req.body?.action || 'owner_action', data: { request: req.body, result } });
  res.json(result);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`HappyCake Growth OS API listening on http://localhost:${port}`));
}

export default app;
