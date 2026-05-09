import type { McpResult, McpToolName } from '../shared/schema';
import { McpToolNameSchema } from '../shared/schema';
import { appendEvidence } from './evidence';

type CallOptions = { demoRunId?: string; channel?: string; entityId?: string };

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';

function getToken() {
  return process.env.HAPPYCAKE_MCP_TEAM_TOKEN || process.env.HAPPYCAKE_TEAM_TOKEN;
}

export const requiredMcpTools: McpToolName[] = [
  'square_list_catalog',
  'square_check_inventory',
  'business_get_hours',
  'business_get_policies',
  'business_get_allergens',
  'kitchen_get_production_summary',
  'square_create_order',
  'kitchen_create_ticket',
  'instagram_send_reply',
  'whatsapp_send_reply',
  'website_send_reply',
  'owner_action_log',
  'evaluator_record_event'
];

export async function callMcp(tool: McpToolName | string, payload: Record<string, unknown> = {}, options: CallOptions = {}): Promise<McpResult> {
  const parsedTool = McpToolNameSchema.parse(tool);
  const started = Date.now();
  const token = getToken();
  let result: McpResult;

  if (!token || process.env.MCP_MODE === 'simulated') {
    result = simulatedMcp(parsedTool, payload);
  } else {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Team-Token': token
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `hc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
          method: 'tools/call',
          params: { name: parsedTool, arguments: payload }
        })
      });
      const data = await res.json().catch(() => ({ raw: 'non_json_response' })) as Record<string, unknown>;
      const ok = res.ok && !(data && typeof data === 'object' && 'error' in data);
      result = { ok, source: 'mcp', tool: parsedTool, data };
      if (!ok && process.env.MCP_MODE === 'live') throw new Error(`MCP ${parsedTool} failed with ${res.status}`);
    } catch (error) {
      if (process.env.MCP_MODE === 'live') throw error;
      result = { ...simulatedMcp(parsedTool, payload), data: { ...simulatedMcp(parsedTool, payload).data, fallbackReason: error instanceof Error ? error.message : 'mcp_error' } };
    }
  }

  result.latencyMs = Date.now() - started;
  if (options.demoRunId) {
    const ev = appendEvidence({
      demo_run_id: options.demoRunId,
      type: 'mcp_tool_called',
      channel: options.channel || 'demo',
      entity_id: options.entityId || parsedTool,
      summary: `${parsedTool} ${result.ok ? 'succeeded' : 'failed'} from ${result.source}`,
      data: { tool: parsedTool, input: payload, result }
    });
    result.evidenceEventId = ev.event_id;
  }
  return result;
}

function simulatedMcp(tool: McpToolName, payload: Record<string, unknown>): McpResult {
  const fixtures: Record<McpToolName, Record<string, unknown>> = {
    square_list_catalog: {
      catalogVersion: 'sandbox-2026-05',
      products: [
        { sku: 'HC-HONEY-12', name: 'cake "Honey"', priceUsd: 42, serves: 10, sameDay: true },
        { sku: 'HC-NAPOLEON-12', name: 'cake "Napoleon"', priceUsd: 46, serves: 10, sameDay: true },
        { sku: 'HC-MILKMAID-10', name: 'cake "Milk Maiden"', priceUsd: 39, serves: 8, sameDay: false },
        { sku: 'HC-PISTACHIO-10', name: 'cake "Pistachio Roll"', priceUsd: 44, serves: 8, sameDay: true }
      ]
    },
    square_check_inventory: { available: true, sku: payload.sku || 'HC-HONEY-12', quantityAvailable: 4, checkedAt: new Date().toISOString() },
    business_get_hours: { today: '10:00–19:00', pickupCutoff: '18:30', timezone: 'America/Chicago' },
    business_get_policies: { pickup: 'Pickup in Sugar Land after confirmation.', delivery: 'Delivery requires owner confirmation.', custom: 'Ready-made cakes first; simple text decoration may require approval.', refunds: 'Owner reviews issues case by case.' },
    business_get_allergens: { disclaimer: 'Cakes may contain gluten, dairy, eggs, nuts, and shared-kitchen allergens. Allergy questions require owner confirmation.' },
    kitchen_get_production_summary: { capacityStatus: 'available_with_owner_confirmation', sameDaySlots: 3, risk: payload.urgency === 'same_day' ? 'same_day_needs_owner_approval' : 'normal' },
    kitchen_create_ticket: { ticketId: `kit_${Date.now()}`, status: 'created', station: 'cake_counter', readyWindow: 'after owner confirmation' },
    kitchen_accept_ticket: { status: 'accepted' },
    kitchen_mark_ready: { status: 'ready' },
    square_create_order: { orderId: `sq_${Date.now()}`, status: 'draft_created', paymentStatus: 'not_collected_in_sandbox' },
    square_update_order_status: { status: payload.status || 'updated' },
    instagram_send_reply: { messageId: `ig_${Date.now()}`, dryRun: payload.dryRun !== false, status: 'queued_in_sandbox' },
    whatsapp_send_reply: { messageId: `wa_${Date.now()}`, dryRun: payload.dryRun !== false, status: 'queued_in_sandbox' },
    website_send_reply: { messageId: `web_${Date.now()}`, dryRun: false, status: 'shown_on_site' },
    marketing_create_campaign: { campaignId: payload.campaignId || `camp_${Date.now()}`, status: 'draft', ownerApprovalRequired: true },
    marketing_daily_report: { revenueRange: '$15k–$20k/mo', focus: 'same-day classics + review generation + office coordinators' },
    google_business_create_post: { postId: `gb_${Date.now()}`, status: 'draft', ownerApprovalRequired: true },
    owner_action_log: { logged: true, ownerChannel: 'telegram' },
    evaluator_record_event: { recorded: true, scenario: payload.scenario || 'vertical_slice' },
    evaluator_get_summary: { scoreInputs: ['timeline', 'mcp_calls', 'owner_approval', 'handoff'] }
  };
  return { ok: true, source: 'simulated', tool, data: { ...fixtures[tool], input: payload } };
}
