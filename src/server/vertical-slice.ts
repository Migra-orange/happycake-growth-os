import { randomUUID } from 'node:crypto';
import type { AssistantRequest, AssistantResponse, EvidenceEvent, LeadMessage, McpResult, OwnerApproval } from '../shared/schema';
import { appendEvidence, getRequiredTimeline, getTimelineVariant, hasRequiredTimeline, readEvidenceRun } from './evidence';
import { callMcp } from './mcp';
import { createOrderIntent, customerReplyForIntent } from './orders/order-intent';
import { createSandboxHandoff, runSourceChecks } from './orders/handoff';
import { approveOwnerAction, requestOwnerApproval } from './telegram/cards';
import { createApprovalRecord, createAutopilotTimeline } from './autopilot/state-machine';
import { evaluatePolicy } from './autopilot/policy-engine';
import { leadToAssistantRequest, normalizeLead } from './channels/types';

type SliceInput = Partial<LeadMessage> & { message: string; requiresOwnerApproval?: boolean; autoApproveForDemoOnly?: boolean; approveOwnerAction?: boolean; demoRunId?: string; offerCode?: string };

export async function runSandboxVerticalSlice(input: SliceInput) {
  const demoRunId = input.demoRunId || `demo-run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const lead = normalizeLead(input, { channel: input.channel || 'instagram' });
  appendEvidence({
    demo_run_id: demoRunId,
    type: 'lead_received',
    channel: lead.channel,
    entity_id: lead.threadId,
    summary: `${lead.channel} lead from ${lead.customerName || lead.customerHandle || 'customer'}: ${lead.message.slice(0, 120)}`,
    data: { lead }
  });

  const req = leadToAssistantRequest(lead, demoRunId);
  const intent = createOrderIntent(req, `intent_${randomUUID()}`);
  const mcpChecks = await runSourceChecks(intent, { demoRunId, channel: lead.channel });
  appendEvidence({
    demo_run_id: demoRunId,
    type: 'source_checked',
    channel: lead.channel,
    entity_id: intent.intentId,
    summary: `Catalog, POS summary, evaluator state, and kitchen capacity checks completed for ${intent.intentId}.`,
    data: { mcpChecks }
  });

  appendEvidence({
    demo_run_id: demoRunId,
    type: 'order_intent_created',
    channel: lead.channel,
    entity_id: intent.intentId,
    summary: `${intent.productPreference || 'Cake'} order intent is ${intent.requiredFieldsMissing.length ? 'missing fields' : 'ready for owner approval'}.`,
    data: { intent }
  });

  intent.state = 'owner_approval_pending';
  const policyDecision = evaluatePolicy(intent, { action: 'create_order' });
  const approval = createApprovalRecord(intent, ['square_create_order', 'kitchen_create_ticket', 'send customer reply through source channel']);
  let timeline = createAutopilotTimeline({
    intent,
    approval,
    offerCode: input.offerCode,
    mcpChecks: mcpChecks.map((check) => `${check.tool}:${check.source}:${check.ok ? 'ok' : 'failed'}`)
  });
  await requestOwnerApproval(approval, demoRunId);

  let approved: typeof approval | OwnerApproval = approval;
  let handoff: Awaited<ReturnType<typeof createSandboxHandoff>> | undefined;
  const shouldAutoApprove = input.autoApproveForDemoOnly === true || (input.approveOwnerAction === true && input.requiresOwnerApproval !== true);
  if (shouldAutoApprove && policyDecision.decision !== 'block') {
    approved = await approveOwnerAction(approval, demoRunId);
    timeline = createAutopilotTimeline({
      intent,
      approval: approved,
      offerCode: input.offerCode,
      mcpChecks: mcpChecks.map((check) => `${check.tool}:${check.source}:${check.ok ? 'ok' : 'failed'}`)
    });
    intent.state = 'owner_approved';
    handoff = await createSandboxHandoff(intent, { demoRunId, channel: lead.channel });
    appendEvidence({
      demo_run_id: demoRunId,
      type: 'pos_order_created',
      channel: 'demo',
      entity_id: intent.intentId,
      summary: `Square sandbox draft order created for ${intent.intentId}.`,
      data: { pos: handoff.pos }
    });
    appendEvidence({
      demo_run_id: demoRunId,
      type: 'kitchen_ticket_created',
      channel: 'demo',
      entity_id: intent.intentId,
      summary: `Kitchen sandbox ticket created for ${intent.intentId}.`,
      data: { kitchen: handoff.kitchen }
    });
  }

  const customerReply = customerReplyForIntent(intent);
  const sendTool = lead.channel === 'instagram' ? 'marketing_report_to_owner' : lead.channel === 'whatsapp' ? 'marketing_report_to_owner' : 'website_send_reply';
  const sendResult = await callMcp(sendTool, { threadId: lead.threadId, reply: customerReply, dryRun: lead.channel !== 'website' }, { demoRunId, channel: lead.channel, entityId: intent.intentId });
  intent.state = 'customer_reply_sent';
  appendEvidence({
    demo_run_id: demoRunId,
    type: 'customer_reply_sent',
    channel: lead.channel,
    entity_id: intent.intentId,
    summary: `Customer reply sent via ${sendTool}.`,
    data: { customerReply, sendResult }
  });
  await callMcp('evaluator_get_evidence_summary', { scenario: 'lead_to_order_handoff', demoRunId, ok: true }, { demoRunId, channel: 'demo', entityId: intent.intentId });

  const events = readEvidenceRun(demoRunId);
  const mcpSources = events
    .filter((event) => event.type === 'mcp_tool_called')
    .map((event) => ((event.data.result as McpResult | undefined)?.source || 'simulated'));

  return {
    demoRunId,
    lead,
    intent,
    approval: approved,
    mcpChecks,
    handoff,
    customerReply,
    events,
    autopilotTimeline: timeline,
    policyDecision,
    summary: {
      ok: hasRequiredTimeline(events),
      variant: getTimelineVariant(events),
      orderState: intent.state,
      requiredEvents: getRequiredTimeline(),
      presentEvents: events.map((event: EvidenceEvent) => event.type),
      mcpSources
    }
  };
}

export async function runAssistantVerticalSlice(req: AssistantRequest): Promise<AssistantResponse> {
  const result = await runSandboxVerticalSlice({
    channel: req.channel,
    customerName: req.customerName,
    customerHandle: req.customerHandle,
    threadId: req.threadId,
    platformMessageId: req.platformMessageId,
    source: req.source,
    message: req.message,
    demoRunId: req.demoRunId,
    requiresOwnerApproval: req.requireOwnerApproval
  });
  return {
    mode: process.env.ASSISTANT_MODE === 'live' ? 'live' : 'simulated',
    runtime: 'claude-code-cli',
    usedFallback: process.env.ASSISTANT_MODE !== 'live',
    reply: result.customerReply,
    actions: result.events.map((event) => ({ type: event.type, label: event.type.replace(/_/g, ' '), detail: event.summary })).slice(-12),
    evidenceId: result.demoRunId,
    ownerSummary: result.approval.summary,
    guardrails: [
      'English only for customer-facing copy.',
      'Use HappyCake spelling exactly.',
      'Do not invent price, inventory, hours, allergens, delivery, or policies.',
      'Owner approves side effects in Telegram.'
    ],
    orderIntent: result.intent,
    mcpChecks: result.mcpChecks,
    requiredApprovals: [result.approval],
    riskFlags: result.intent.riskFlags
  };
}
