import { spawn } from 'node:child_process';
import type { AssistantRequest, AssistantResponse } from '../shared/schema';
import { simulateAssistant } from './simulator';
import { callMcp } from './mcp';

function shellQuoteForPrompt(value: string) {
  return value.replace(/[\u0000-\u001f]/g, ' ').slice(0, 4000);
}

function buildPrompt(req: AssistantRequest) {
  return `You are the HappyCake Growth OS sales concierge. Follow these rules: English only; spell HappyCake exactly; warm simple voice; never invent prices, inventory, hours, allergens, delivery, or policies; ask MCP/source-of-truth or owner when uncertain; ready-made classic cakes first, not custom cakes; paid posts require Telegram owner approval.\n\nCustomer channel: ${req.channel}\nCustomer name: ${req.customerName || 'unknown'}\nSource: ${req.source || 'unknown'}\nMessage: ${shellQuoteForPrompt(req.message)}\n\nReturn a concise customer reply, owner summary, required MCP/tool checks, and evidence notes.`;
}

function runClaude(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', prompt, '--max-turns', '4'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Claude Code CLI timed out')); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) resolve(stdout.trim());
      else reject(new Error(`claude -p failed: ${stderr.slice(0, 500)}`));
    });
  });
}

async function runRequiredMcpTools(req: AssistantRequest) {
  const text = req.message.toLowerCase();
  const tools: Array<{ tool: string; input: Record<string, unknown> }> = [
    { tool: 'square_list_catalog', input: { channel: req.channel, source: req.source, intent: req.message.slice(0, 240) } },
    { tool: 'kitchen_get_production_summary', input: { urgency: /today|tonight|after work|now|forgot|last minute/.test(text) ? 'same_day' : 'standard' } }
  ];
  if (/office|school|church|team|company|staff|birthday/.test(text)) {
    tools.push({ tool: 'marketing_create_campaign', input: { segment: 'local_coordinator', requiresOwnerApproval: true } });
  }
  if (req.channel === 'instagram') tools.push({ tool: 'instagram_send_reply', input: { dryRun: true, requiresOwnerApproval: req.requireOwnerApproval } });
  if (req.channel === 'whatsapp') tools.push({ tool: 'whatsapp_send_reply', input: { dryRun: true, requiresOwnerApproval: req.requireOwnerApproval } });
  return Promise.all(tools.map(t => callMcp(t.tool, t.input).catch(error => ({ ok: false, source: 'simulated' as const, tool: t.tool, data: { error: error instanceof Error ? error.message : 'unknown_mcp_error' } }))));
}

export async function runAssistant(req: AssistantRequest): Promise<AssistantResponse> {
  const mode = process.env.ASSISTANT_MODE || 'simulated';
  const timeoutMs = Number(process.env.CLAUDE_TIMEOUT_MS || 90000);
  const mcpChecks = await runRequiredMcpTools(req);
  const mcpActions = mcpChecks.map(check => ({
    type: 'mcp_tool_check',
    label: `MCP: ${check.tool}`,
    detail: `${check.source} · ${check.ok ? 'ok' : 'failed'} · ${JSON.stringify(check.data).slice(0, 180)}`
  }));

  if (mode === 'simulated') {
    const simulated = simulateAssistant(req);
    return { ...simulated, actions: [...mcpActions, ...simulated.actions] };
  }

  try {
    const live = await runClaude(buildPrompt(req), timeoutMs);
    const simulated = simulateAssistant(req);
    return {
      ...simulated,
      mode: 'live',
      usedFallback: false,
      reply: live,
      actions: [...mcpActions, ...simulated.actions],
      ownerSummary: `Live Claude Code CLI response generated after MCP tool checks. ${simulated.ownerSummary}`
    };
  } catch (err) {
    if (mode === 'live') throw err;
    const simulated = simulateAssistant(req);
    return { ...simulated, actions: [...mcpActions, ...simulated.actions] };
  }
}
