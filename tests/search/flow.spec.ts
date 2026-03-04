import { describe, expect, it } from "vitest";

import { runWithReliability } from "../../skills/github-researcher/lib/reliability/orchestrator";
import { searchRepositories } from "../../skills/github-researcher/lib/search/search-service";
import { confirmAndLaunchFromSelection } from "../../skills/github-researcher/lib/search/selection-bridge";

describe("search flow integration", () => {
  it("supports search -> select -> confirm -> preflight happy path", async () => {
    const search = await searchRepositories(
      { query: "agent sdk" },
      {
        httpClient: {
          async request() {
            return {
              ok: true,
              status: 200,
              statusText: "OK",
              headers: {},
              data: {
                total_count: 1,
                incomplete_results: false,
                items: [
                  {
                    full_name: "openai/openai-agents-python",
                    name: "openai-agents-python",
                    description: "Agents",
                    stargazers_count: 100,
                    updated_at: "2026-03-01T00:00:00Z",
                    html_url: "https://github.com/openai/openai-agents-python",
                    archived: false,
                    fork: false,
                    owner: { login: "openai" }
                  }
                ]
              }
            };
          }
        }
      }
    );

    expect(search.ok).toBe(true);
    if (!search.ok) return;

    const launch = await confirmAndLaunchFromSelection({
      run_id: "run-flow-1",
      query_text: "agent sdk",
      sort_mode: "stars",
      page: 1,
      result_rank: 1,
      confirmed: true,
      selected: {
        full_name: search.items[0].full_name,
        html_url: search.items[0].html_url,
        stars: search.items[0].stars,
        updated_at: search.items[0].updated_at
      },
      preflight_runner: async () => ({
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
      })
    });

    expect(launch.ok).toBe(true);
    if (launch.ok) {
      expect(launch.preflight.normalized.canonical_id).toBe("openai/openai-agents-python");
      expect(launch.search_context.query_text).toBe("agent sdk");
    }
  });

  it("returns suggestions on no-result path without launch", async () => {
    const search = await searchRepositories(
      { query: "nothing-will-match" },
      {
        httpClient: {
          async request() {
            return {
              ok: true,
              status: 200,
              statusText: "OK",
              headers: {},
              data: {
                total_count: 0,
                incomplete_results: false,
                items: []
              }
            };
          }
        }
      }
    );

    expect(search.ok).toBe(true);
    if (search.ok) {
      expect(search.items.length).toBe(0);
      expect(search.suggestions?.length).toBeGreaterThan(0);
    }
  });

  it("keeps structured rate-limit failure summary", async () => {
    const search = await searchRepositories(
      { query: "rate limited" },
      {
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 2,
        httpClient: {
          async request() {
            return {
              ok: false,
              status: 429,
              statusText: "Too Many Requests",
              headers: {}
            };
          }
        }
      }
    );

    expect(search.ok).toBe(false);
    if (!search.ok) {
      expect(search.error_code).toBe("RATE_LIMITED");
      expect(search.summary).toContain("Repository search failed");
    }
  });

  it("resume reuses checkpointed selection context without re-running search", async () => {
    let searchCalls = 0;

    const search = await searchRepositories(
      { query: "resume test" },
      {
        httpClient: {
          async request() {
            searchCalls += 1;
            return {
              ok: true,
              status: 200,
              statusText: "OK",
              headers: {},
              data: {
                total_count: 1,
                incomplete_results: false,
                items: [
                  {
                    full_name: "openai/openai-agents-python",
                    name: "openai-agents-python",
                    description: "Agents",
                    stargazers_count: 100,
                    updated_at: "2026-03-01T00:00:00Z",
                    html_url: "https://github.com/openai/openai-agents-python",
                    archived: false,
                    fork: false,
                    owner: { login: "openai" }
                  }
                ]
              }
            };
          }
        }
      }
    );

    if (!search.ok) {
      throw new Error("Expected search success");
    }

    const first = await confirmAndLaunchFromSelection({
      run_id: "run-flow-resume",
      query_text: "resume test",
      sort_mode: "stars",
      page: 1,
      result_rank: 1,
      confirmed: true,
      selected: {
        full_name: search.items[0].full_name,
        html_url: search.items[0].html_url,
        stars: search.items[0].stars,
        updated_at: search.items[0].updated_at
      },
      preflight_runner: async () => ({
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
      }),
      launch: {
        input: { repo: "openai/openai-agents-python" },
        input_fingerprint: "fp-search-resume",
        stages: [
          {
            name: "intake",
            run: async () => ({ intake: true })
          },
          {
            name: "analyze",
            run: async () => {
              throw { status_code: 503, message: "interrupted", stage: "analyze" };
            }
          }
        ]
      }
    });

    expect(first.ok).toBe(true);
    if (!first.ok || !first.launch_input) {
      throw new Error("Expected first launch input");
    }

    const resumed = await runWithReliability({
      run_id: "run-flow-resume",
      input: first.launch_input,
      input_fingerprint: "fp-search-resume",
      stages: [
        {
          name: "intake",
          run: async () => ({ intake: true })
        },
        {
          name: "analyze",
          run: async () => ({ analysis: "ok" })
        }
      ],
      search_context: first.search_context
    });

    expect(resumed.start_mode).toBe("resume");
    expect(resumed.status).toBe("completed");
    expect(resumed.search_context?.selected_full_name).toBe("openai/openai-agents-python");
    expect(searchCalls).toBe(1);
  });
});
