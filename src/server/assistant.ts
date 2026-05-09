import { spawn } from 'node:child_process';
import type { AssistantRequest, AssistantResponse } from '../shared/schema';
import { runAssistantVerticalSlice } from './vertical-slice';

function shellQuoteForPrompt(value: string) {
  return value.replace(/[\u0000-\u001f]/g, ' ').slice(0, 4000);
}

function buildPrompt(req: AssistantRequest, grounded: AssistantResponse) {
  return `You are the HappyCake Growth OS sales concierge. Follow these hard rules:
- English only.
- Spell HappyCake exactly.
- Never invent prices, inventory, hours, allergens, delivery, or policies.
- Use only the MCP evidence and order intent below.
- Ready-made classic cakes first, not broad custom-cake promises.
- Owner approval in Telegram is required before side effects.

Customer channel: ${req.channel}
Customer name: ${req.customerName || 'unknown'}
Source: ${req.source || 'unknown'}
Message: ${shellQuoteForPrompt(req.message)}

MCP/order/evidence context:
${JSON.stringify({ orderIntent: grounded.orderIntent, mcpChecks: grounded.mcpChecks, approvals: grounded.requiredApprovals, fallbackReply: grounded.reply }, null, 2).slice(0, 12000)}

Return only the final concise customer-facing reply. No markdown table.`;
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

export async function runAssistant(req: AssistantRequest): Promise<AssistantResponse> {
  const mode = process.env.ASSISTANT_MODE || 'simulated';
  const grounded = await runAssistantVerticalSlice(req);

  if (mode !== 'live') return grounded;

  const timeoutMs = Number(process.env.CLAUDE_TIMEOUT_MS || 90000);
  const liveReply = await runClaude(buildPrompt(req, grounded), timeoutMs);
  return {
    ...grounded,
    mode: 'live',
    usedFallback: false,
    reply: liveReply,
    ownerSummary: `Live Claude Code CLI reply generated from MCP-grounded evidence. ${grounded.ownerSummary}`
  };
}
