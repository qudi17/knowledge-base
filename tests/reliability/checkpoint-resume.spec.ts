import { describe, expect, it } from "vitest";

import {
  _checkpointKeyForTest,
  cleanupCompletedByTTL,
  listCheckpoints,
  saveCheckpoint
} from "../../skills/github-researcher/lib/reliability/checkpoint-store";
import { resolveStartMode } from "../../skills/github-researcher/lib/reliability/resume-engine";

describe("checkpoint-store and resume-engine", () => {
  it("stores checkpoint with run_id+stage+timestamp key semantics", () => {
    const checkpoint = saveCheckpoint({
      run_id: "run-A",
      stage: "intake",
      timestamp: "2026-03-04T00:00:00.000Z",
      state: "running",
      input_fingerprint: "fp-1",
      progress_snapshot: { percent: 20 }
    });

    expect(_checkpointKeyForTest(checkpoint)).toContain("run-A__intake__2026-03-04T00:00:00.000Z");
  });

  it("marks previous stage checkpoint stale on conflict write", () => {
    saveCheckpoint({
      run_id: "run-B",
      stage: "analyze",
      timestamp: "2026-03-04T01:00:00.000Z",
      state: "running",
      input_fingerprint: "fp-2",
      progress_snapshot: { percent: 30 }
    });

    saveCheckpoint({
      run_id: "run-B",
      stage: "analyze",
      timestamp: "2026-03-04T01:01:00.000Z",
      state: "running",
      input_fingerprint: "fp-2",
      progress_snapshot: { percent: 35 }
    });

    const all = listCheckpoints("run-B");
    expect(all[0].stale).toBe(true);
    expect(all[1].stale).not.toBe(true);
  });

  it("resolveStartMode resumes only when inputFingerprint matches", () => {
    saveCheckpoint({
      run_id: "run-C",
      stage: "report",
      timestamp: "2026-03-04T02:00:00.000Z",
      state: "paused",
      input_fingerprint: "fp-3",
      progress_snapshot: { percent: 70 }
    });

    const resume = resolveStartMode("run-C", "fp-3");
    expect(resume.type).toBe("resume");

    const conflict = resolveStartMode("run-C", "fp-other");
    expect(conflict.type).toBe("new");
    if (conflict.type === "new") {
      expect(conflict.reason).toBe("checkpoint_input_conflict");
    }
  });

  it("retains latest checkpoints and TTL-cleans completed runs", () => {
    for (let i = 0; i < 7; i += 1) {
      saveCheckpoint({
        run_id: "run-D",
        stage: `stage-${i}`,
        timestamp: `2026-03-04T03:0${i}:00.000Z`,
        state: i < 6 ? "completed" : "cancelled",
        input_fingerprint: "fp-4",
        progress_snapshot: { index: i }
      });
    }

    const retained = listCheckpoints("run-D");
    expect(retained.length).toBeLessThanOrEqual(5);

    const removed = cleanupCompletedByTTL("2026-03-20T00:00:00.000Z", 7);
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
