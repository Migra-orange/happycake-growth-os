import { z } from 'zod';

export const ChannelSchema = z.enum(['website', 'whatsapp', 'instagram', 'telegram', 'google_business', 'demo']);
export type Channel = z.infer<typeof ChannelSchema>;

export const AssistantRequestSchema = z.object({
  channel: ChannelSchema.default('demo'),
  message: z.string().min(2).max(4000),
  customerName: z.string().max(120).optional(),
  customerHandle: z.string().max(120).optional(),
  threadId: z.string().max(160).optional(),
  platformMessageId: z.string().max(160).optional(),
  source: z.string().max(200).optional(),
  requireOwnerApproval: z.boolean().default(false),
  demoRunId: z.string().max(180).optional()
});

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

export const ActionSchema = z.object({ type: z.string(), label: z.string(), detail: z.string() });

export const McpSourceSchema = z.enum(['mcp', 'simulated']);
export const McpToolNameSchema = z.enum([
  'square_list_catalog',
  'square_check_inventory',
  'business_get_hours',
  'business_get_policies',
  'business_get_allergens',
  'kitchen_get_production_summary',
  'kitchen_create_ticket',
  'kitchen_accept_ticket',
  'kitchen_mark_ready',
  'square_create_order',
  'square_update_order_status',
  'instagram_send_reply',
  'whatsapp_send_reply',
  'website_send_reply',
  'marketing_create_campaign',
  'marketing_daily_report',
  'google_business_create_post',
  'owner_action_log',
  'evaluator_record_event',
  'evaluator_get_summary'
]);
export type McpToolName = z.infer<typeof McpToolNameSchema>;

export const McpResultSchema = z.object({
  ok: z.boolean(),
  source: McpSourceSchema,
  tool: McpToolNameSchema,
  data: z.record(z.string(), z.unknown()),
  latencyMs: z.number().nonnegative().optional(),
  evidenceEventId: z.string().optional()
});
export type McpResult = z.infer<typeof McpResultSchema>;

export const LeadMessageSchema = z.object({
  channel: ChannelSchema,
  message: z.string().min(2).max(4000),
  customerName: z.string().max(120).optional(),
  customerHandle: z.string().max(120).optional(),
  threadId: z.string().max(160).optional(),
  platformMessageId: z.string().max(160).optional(),
  source: z.string().max(200).optional(),
  rawPayloadHash: z.string().optional()
});
export type LeadMessage = z.infer<typeof LeadMessageSchema>;

export const OrderIntentSchema = z.object({
  intentId: z.string(),
  state: z.enum([
    'lead_received',
    'needs_clarification',
    'source_checked',
    'owner_approval_pending',
    'owner_approved',
    'sandbox_order_created',
    'kitchen_ticket_created',
    'customer_reply_sent',
    'closed'
  ]),
  channel: ChannelSchema,
  customerName: z.string().optional(),
  customerHandle: z.string().optional(),
  productPreference: z.string().optional(),
  occasion: z.string().optional(),
  pickupWindow: z.string().optional(),
  headcount: z.number().int().positive().optional(),
  notes: z.string().optional(),
  riskFlags: z.array(z.string()).default([]),
  requiredFieldsMissing: z.array(z.string()).default([])
});
export type OrderIntent = z.infer<typeof OrderIntentSchema>;

export const OwnerApprovalSchema = z.object({
  approvalId: z.string(),
  intentId: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'clarification_requested']),
  ownerChannel: z.literal('telegram'),
  summary: z.string(),
  sideEffectsIfApproved: z.array(z.string())
});
export type OwnerApproval = z.infer<typeof OwnerApprovalSchema>;

export const AssistantResponseSchema = z.object({
  mode: z.enum(['live', 'simulated']),
  runtime: z.literal('claude-code-cli'),
  usedFallback: z.boolean(),
  reply: z.string(),
  actions: z.array(ActionSchema),
  evidenceId: z.string(),
  ownerSummary: z.string(),
  guardrails: z.array(z.string()),
  orderIntent: OrderIntentSchema.optional(),
  mcpChecks: z.array(McpResultSchema).optional(),
  requiredApprovals: z.array(OwnerApprovalSchema).optional(),
  riskFlags: z.array(z.string()).optional()
});

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

export type EvidenceEvent = {
  event_id: string;
  demo_run_id: string;
  type: string;
  at: string;
  channel: string;
  summary: string;
  entity_id?: string;
  data: Record<string, unknown>;
};
