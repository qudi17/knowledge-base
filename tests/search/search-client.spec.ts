import { describe, expect, it } from "vitest";

import { buildSearchQuery, normalizeSearchOptions } from "../../skills/github-researcher/lib/search/query-builder";
import { searchGitHubRepositories } from "../../skills/github-researcher/lib/search/github-search-client";

describe("search query policy", () => {
  it("enforces defaults sort=stars per_page=20 with fork+archived exclusion", () => {
    const normalized = normalizeSearchOptions({ query: "  llm   agent framework  " });

    expect(normalized.sort).toBe("stars");
    expect(normalized.per_page).toBe(20);
    expect(normalized.page).toBe(1);
    expect(normalized.include_forks).toBe(false);
    expect(normalized.include_archived).toBe(false);

    const q = buildSearchQuery(normalized);
    expect(q).toContain("llm agent framework");
    expect(q).toContain("fork:false");
    expect(q).toContain("archived:false");
  });
});

describe("search GitHub client", () => {
  it("maps GitHub search payload to SearchResultItem contract", async () => {
    let capturedUrl = "";

    const result = await searchGitHubRepositories(
      {
        query: "agent framework"
      },
      {
        httpClient: {
          async request(request) {
            capturedUrl = request.url;
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
                    description: "Agents SDK",
                    stargazers_count: 1234,
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

    expect(capturedUrl).toContain("search/repositories");
    expect(capturedUrl).toContain("sort=stars");
    expect(capturedUrl).toContain("per_page=20");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0].full_name).toBe("openai/openai-agents-python");
      expect(result.items[0].stars).toBe(1234);
      expect(result.query_diagnostics.sort).toBe("stars");
      expect(result.query_diagnostics.applied_filters).toContain("fork:false");
    }
  });

  it("retries transient/rate-limit failures and stops on non-retryable failures", async () => {
    let retryAttempts = 0;

    const retried = await searchGitHubRepositories(
      { query: "retry me" },
      {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 2,
        httpClient: {
          async request() {
            retryAttempts += 1;
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

    expect(retried.ok).toBe(false);
    expect(retryAttempts).toBe(3);
    if (!retried.ok) {
      expect(retried.error_code).toBe("RATE_LIMITED");
      expect(retried.retryable).toBe(true);
    }

    let noRetryAttempts = 0;
    const noRetry = await searchGitHubRepositories(
      { query: "forbidden" },
      {
        httpClient: {
          async request() {
            noRetryAttempts += 1;
            return {
              ok: false,
              status: 403,
              statusText: "Forbidden",
              headers: {}
            };
          }
        }
      }
    );

    expect(noRetry.ok).toBe(false);
    expect(noRetryAttempts).toBe(1);
    if (!noRetry.ok) {
      expect(noRetry.error_class).toBe("PERMISSION_OR_UNSUPPORTED");
    }
  });
});
