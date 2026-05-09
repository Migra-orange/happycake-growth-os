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
  'square_get_pos_summary',
  'kitchen_get_production_summary',
  'evaluator_get_evidence_summary',
  'marketing_report_to_owner',
  'square_create_order',
  'kitchen_create_ticket',
  'website_send_reply'
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
    square_get_pos_summary: { status: 'checked', openDraftOrders: 0, source: 'sandbox_pos_summary' },
    square_create_order: { orderId: `sq_${Date.now()}`, status: 'draft_created', paymentStatus: 'not_collected_in_sandbox' },
    square_update_order_status: { status: payload.status || 'updated' },
    kitchen_get_production_summary: { capacityStatus: 'available_with_owner_confirmation', sameDaySlots: 3, risk: payload.urgency === 'same_day' ? 'same_day_needs_owner_approval' : 'normal' },
    kitchen_create_ticket: { ticketId: `kit_${Date.now()}`, status: 'created', station: 'cake_counter', readyWindow: 'after owner confirmation' },
    kitchen_accept_ticket: { status: 'accepted' },
    kitchen_reject_ticket: { status: 'rejected' },
    marketing_create_campaign: { campaignId: payload.campaignId || `camp_${Date.now()}`, status: 'draft', ownerApprovalRequired: true },
    marketing_launch_simulated_campaign: { status: 'launched_in_simulator' },
    marketing_generate_leads: { leadsGenerated: 3 },
    marketing_report_to_owner: { reported: true, ownerChannel: 'telegram' },
    world_start_scenario: { scenarioId: payload.scenarioId || `world_${Date.now()}`, status: 'started' },
    world_next_event: { event: 'customer_interest' },
    world_advance_time: { advanced: true },
    world_get_scenario_summary: { status: 'running' },
    evaluator_get_evidence_summary: { scoreInputs: ['timeline', 'mcp_calls', 'owner_approval', 'handoff'] },
    evaluator_score_world_scenario: { score: 'pending' },
    evaluator_generate_team_report: { status: 'generated' },
    website_send_reply: { messageId: `web_${Date.now()}`, dryRun: false, status: 'shown_on_site' }
  };
  return { ok: true, source: 'simulated', tool, data: { ...fixtures[tool], input: payload } };
}
