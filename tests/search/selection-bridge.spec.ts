import { describe, expect, it } from "vitest";

import { confirmAndLaunchFromSelection, prepareSelectionLaunch } from "../../skills/github-researcher/lib/search/selection-bridge";

describe("selection bridge", () => {
  it("returns rejected when explicit confirm is missing", async () => {
    const result = await confirmAndLaunchFromSelection({
      run_id: "run-select-1",
      query_text: "agent sdk",
      sort_mode: "stars",
      page: 1,
      result_rank: 1,
      confirmed: false,
      selected: {
        full_name: "openai/openai-agents-python",
        html_url: "https://github.com/openai/openai-agents-python",
        stars: 100,
        updated_at: "2026-03-01T00:00:00Z"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    if (!result.ok) {
      expect(result.message).toContain("confirmation");
    }
  });

  it("prepareSelectionLaunch validates selected full_name", () => {
    const invalid = prepareSelectionLaunch({
      run_id: "run-select-2",
      query_text: "broken",
      sort_mode: "stars",
      page: 1,
      result_rank: 1,
      selected: {
        full_name: "not-valid",
        html_url: "https://github.com/not-valid",
        stars: 1,
        updated_at: "2026-03-01T00:00:00Z"
      }
    });

    expect(invalid.ok).toBe(false);
  });

  it("confirmed selection always calls runRepositoryPreflight before launch", async () => {
    let preflightCalls = 0;

    const result = await confirmAndLaunchFromSelection({
      run_id: "run-select-3",
      query_text: "agent sdk",
      sort_mode: "stars",
      page: 1,
      result_rank: 1,
      confirmed: true,
      selected: {
        full_name: "openai/openai-agents-python",
        html_url: "https://github.com/openai/openai-agents-python",
        stars: 100,
        updated_at: "2026-03-01T00:00:00Z"
      },
      preflight_runner: async () => {
        preflightCalls += 1;
        return {
          ok: true,
          input_raw: "https://github.com/openai/openai-agents-python",
          input_type: "github_url",
          normalized: {
            host: "github.com",
            owner: "openai",
            repo: "openai-agents-python",
            canonical_id: "openai/openai-agents-python",
            canonical_compare_key: "openai/openai-agents-python",
            canonical_url: "https://github.com/openai/openai-agents-python"
          },
          repository: {
            default_branch: "main",
            visibility: "public",
            exists: true
          },
          normalizations_applied: [],
          identity_mapping: {
            input_id: "openai/openai-agents-python",
            api_canonical_id: "openai/openai-agents-python",
            changed: false
          },
          display_name: "openai/openai-agents-python"
        };
      }
    });

    expect(preflightCalls).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("launched");
      expect(result.search_context.selected_full_name).toBe("openai/openai-agents-python");
    }
  });
});
