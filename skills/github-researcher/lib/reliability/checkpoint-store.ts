export type CheckpointState = "queued" | "running" | "retrying" | "paused" | "failed" | "completed" | "cancelled";

export interface CheckpointRecord {
  run_id: string;
  stage: string;
  timestamp: string;
  state: CheckpointState;
  input_fingerprint: string;
  progress_snapshot: Record<string, unknown>;
  error_context?: Record<string, unknown>;
  stale?: boolean;
  terminal?: boolean;
}

const TERMINAL: ReadonlySet<CheckpointState> = new Set(["failed", "completed", "cancelled"]);

const byRun = new Map<string, CheckpointRecord[]>();

function checkpointKey(record: CheckpointRecord): string {
  return `${record.run_id}__${record.stage}__${record.timestamp}`;
}

function isTerminal(record: CheckpointRecord): boolean {
  return TERMINAL.has(record.state);
}

export function saveCheckpoint(record: CheckpointRecord): CheckpointRecord {
  const existing = byRun.get(record.run_id) ?? [];

  const activeSameStage = existing.find((r) => r.stage === record.stage && !r.stale && !isTerminal(r));
  if (activeSameStage) {
    activeSameStage.stale = true;
  }

  const enriched: CheckpointRecord = {
    ...record,
    terminal: isTerminal(record)
  };

  existing.push(enriched);
  byRun.set(record.run_id, existing);

  enforceRetention(record.run_id, 5);
  return enriched;
}

export function latestIncomplete(runId: string): CheckpointRecord | null {
  const checkpoints = byRun.get(runId) ?? [];
  const candidates = checkpoints.filter((r) => !r.stale && !r.terminal);
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}

export function listCheckpoints(runId: string): CheckpointRecord[] {
  return [...(byRun.get(runId) ?? [])];
}

export function markStale(runId: string, stage: string): void {
  const checkpoints = byRun.get(runId) ?? [];
  checkpoints.forEach((r) => {
    if (r.stage === stage && !r.terminal) {
      r.stale = true;
    }
  });
}

export function enforceRetention(runId: string, keepLatest: number): void {
  const checkpoints = byRun.get(runId) ?? [];
  if (checkpoints.length <= keepLatest) return;
  byRun.set(runId, checkpoints.slice(checkpoints.length - keepLatest));
}

export function cleanupCompletedByTTL(nowIso: string, ttlDays: number): number {
  const now = new Date(nowIso).getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

  let removed = 0;
  for (const [runId, records] of byRun.entries()) {
    const allTerminal = records.length > 0 && records.every((r) => Boolean(r.terminal));
    if (!allTerminal) continue;

    const latestTs = new Date(records[records.length - 1].timestamp).getTime();
    if (Number.isNaN(latestTs)) continue;

    if (now - latestTs > ttlMs) {
      byRun.delete(runId);
      removed += 1;
    }
  }

  return removed;
}

export function _checkpointKeyForTest(record: CheckpointRecord): string {
  return checkpointKey(record);
}
