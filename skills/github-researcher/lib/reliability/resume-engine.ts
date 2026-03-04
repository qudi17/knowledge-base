import { latestIncomplete, type CheckpointRecord } from "./checkpoint-store";

export type StartMode =
  | { type: "new"; reason?: string }
  | { type: "resume"; checkpoint: CheckpointRecord };

export function resolveStartMode(runId: string, inputFingerprint: string): StartMode {
  const latest = latestIncomplete(runId);
  if (!latest) {
    return { type: "new", reason: "no_incomplete_checkpoint" };
  }

  if (latest.input_fingerprint !== inputFingerprint) {
    return { type: "new", reason: "checkpoint_input_conflict" };
  }

  return { type: "resume", checkpoint: latest };
}
