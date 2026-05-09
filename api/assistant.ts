import type { VercelRequest, VercelResponse } from '@vercel/node';

const guardrails = [
  'English only for customer-facing copy.',
  'Use HappyCake spelling exactly.',
  'Do not invent price, inventory, hours, allergens, or delivery rules.',
  'Posts and paid ads require owner approval in Telegram before publishing.',
  'Ready-made classic cakes first; decoration is limited and optional.'
];

function simulate(body: any) {
  const message = String(body?.message || '').toLowerCase();
  const channel = String(body?.channel || 'website');
  const isB2B = /office|school|church|team|company|staff|birthday/.test(message);
  const isUrgent = /today|tonight|after work|now|forgot|last minute/.test(message);
  const evidenceId = `ev_${Date.now().toString(36)}`;
  return {
    mode: 'simulated',
    runtime: 'claude-code-cli',
    usedFallback: true,
    evidenceId,
    guardrails,
    reply: isB2B
      ? 'Hi, friends. For an office or group, the easiest path is ready-made classic cakes or dessert trays. What pickup day/time and approximate guest count should we plan for? I’ll confirm options before quoting price or availability.'
      : isUrgent
        ? 'Absolutely — we can help you check today’s ready-made options. What time do you want to pick up, how many people should it serve, and do you want a short message on the cake? I’ll confirm availability before promising anything.'
        : 'Happy to help. Tell me the occasion, pickup day, guest count, and flavor direction, and I’ll guide you to the best ready-made HappyCake option without guessing price or availability.',
    ownerSummary: isB2B
      ? 'B2B/coordinator lead from ' + channel + '. Capture organization, headcount, pickup cadence, and owner-approved follow-up offer.'
      : isUrgent
        ? 'Urgent same-day lead from ' + channel + '. Needs source-of-truth inventory check and owner/kitchen confirmation before commitment.'
        : 'Warm lead from ' + channel + '. Collect occasion details and route to today’s source of truth.',
    actions: [
      { type: 'mcp_tool_check', label: 'MCP: square_list_catalog', detail: 'simulated · ok · real sandbox uses X-Team-Token server-side' },
      { type: 'mcp_tool_check', label: 'MCP: kitchen_get_production_summary', detail: 'simulated · ok · check capacity before promising same-day pickup' },
      ...(isB2B ? [{ type: 'mcp_tool_check', label: 'MCP: marketing_create_campaign', detail: 'simulated · ok · draft campaign requires owner approval' }] : []),
      { type: 'lead_capture', label: 'Create lead', detail: isB2B ? 'office/school/church recurring funnel' : 'same-day ready-made cake funnel' },
      { type: 'source_of_truth_check', label: 'Check inventory/POS', detail: 'Do not invent price, pickup time, or availability.' },
      { type: 'telegram_card', label: 'Owner approval', detail: 'Owner approves campaign/order handoff in Telegram before publishing or confirming.' },
      { type: 'marketing_attribution', label: 'Attribute source', detail: String(body?.source || 'vercel-demo') }
    ]
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!req.body || typeof req.body.message !== 'string') return res.status(400).json({ error: 'invalid_request' });
  return res.status(200).json(simulate(req.body));
}
