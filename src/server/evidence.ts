import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EvidenceEvent } from '../shared/schema';

const evidenceDir = path.resolve(process.cwd(), 'evidence');
const memoryEvents = new Map<string, EvidenceEvent[]>();

export const APPROVED_HANDOFF_TIMELINE = [
  'lead_received',
  'mcp_tool_called',
  'source_checked',
  'order_intent_created',
  'owner_approval_requested',
  'owner_approved',
  'pos_order_created',
  'kitchen_ticket_created',
  'customer_reply_sent'
] as const;

export const APPROVAL_PENDING_TIMELINE = [
  'lead_received',
  'mcp_tool_called',
  'source_checked',
  'order_intent_created',
  'owner_approval_requested',
  'customer_reply_sent'
] as const;

export const REQUIRED_TIMELINE = APPROVED_HANDOFF_TIMELINE;

export function getRequiredTimeline() {
  return [...REQUIRED_TIMELINE];
}

export function ensureEvidenceDir() {
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
}

export function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/(sbc_team_)[A-Za-z0-9_-]+/g, '$1[REDACTED]')
      .replace(/(TELEGRAM_BOT_TOKEN=)\d+:[A-Za-z0-9_-]+/g, '$1[REDACTED]')
      .replace(/\b\d{8,}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TELEGRAM_TOKEN]')
      .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_API_KEY]');
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token|secret|password|authorization|cookie/i.test(key)) out[key] = '[REDACTED]';
      else out[key] = redact(item);
    }
    return out;
  }
  return value;
}

export function appendEvidence(event: Omit<EvidenceEvent, 'event_id' | 'at'>): EvidenceEvent {
  ensureEvidenceDir();
  const full: EvidenceEvent = {
    event_id: `ev_${randomUUID()}`,
    at: new Date().toISOString(),
    ...event,
    data: redact(event.data) as Record<string, unknown>
  };
  const file = path.join(evidenceDir, `${event.demo_run_id}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(full) + '\n');
  const list = memoryEvents.get(event.demo_run_id) || [];
  list.push(full);
  memoryEvents.set(event.demo_run_id, list);
  return full;
}

export function readEvidenceRun(demoRunId: string): EvidenceEvent[] {
  const fromMemory = memoryEvents.get(demoRunId);
  if (fromMemory?.length) return fromMemory;
  const file = path.join(evidenceDir, `${demoRunId}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as EvidenceEvent);
}

function containsTimeline(events: EvidenceEvent[], requiredTimeline: readonly string[]) {
  const types = events.map((event) => event.type);
  let cursor = 0;
  for (const required of requiredTimeline) {
    const foundAt = types.indexOf(required, cursor);
    if (foundAt === -1) return false;
    cursor = foundAt + 1;
  }
  return true;
}

export function hasRequiredTimeline(events: EvidenceEvent[]) {
  return containsTimeline(events, APPROVED_HANDOFF_TIMELINE) || containsTimeline(events, APPROVAL_PENDING_TIMELINE);
}

export function getTimelineVariant(events: EvidenceEvent[]) {
  if (containsTimeline(events, APPROVED_HANDOFF_TIMELINE)) return 'approved_handoff';
  if (containsTimeline(events, APPROVAL_PENDING_TIMELINE)) return 'approval_pending';
  return 'incomplete';
}

export function summarizeTimeline(demoRunId: string) {
  const events = readEvidenceRun(demoRunId);
  return {
    demoRunId,
    ok: hasRequiredTimeline(events),
    variant: getTimelineVariant(events),
    requiredEvents: getTimelineVariant(events) === 'approval_pending' ? [...APPROVAL_PENDING_TIMELINE] : getRequiredTimeline(),
    presentEvents: events.map((event) => event.type),
    missingEvents: (getTimelineVariant(events) === 'approval_pending' ? [...APPROVAL_PENDING_TIMELINE] : getRequiredTimeline()).filter((type) => !events.some((event) => event.type === type)),
    events
  };
}

export function listEvidence() {
  ensureEvidenceDir();
  return fs.readdirSync(evidenceDir)
    .filter((f) => f.endsWith('.json') || f.endsWith('.jsonl'))
    .map((file) => ({ file, path: `evidence/${file}`, bytes: fs.statSync(path.join(evidenceDir, file)).size }))
    .sort((a, b) => a.file.localeCompare(b.file));
}
