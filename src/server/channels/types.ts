import { createHash, randomUUID } from 'node:crypto';
import type { AssistantRequest, LeadMessage } from '../../shared/schema';
import { LeadMessageSchema } from '../../shared/schema';

function hashPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export function normalizeLead(payload: unknown, defaults: Partial<LeadMessage> = {}): LeadMessage {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : { message: String(payload || '') };
  return LeadMessageSchema.parse({
    channel: defaults.channel || data.channel || 'website',
    message: data.message || data.text || data.body || defaults.message,
    customerName: data.customerName || data.name || defaults.customerName,
    customerHandle: data.customerHandle || data.handle || data.from || defaults.customerHandle,
    threadId: data.threadId || data.thread_id || randomUUID(),
    platformMessageId: data.platformMessageId || data.messageId || data.message_id,
    source: data.source || defaults.source,
    rawPayloadHash: hashPayload(payload)
  });
}

export function leadToAssistantRequest(lead: LeadMessage, demoRunId?: string): AssistantRequest {
  return {
    channel: lead.channel,
    message: lead.message,
    customerName: lead.customerName,
    customerHandle: lead.customerHandle,
    threadId: lead.threadId,
    platformMessageId: lead.platformMessageId,
    source: lead.source,
    requireOwnerApproval: /today|after work|office|birthday|allerg|delivery|complaint|wrong|upset/i.test(lead.message),
    demoRunId
  };
}
