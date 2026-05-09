import type { AssistantRequest, AssistantResponse } from '../shared/schema';
import { randomUUID } from 'node:crypto';

const guardrails = [
  'English only for customer-facing copy.',
  'Use HappyCake spelling exactly.',
  'Do not invent price, inventory, hours, allergens, or delivery rules.',
  'Posts and paid ads require owner approval in Telegram before publishing.',
  'Ready-made classic cakes first; decoration is limited and optional.'
];

export function simulateAssistant(req: AssistantRequest): AssistantResponse {
  const text = req.message.toLowerCase();
  const evidenceId = `ev_${randomUUID()}`;
  const isOffice = /office|school|church|team|staff|hr|teacher|tray/.test(text);
  const isComplaint = /complain|bad|wrong|late|refund|upset|dry/.test(text);
  const isSameDay = /today|tonight|now|same.?day|forgot|pickup/.test(text);

  if (isComplaint) {
    return {
      mode: 'simulated', runtime: 'claude-code-cli', usedFallback: true, evidenceId, guardrails,
      reply: "Hi — I'm sorry, that's on us. Please send the order name and pickup time, and we'll route this to the HappyCake team right away before we explain anything.",
      ownerSummary: 'Complaint detected. Owner review required before resolution offer.',
      actions: [
        { type: 'owner_escalation', label: 'Escalate complaint', detail: 'Send Telegram owner alert with customer message and requested contact.' },
        { type: 'evidence', label: 'Log private recovery flow', detail: 'Do not reply with marketing copy to a complaint.' }
      ]
    };
  }

  if (isOffice) {
    return {
      mode: 'simulated', runtime: 'claude-code-cli', usedFallback: true, evidenceId, guardrails,
      reply: "Hi, friends. For an office or school group, the easiest path is a dessert tray or two classic cakes. What day do you need pickup, and about how many guests should we serve?",
      ownerSummary: 'B2B/coordinator lead. Potential recurring account; collect organization, headcount, day, and contact person.',
      actions: [
        { type: 'lead_capture', label: 'Create coordinator lead', detail: 'office/school/church recurring funnel' },
        { type: 'telegram_card', label: 'Owner lead card', detail: 'Ask owner to approve follow-up offer.' },
        { type: 'marketing_attribution', label: 'Attribute source', detail: req.source || req.channel }
      ]
    };
  }

  if (isSameDay) {
    return {
      mode: 'simulated', runtime: 'claude-code-cli', usedFallback: true, evidenceId, guardrails,
      reply: "Hi. We can help you check today’s bake. What time would you like to pick up, and are you choosing for family, office, or a gift?",
      ownerSummary: 'Same-day order intent. Check catalog, inventory, kitchen capacity, then create POS/kitchen handoff.',
      actions: [
        { type: 'mcp_check', label: 'Check today’s bake', detail: 'square_list_catalog + kitchen_get_production_summary' },
        { type: 'order_intent', label: 'Qualify order', detail: 'occasion, pickup time, product, quantity, note' },
        { type: 'kitchen_handoff', label: 'Prepare kitchen ticket', detail: 'Only after source-of-truth availability check.' }
      ]
    };
  }

  return {
    mode: 'simulated', runtime: 'claude-code-cli', usedFallback: true, evidenceId, guardrails,
    reply: "Hi, friends. I can help you choose a classic HappyCake cake. Is this for a birthday, family dinner, office treat, or another occasion?",
    ownerSummary: 'General product guidance. Continue to occasion → size → pickup timing → source-of-truth check.',
    actions: [
      { type: 'consultation', label: 'Ask occasion first', detail: 'Occasion determines product, size, timing, and campaign attribution.' },
      { type: 'next_step', label: 'Clear next step', detail: 'Collect pickup date/time before promising availability.' }
    ]
  };
}
