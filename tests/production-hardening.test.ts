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

  it('keeps unauthenticated owner dashboard judge-visible but strips actionable queue details', () => {
    const dashboard = read('api/owner/dashboard.ts');
    const app = read('src/web/App.tsx');

    expect(dashboard).toContain('function hasOwnerToken');
    expect(dashboard).toContain('publicQueueLabel');
    expect(dashboard).toContain('customer details are private');
    expect(dashboard).toContain('approvalId: authenticated ? item.approvalId');
    expect(dashboard).toContain('intentId: authenticated ? item.intentId');
    expect(dashboard).toContain('summary: authenticated ? item.summary');
    expect(dashboard).toContain('executedSideEffects: authenticated ? item.executedSideEffects : []');
    expect(dashboard).toContain('const ownerAuthenticated = hasOwnerToken(req)');
    expect(app).toContain('fetch(`${API}/api/owner/dashboard`, { headers: ownerHeaders(tokenOverride) })');
  });
});
