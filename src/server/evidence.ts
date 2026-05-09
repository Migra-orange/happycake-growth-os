import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EvidenceEvent } from '../shared/schema';

const evidenceDir = path.resolve(process.cwd(), 'evidence');

export function ensureEvidenceDir() {
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
}

export function appendEvidence(event: Omit<EvidenceEvent, 'event_id' | 'at'>): EvidenceEvent {
  ensureEvidenceDir();
  const full: EvidenceEvent = { event_id: `ev_${randomUUID()}`, at: new Date().toISOString(), ...event };
  const file = path.join(evidenceDir, `${event.demo_run_id}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(full) + '\n');
  return full;
}

export function listEvidence() {
  ensureEvidenceDir();
  return fs.readdirSync(evidenceDir)
    .filter((f) => f.endsWith('.json') || f.endsWith('.jsonl'))
    .map((file) => ({ file, path: `evidence/${file}`, bytes: fs.statSync(path.join(evidenceDir, file)).size }))
    .sort((a, b) => a.file.localeCompare(b.file));
}
