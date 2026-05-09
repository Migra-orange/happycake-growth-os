import { z } from 'zod';

export const ChannelSchema = z.enum(['website', 'whatsapp', 'instagram', 'telegram', 'google_business', 'demo']);

export const AssistantRequestSchema = z.object({
  channel: ChannelSchema.default('demo'),
  message: z.string().min(2).max(4000),
  customerName: z.string().max(120).optional(),
  source: z.string().max(200).optional(),
  requireOwnerApproval: z.boolean().default(false)
});

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

export const AssistantResponseSchema = z.object({
  mode: z.enum(['live', 'simulated']),
  runtime: z.literal('claude-code-cli'),
  usedFallback: z.boolean(),
  reply: z.string(),
  actions: z.array(z.object({ type: z.string(), label: z.string(), detail: z.string() })),
  evidenceId: z.string(),
  ownerSummary: z.string(),
  guardrails: z.array(z.string())
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
