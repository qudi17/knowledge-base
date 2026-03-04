import { describe, expect, it } from "vitest";

import { buildRunInputFingerprint } from "../../skills/github-researcher/lib/intake/fingerprint";
import { runWithReliability } from "../../skills/github-researcher/lib/reliability/orchestrator";

describe("local input reliability integration", () => {
  it("runs local input through same stage lifecycle and completes", async () => {
    const result = await runWithReliability({
      run_id: "run-local-1",
      input: {
        target: "local",
        canonical_id: "local:repo",
        normalized_path: "/tmp/repo",
        repo_root: "/tmp/repo"
      },
      input_fingerprint: "fp-local-1",
      local_input: {
        canonical_id: "local:repo",
        normalized_path: "/tmp/repo",
        repo_root: "/tmp/repo",
        default_branch: "main"
      },
      stages: [
        { name: "intake", run: async () => ({ intake: true }) },
        { name: "analyze", run: async () => ({ done: true }) }
      ]
    });

    expect(result.status).toBe("completed");
    expect(result.local_input?.canonical_id).toBe("local:repo");
    expect(result.outputs.intake).toEqual({ intake: true });
  });

  it("deterministic local failure does not churn retries", async () => {
    let attempts = 0;

    const result = await runWithReliability({
      run_id: "run-local-2",
      input: {
        target: "local",
        canonical_id: "local:missing",
        normalized_path: "/tmp/missing",
        repo_root: "/tmp/missing"
      },
      input_fingerprint: "fp-local-2",
      local_input: {
        canonical_id: "local:missing",
        normalized_path: "/tmp/missing",
        repo_root: "/tmp/missing",
        default_branch: "main"
      },
      stages: [
        {
          name: "intake",
          run: async () => {
            attempts += 1;
            throw {
              status_code: 400,
              code: "PATH_NOT_FOUND",
              message: "path missing",
              stage: "intake"
            };
          }
        }
      ]
    });

    expect(result.status).toBe("failed");
    expect(attempts).toBe(1);
  });

  it("keeps stable fingerprint and resumes from checkpoint", async () => {
    const preflightA = {
      ok: true as const,
      input_raw: "./repo",
      input_type: "local_path" as const,
      normalized: {
        host: "local",
        owner: "repo",
        repo: "repo",
        canonical_id: "local:repo",
        canonical_compare_key: "local:repo",
        canonical_url: "",
        normalized_path: "/tmp/repo",
        repo_root: "/tmp/repo"
      },
      repository: {
        default_branch: "main",
        visibility: "local" as const,
        exists: true
      },
      normalizations_applied: [],
      identity_mapping: {
        input_id: "/tmp/repo",
        api_canonical_id: "local:repo",
        changed: true
      },
      display_name: "/tmp/repo"
    };

    const preflightB = {
      ...preflightA,
      input_raw: "/tmp/repo/"
    };

    const fp1 = buildRunInputFingerprint({ preflight: preflightA });
    const fp2 = buildRunInputFingerprint({ preflight: preflightB });
    expect(fp1).toBe(fp2);

    const first = await runWithReliability({
      run_id: "run-local-3",
      input: { repo: "local:repo" },
      input_fingerprint: fp1,
      local_input: {
        canonical_id: "local:repo",
        normalized_path: "/tmp/repo",
        repo_root: "/tmp/repo",
        default_branch: "main"
      },
      stages: [
        { name: "intake", run: async () => ({ intake: true }) },
        {
          name: "analyze",
          run: async () => {
            throw { status_code: 503, message: "interrupt", stage: "analyze" };
          }
        }
      ]
    });

    expect(first.status).toBe("failed");

    const resumed = await runWithReliability({
      run_id: "run-local-3",
      input: { repo: "local:repo" },
      input_fingerprint: fp2,
      local_input: {
        canonical_id: "local:repo",
        normalized_path: "/tmp/repo",
        repo_root: "/tmp/repo",
        default_branch: "main"
      },
      stages: [
        { name: "intake", run: async () => ({ intake: true }) },
        { name: "analyze", run: async () => ({ analysis: "ok" }) }
      ]
    });

    expect(resumed.start_mode).toBe("resume");
    expect(resumed.status).toBe("completed");
  });
});
