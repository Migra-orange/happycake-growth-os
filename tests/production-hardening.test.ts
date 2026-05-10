import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('production hardening gates', () => {
  it('ships a real Telegram webhook route with callback approval/reject handling', () => {
    expect(existsSync('api/telegram/webhook.ts')).toBe(true);
    const webhook = read('api/telegram/webhook.ts');

    expect(webhook).toContain('callback_query');
    expect(webhook).toContain('answerCallbackQuery');
    expect(webhook).toContain('ensureTelegramWebhook');
    expect(webhook).toContain('secret_token: secret');
    expect(webhook).toContain("allowed_updates: ['callback_query']");
    expect(webhook).toContain('webhookRepairOk');
    expect(webhook).toContain('hc:approve:');
    expect(webhook).toContain('hc:reject:');
    expect(webhook).toContain('TELEGRAM_WEBHOOK_SECRET');
    expect(webhook).toContain('TELEGRAM_OWNER_CHAT_ID');
    expect(webhook).toContain('owner_not_allowed');
  });

  it('sends owner approval cards from the website assistant when Telegram env is configured', () => {
    const assistant = read('api/assistant.ts');

    expect(assistant).toContain('sendTelegramOwnerCard');
    expect(assistant).toContain('https://api.telegram.org/bot');
    expect(assistant).toContain('inline_keyboard');
    expect(assistant).toContain('hc:approve:');
    expect(assistant).toContain('hc:reject:');
    expect(assistant).toContain('ownerDelivery');
  });

  it('durably records owner decisions before calling MCP side-effect tools', () => {
    const ownerAction = read('api/telegram/owner-action.ts');

    expect(ownerAction).toContain('idempotentReplay');
    expect(ownerAction).toContain("approval.status === 'approved'");
    expect(ownerAction).toContain("approval.status === 'rejected'");
    const handlerSection = ownerAction.slice(ownerAction.indexOf('export default async function handler'));
    expect(handlerSection.indexOf("approval.status === 'approved'")).toBeLessThan(handlerSection.indexOf('const mcpCalls = rejected'));
    expect(handlerSection).toContain('missingSideEffects');
    expect(handlerSection).toContain('decisionSavedBeforeSideEffects');
    expect(handlerSection.indexOf('decisionSavedBeforeSideEffects')).toBeLessThan(handlerSection.indexOf('const mcpCalls = rejected'));
    expect(handlerSection.indexOf('approval_persistence_failed')).toBeLessThan(handlerSection.indexOf('const mcpCalls = rejected'));
    expect(handlerSection).toContain('runMissingApprovedSideEffects(approval, missingSideEffects)');
    expect(handlerSection).toContain('idempotencyKey');
  });

  it('sanitizes customer-provided names before storing approval records', () => {
    const assistant = read('api/assistant.ts');

    expect(assistant).toContain('const rawName');
    expect(assistant).toContain('const safeName');
    expect(assistant).toContain("customer: safeName || 'Website customer'");
    expect(assistant).toContain("summary: `${safeName || 'Customer'} wants");
    expect(assistant).not.toContain("customer: name || 'Website customer'");
  });

  it('adds abuse protection to public and owner mutation endpoints', () => {
    const assistant = read('api/assistant.ts');
    const ownerAction = read('api/telegram/owner-action.ts');
    const birthday = read('api/birthday-reminder.ts');
    const discount = read('api/discount-claim.ts');
    const webhook = read('api/telegram/webhook.ts');

    for (const source of [assistant, ownerAction, birthday, discount, webhook]) {
      expect(source).toContain('checkRateLimit');
      expect(source).toContain('rate_limited');
      expect(source).toContain('429');
    }
  });

  it('keeps mutating MCP audit scenario runs owner-token gated', () => {
    const audit = read('api/mcp/audit.ts');

    expect(audit).toContain('function hasOwnerToken');
    expect(audit).toContain('owner_auth_required');
    expect(audit).toContain("req.method === 'POST'");
    expect(audit.indexOf('owner_auth_required')).toBeLessThan(audit.indexOf('const tools = runScenario'));
  });

  it('makes MCP smoke proof explicit about live mode and fallback state', () => {
    const smoke = read('api/mcp/smoke.ts');

    expect(smoke).toContain("mode: 'live'");
    expect(smoke).toContain('usedFallback: false');
    expect(smoke).toContain("mode: 'simulated'");
    expect(smoke).toContain('usedFallback: true');
    expect(smoke).toContain('mcp_token_missing');
  });

  it('labels Vercel health and assistant responses as serverless MCP demo without over-claiming Claude CLI execution', () => {
    const health = read('api/health.ts');
    const assistant = read('api/assistant.ts');

    expect(health).toContain("localRuntime: 'claude-code-cli'");
    expect(health).toContain("productionRuntime: 'vercel_serverless_mcp_demo'");
    expect(health).toContain('claudeCliProductionExecuted: false');
    expect(health).toContain("localProofPath: 'src/server/assistant.ts'");
    expect(assistant).toContain("localRuntime: 'claude-code-cli'");
    expect(assistant).toContain("productionRuntime: 'vercel_serverless_mcp_demo'");
    expect(assistant).toContain('claudeCliProductionExecuted: false');
    expect(assistant).not.toContain("runtime: 'claude-code-cli'");
  });

  it('documents hackathon-required owner-bot mapping in architecture', () => {
    const architecture = read('ARCHITECTURE.md');

    expect(architecture).toContain('## Owner-bot mapping');
    expect(architecture).toContain('HappyCake Owner Bot');
    expect(architecture).toContain('api/telegram/webhook.ts');
    expect(architecture).toContain('api/telegram/owner-action.ts');
    expect(architecture).toContain('Judge evidence cockpit');
    expect(architecture).toContain('real owner operation is Telegram-first');
  });

  it('keeps the manifest vertical slice owner-approval-first before POS/kitchen handoff', () => {
    const manifest = JSON.parse(read('public/agent-manifest.json')) as { verticalSlice: string };

    expect(manifest.verticalSlice).toContain('Owner Telegram Approval');
    expect(manifest.verticalSlice.indexOf('Owner Telegram Approval')).toBeLessThan(manifest.verticalSlice.indexOf('POS/Kitchen Handoff'));
  });

  it('does not present high-value public discounts as guaranteed checkout savings', () => {
    const app = read('src/web/App.tsx');

    expect(app).not.toContain('50% off');
    expect(app).not.toContain('Use it at checkout to get');
    expect(app).toContain('bakery-confirmed checkout');
    expect(app).toContain('bakery confirms the offer');
  });

  it('requires live MCP side-effect acknowledgements before recording owner side effects', () => {
    const ownerAction = read('api/telegram/owner-action.ts');

    expect(ownerAction).toContain("call.source !== 'mcp'");
    expect(ownerAction).toContain('side_effect_not_live_mcp');
    expect(ownerAction).toContain('hasMcpResultError(call.data)');
    expect(ownerAction).toContain('inputForSideEffect(tool, record)');
    const sideEffectRunner = ownerAction.slice(ownerAction.indexOf('const runMissingApprovedSideEffects'));
    expect(sideEffectRunner.indexOf("call.source !== 'mcp'")).toBeLessThan(sideEffectRunner.indexOf('record.executedSideEffects = Array.from'));
    expect(sideEffectRunner.indexOf('hasMcpResultError(call.data)')).toBeLessThan(sideEffectRunner.indexOf('record.executedSideEffects = Array.from'));
  });

  it('keeps production owner approval live when Steppe side-effect tools require an audit wrapper', () => {
    const ownerAction = read('api/telegram/owner-action.ts');

    expect(ownerAction).toContain("const delegatedSideEffectTool = 'marketing_report_to_owner'");
    expect(ownerAction).toContain('requestedTool: tool');
    expect(ownerAction).toContain('delegatedTool: delegatedSideEffectTool');
    expect(ownerAction).toContain('source: \'mcp\', tool');
    expect(ownerAction).toContain('sideEffectDelegated: true');
    const delegatedBranch = ownerAction.slice(ownerAction.indexOf('if (canDelegateSideEffect)'));
    expect(delegatedBranch.indexOf('mcpEnvelope(delegatedSideEffectTool, delegatedInput)')).toBeLessThan(delegatedBranch.indexOf('const upstream = await fetch'));
  });

  it('keeps local Express owner actions fail-closed when the owner token is missing', () => {
    const server = read('src/server/index.ts');

    expect(server).toContain('!process.env.OWNER_API_TOKEN');
    expect(server).toContain("req.header('x-owner-token') !== process.env.OWNER_API_TOKEN");
  });

  it('answers serving-size chat questions without creating an order request', () => {
    const app = read('src/web/App.tsx');

    expect(app).toContain('function localCakeGuidance');
    expect(app).toContain('is listed as ${servingMatch.serves}');
    expect(app).toContain('const localReply = localCakeGuidance(message, products)');
    expect(app).toContain('const headcountMatch');
    expect(app).not.toContain("const asksRecommendation = /\\b(which|what|recommend|fit|fits|best|good)\\b/");
    const chatSubmit = app.slice(app.indexOf('async function submitChatMessage'));
    expect(chatSubmit.indexOf('const localReply = localCakeGuidance(message, products)')).toBeLessThan(chatSubmit.indexOf("fetch(`${API}/api/assistant`"));
  });

  it('keeps unauthenticated owner dashboard judge-visible but strips actionable queue details', () => {
    const dashboard = read('api/owner/dashboard.ts');
    const app = read('src/web/App.tsx');

    expect(dashboard).toContain('function hasOwnerToken');
    expect(dashboard).toContain('function publicQueueLabel');
    expect(dashboard).toContain('Public scheduled follow-up queue item ${index + 1}');
    expect(dashboard).toContain('Public pending approval queue item ${index + 1}');
    expect(dashboard).toContain('customer details are private');
    expect(dashboard).toContain('approvalId: authenticated ? item.approvalId');
    expect(dashboard).toContain('intentId: authenticated ? item.intentId');
    expect(dashboard).toContain('summary: authenticated ? item.summary');
    expect(dashboard).toContain('executedSideEffects: authenticated ? item.executedSideEffects : []');
    expect(dashboard).toContain('const ownerAuthenticated = hasOwnerToken(req)');
    expect(app).toContain('fetch(`${API}/api/owner/dashboard`, { headers: ownerHeaders(tokenOverride) })');
    expect(app).toContain("item.status === 'pending' && ownerToken.trim()");
  });

  it('uses non-customer public queue labels that distinguish pending approvals from follow-up work', () => {
    const dashboard = read('api/owner/dashboard.ts');

    expect(dashboard).toContain('Public scheduled follow-up queue item');
    expect(dashboard).toContain('Public pending approval queue item');
    expect(dashboard).not.toContain('return `Scheduled follow-up ${index + 1}`');
    expect(dashboard).not.toContain('return `Pending approval ${index + 1}`');
  });

  it('fails closed when a required owner approval cannot be persisted to durable Blob storage', () => {
    const assistant = read('api/assistant.ts');

    expect(assistant).toContain('const approvalSaved = approvalStore ? await saveApprovalStore(approvalStore) : false');
    expect(assistant).toContain("if (approvalStore && process.env.BLOB_READ_WRITE_TOKEN && !approvalSaved) throw new Error('approval_persistence_failed')");
    expect(assistant).toContain("if (error instanceof Error && error.message === 'approval_persistence_failed')");
    expect(assistant).toContain("return res.status(502).json({ error: 'approval_persistence_failed' })");
    const persistenceGuard = "if (approvalStore && process.env.BLOB_READ_WRITE_TOKEN && !approvalSaved) throw new Error('approval_persistence_failed')";
    const ownerDeliveryCall = 'const ownerDelivery = approvalRecord ? await sendTelegramOwnerCard(approvalRecord)';
    expect(assistant.indexOf(persistenceGuard)).toBeLessThan(assistant.indexOf(ownerDeliveryCall));
  });
});
