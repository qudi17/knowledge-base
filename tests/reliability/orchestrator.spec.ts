import { describe, expect, it } from "vitest";

import { listCheckpoints } from "../../skills/github-researcher/lib/reliability/checkpoint-store";
import { runWithReliability } from "../../skills/github-researcher/lib/reliability/orchestrator";

describe("reliability orchestrator", () => {
  it("completes uninterrupted multi-stage run", async () => {
    const events: string[] = [];

    const result = await runWithReliability({
      run_id: "run-orch-1",
      input: { repo: "owner/repo" },
      input_fingerprint: "fp-orch-1",
      progress_sink: (event) => events.push(`${event.kind}:${event.stage}:${event.state}`),
      stages: [
        {
          name: "intake",
          run: async () => ({ ok: true })
        },
        {
          name: "analyze",
          run: async () => ({ modules: 3 })
        }
      ]
    });

    expect(result.status).toBe("completed");
    expect(result.start_mode).toBe("new");
    expect(result.terminal_reason).toBe("completed");
    expect(result.outputs.intake).toEqual({ ok: true });
    expect(result.outputs.analyze).toEqual({ modules: 3 });
    expect(events.some((line) => line.includes("terminal:run:completed"))).toBe(true);
  });

  it("recovers from transient stage failure and reaches completion", async () => {
    let attempts = 0;

    const result = await runWithReliability({
      run_id: "run-orch-2",
      input: { repo: "owner/repo" },
      input_fingerprint: "fp-orch-2",
      stages: [
        {
          name: "fetch",
          run: async () => {
            attempts += 1;
            if (attempts < 2) {
              throw {
                status_code: 503,
                message: "temporary",
                stage: "fetch"
              };
            }

            return { fetched: true };
          }
        },
        {
          name: "report",
          run: async () => ({ done: true })
        }
      ]
    });

    expect(result.status).toBe("completed");
    expect(result.summary.retry_statistics.total_attempts).toBeGreaterThanOrEqual(3);
    expect(result.summary.retry_statistics.retried_stages).toBeGreaterThanOrEqual(1);
  });

  it("classifies retry exhaustion as failed terminal path", async () => {
    const result = await runWithReliability({
      run_id: "run-orch-3",
      input: { repo: "owner/repo" },
      input_fingerprint: "fp-orch-3",
      stages: [
        {
          name: "collect",
          run: async () => {
            throw {
              status_code: 503,
              message: "still failing",
              stage: "collect"
            };
          }
        }
      ]
    });

    expect(result.status).toBe("failed");
    expect(result.terminal_reason).toBe("transient_exhausted");
    expect(result.summary.pinned_failures[0].stage).toBe("collect");
  });

  it("resumes from latest incomplete stage boundary", async () => {
    let secondStageAttempts = 0;

    const first = await runWithReliability({
      run_id: "run-orch-4",
      input: { repo: "owner/repo", version: 1 },
      input_fingerprint: "fp-orch-4",
      stages: [
        {
          name: "intake",
          run: async () => ({ intake: true })
        },
        {
          name: "analysis",
          run: async () => {
            secondStageAttempts += 1;
            throw {
              status_code: 503,
              message: "interrupted",
              stage: "analysis"
            };
          }
        }
      ]
    });

    expect(first.status).toBe("failed");

    const resumed = await runWithReliability({
      run_id: "run-orch-4",
      input: { repo: "owner/repo", version: 1 },
      input_fingerprint: "fp-orch-4",
      stages: [
        {
          name: "intake",
          run: async () => ({ intake: true })
        },
        {
          name: "analysis",
          run: async () => ({ analysis: "ok" })
        }
      ]
    });

    expect(resumed.start_mode).toBe("resume");
    expect(resumed.status).toBe("completed");
    expect(resumed.outputs.intake).toBeUndefined();
    expect(resumed.outputs.analysis).toEqual({ analysis: "ok" });
    expect(secondStageAttempts).toBeGreaterThanOrEqual(1);
  });

  it("preserves core-first checkpoint semantics across interruption and resume", async () => {
    const events: string[] = [];

    const first = await runWithReliability({
      run_id: "run-orch-core-first",
      input: { repo: "owner/repo" },
      input_fingerprint: "fp-orch-core-first",
      core_first: {
        enabled: true
      },
      progress_sink: (event) => events.push(`${event.kind}:${event.stage}:${event.state}:${event.message ?? ""}`),
      stages: [
        {
          name: "entry_modules",
          run: async () => ({ intake: true })
        },
        {
          name: "workflow_reconstruction",
          run: async () => {
            throw {
              status_code: 503,
              message: "temporary interruption",
              stage: "workflow_reconstruction"
            };
          }
        },
        {
          name: "snapshot_freeze",
          run: async () => ({ frozen: true })
        }
      ]
    });

    expect(first.status).toBe("failed");
    expect(events.some((line) => line.includes("workflow_reconstruction:running"))).toBe(true);

    const resumed = await runWithReliability({
      run_id: "run-orch-core-first",
      input: { repo: "owner/repo" },
      input_fingerprint: "fp-orch-core-first",
      core_first: {
        enabled: true,
        conflict_detected: true,
        revalidation_reason: "new contradiction in dependency evidence"
      },
      progress_sink: (event) => events.push(`${event.kind}:${event.stage}:${event.state}:${event.message ?? ""}`),
      stages: [
        {
          name: "entry_modules",
          run: async () => ({ intake: true })
        },
        {
          name: "workflow_reconstruction",
          run: async () => ({ workflows: 1 })
        },
        {
          name: "snapshot_freeze",
          run: async () => ({ frozen: true })
        },
        {
          name: "broad_scan",
          run: async () => ({ expanded: true })
        }
      ]
    });

    expect(resumed.start_mode).toBe("resume");
    expect(resumed.status).toBe("completed");
    expect(resumed.outputs.entry_modules).toBeUndefined();
    expect(events.some((line) => line.includes("snapshot_freeze:retrying:revalidation_required"))).toBe(true);
    expect(events.some((line) => line.includes("broad_scan:paused"))).toBe(true);

    const checkpoints = listCheckpoints("run-orch-core-first");
    const terminal = checkpoints[checkpoints.length - 1];
    const snapshot = terminal.progress_snapshot as Record<string, unknown>;
    expect(Array.isArray(snapshot.core_first_completed_stages)).toBe(true);
    expect((snapshot.core_first_completed_stages as string[]).includes("broad_scan")).toBe(true);
  });

  it("persists phased-coverage checkpoint metadata through completion", async () => {
    const result = await runWithReliability({
      run_id: "run-orch-coverage-1",
      input: { repo: "owner/repo" },
      input_fingerprint: "fp-orch-coverage-1",
      coverage_phases: {
        completed_phase_ids: ["06.1"],
        remaining_scope_queue: ["06.2"]
      },
      stages: [
        {
          name: "coverage_phase_execution",
          run: async () => ({ done: true })
        },
        {
          name: "coverage_merge",
          run: async () => ({ merged: true })
        }
      ]
    });

    expect(result.status).toBe("completed");
    const checkpoints = listCheckpoints("run-orch-coverage-1");
    const last = checkpoints[checkpoints.length - 1].progress_snapshot as Record<string, unknown>;
    expect((last.coverage_phases as { completed_phase_ids: string[] }).completed_phase_ids).toEqual(["06.1"]);
  });
});
