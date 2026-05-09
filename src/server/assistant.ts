import { spawn } from 'node:child_process';
import type { AssistantRequest, AssistantResponse } from '../shared/schema';
import { simulateAssistant } from './simulator';

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

export async function runAssistant(req: AssistantRequest): Promise<AssistantResponse> {
  const mode = process.env.ASSISTANT_MODE || 'simulated';
  const timeoutMs = Number(process.env.CLAUDE_TIMEOUT_MS || 12000);

  if (mode === 'simulated') return simulateAssistant(req);

  try {
    const live = await runClaude(buildPrompt(req), timeoutMs);
    const simulated = simulateAssistant(req);
    return {
      ...simulated,
      mode: 'live',
      usedFallback: false,
      reply: live,
      ownerSummary: `Live Claude Code CLI response generated. ${simulated.ownerSummary}`
    };
  } catch (err) {
    if (mode === 'live') throw err;
    return simulateAssistant(req);
  }
}
