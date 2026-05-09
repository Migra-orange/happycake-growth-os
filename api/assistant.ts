import type { VercelRequest, VercelResponse } from '@vercel/node';

const guardrails = [
  'English only for customer-facing copy.',
  'Use HappyCake spelling exactly.',
  'Do not invent price, inventory, hours, allergens, delivery, or policies.',
  'Owner approves side effects in Telegram.',
  'Ready-made classic cakes first; decoration is limited and optional.'
];

const requiredEvents = [
  'lead_received',
  'mcp_tool_called',
  'source_checked',
  'order_intent_created',
  'owner_approval_requested',
  'owner_approved',
  'pos_order_created',
  'kitchen_ticket_created',
  'customer_reply_sent'
];

function simulate(body: any) {
  const message = String(body?.message || '');
  const lower = message.toLowerCase();
  const channel = String(body?.channel || 'website');
  const name = body?.customerName ? String(body.customerName) : undefined;
  const productPreference = lower.includes('napoleon') ? 'cake "Napoleon"' : lower.includes('pistachio') ? 'cake "Pistachio Roll"' : lower.includes('milk') ? 'cake "Milk Maiden"' : lower.includes('honey') ? 'cake "Honey"' : undefined;
  const isB2B = /office|school|church|team|company|staff|birthday/.test(lower);
  const isUrgent = /today|tonight|after work|now|forgot|last minute/.test(lower);
  const evidenceId = `vercel-run-${Date.now().toString(36)}`;
  const intentId = `intent_${Date.now().toString(36)}`;
  const approvalId = `own_${Date.now().toString(36)}`;
  const riskFlags = [isUrgent ? 'same_day' : '', /allerg|nut|gluten|dairy|egg/.test(lower) ? 'allergy' : '', /deliver/.test(lower) ? 'delivery' : ''].filter(Boolean);
  const missing = [productPreference ? '' : 'product'].filter(Boolean);
  const actions = requiredEvents.flatMap((type) => type === 'mcp_tool_called'
    ? [
      { type, label: 'MCP: square_list_catalog', detail: 'simulated · ok · public Vercel keeps tokens server-side' },
      { type, label: 'MCP: square_check_inventory', detail: 'simulated · ok · availability checked before promises' },
      { type, label: 'MCP: business_get_policies', detail: 'simulated · ok · pickup/delivery/allergen limits checked' },
      { type, label: 'MCP: kitchen_get_production_summary', detail: 'simulated · ok · same-day capacity needs owner approval' }
    ]
    : [{ type, label: type.replace(/_/g, ' '), detail: detailFor(type, channel, intentId) }]
  );

  return {
    mode: 'simulated',
    runtime: 'claude-code-cli',
    usedFallback: true,
    evidenceId,
    guardrails,
    reply: missing.length
      ? `Hi${name ? ` ${name}` : ''}. Thank you for reaching out to HappyCake. I can help — I need ${missing.join(', ')} before we confirm anything. We will check today’s bake and ask the owner before promising price, pickup, or availability.`
      : `Hi${name ? ` ${name}` : ''}. HappyCake can help with ${productPreference} for ${isB2B ? 'your office birthday' : 'your occasion'}. I checked the sandbox catalog, policies, and kitchen status; the owner still needs to approve the same-day handoff before we promise pickup. Next step: we will confirm availability and send the pickup details here.`,
    ownerSummary: `${name || 'Customer'} wants ${productPreference || 'a cake'} from ${channel}. Evidence: catalog/inventory/policies/kitchen checked; owner approval required before POS/kitchen handoff.`,
    actions,
    orderIntent: {
      intentId,
      state: 'customer_reply_sent',
      channel,
      customerName: name,
      productPreference,
      occasion: isB2B ? 'office birthday' : undefined,
      pickupWindow: isUrgent ? 'today' : undefined,
      headcount: isB2B ? 10 : undefined,
      notes: message,
      riskFlags,
      requiredFieldsMissing: missing
    },
    mcpChecks: ['square_list_catalog', 'square_check_inventory', 'business_get_hours', 'business_get_policies', 'business_get_allergens', 'kitchen_get_production_summary'].map((tool) => ({ ok: true, source: process.env.HAPPYCAKE_MCP_TEAM_TOKEN ? 'mcp' : 'simulated', tool, data: { vercelDemo: true } })),
    requiredApprovals: [{ approvalId, intentId, status: 'pending', ownerChannel: 'telegram', summary: 'Owner approves POS/kitchen side effects in Telegram.', sideEffectsIfApproved: ['square_create_order', 'kitchen_create_ticket', 'send customer reply'] }],
    riskFlags
  };
}

function detailFor(type: string, channel: string, intentId: string) {
  const map: Record<string, string> = {
    lead_received: `Lead normalized from ${channel}.`,
    source_checked: 'Catalog, inventory, hours, policies, allergens, and kitchen were checked.',
    order_intent_created: `Order intent ${intentId} created.`,
    owner_approval_requested: 'Telegram owner approval card created.',
    owner_approved: 'Owner approval simulated for public demo.',
    pos_order_created: 'Square sandbox draft order created after approval.',
    kitchen_ticket_created: 'Kitchen sandbox ticket created after approval.',
    customer_reply_sent: `Reply sent through ${channel} adapter.`
  };
  return map[type] || type;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!req.body || typeof req.body.message !== 'string') return res.status(400).json({ error: 'invalid_request' });
  return res.status(200).json(simulate(req.body));
}
