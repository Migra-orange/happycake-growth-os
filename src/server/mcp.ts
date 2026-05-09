type McpResult = { ok: boolean; source: 'mcp' | 'simulated'; tool: string; data: Record<string, unknown> };

const endpoint = process.env.HAPPYCAKE_MCP_URL || 'https://www.steppebusinessclub.com/api/mcp';
const token = process.env.HAPPYCAKE_MCP_TEAM_TOKEN;

export async function callMcp(tool: string, payload: Record<string, unknown> = {}): Promise<McpResult> {
  if (!token || process.env.MCP_MODE === 'simulated') {
    return simulatedMcp(tool, payload);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Team-Token': token
    },
    body: JSON.stringify({ tool, input: payload })
  });

  if (!res.ok) throw new Error(`MCP ${tool} failed with ${res.status}`);
  const data = await res.json() as Record<string, unknown>;
  return { ok: true, source: 'mcp', tool, data };
}

function simulatedMcp(tool: string, payload: Record<string, unknown>): McpResult {
  const fixtures: Record<string, Record<string, unknown>> = {
    square_list_catalog: { products_checked: true, note: 'Real run checks Square/POS catalog before quoting.' },
    kitchen_get_production_summary: { capacity_status: 'source_of_truth_required', note: 'Real run checks kitchen capacity before promising same-day pickup.' },
    instagram_send_reply: { queued: true, requires_customer_thread: true },
    whatsapp_send_reply: { queued: true, requires_customer_thread: true },
    marketing_create_campaign: { status: 'draft', owner_approval_required: true },
    google_business_create_post: { status: 'draft', owner_approval_required: true },
    square_create_order: { status: 'pending_availability_check' },
    kitchen_create_ticket: { status: 'pending_availability_check' }
  };
  return { ok: true, source: 'simulated', tool, data: { ...(fixtures[tool] || { simulated: true }), input: payload } };
}
