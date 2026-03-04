import { describe, expect, it } from "vitest";

import { searchRepositories } from "../../skills/github-researcher/lib/search/search-service";

describe("search service", () => {
  it("returns actionable suggestions for empty results", async () => {
    const result = await searchRepositories(
      { query: "very-rare-query" },
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

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toEqual([]);
      expect(result.suggestions?.length).toBeGreaterThan(0);
    }
  });

  it("enforces include_forks and include_archived filtering policy", async () => {
    const result = await searchRepositories(
      { query: "agent", include_forks: false, include_archived: false },
      {
        httpClient: {
          async request() {
            return {
              ok: true,
              status: 200,
              statusText: "OK",
              headers: {},
              data: {
                total_count: 3,
                incomplete_results: false,
                items: [
                  {
                    full_name: "a/main",
                    name: "main",
                    description: null,
                    stargazers_count: 100,
                    updated_at: "2026-01-01T00:00:00Z",
                    html_url: "https://github.com/a/main",
                    archived: false,
                    fork: false,
                    owner: { login: "a" }
                  },
                  {
                    full_name: "b/forked",
                    name: "forked",
                    description: null,
                    stargazers_count: 90,
                    updated_at: "2026-01-01T00:00:00Z",
                    html_url: "https://github.com/b/forked",
                    archived: false,
                    fork: true,
                    owner: { login: "b" }
                  },
                  {
                    full_name: "c/archived",
                    name: "archived",
                    description: null,
                    stargazers_count: 80,
                    updated_at: "2026-01-01T00:00:00Z",
                    html_url: "https://github.com/c/archived",
                    archived: true,
                    fork: false,
                    owner: { login: "c" }
                  }
                ]
              }
            };
          }
        }
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items.length).toBe(1);
      expect(result.items[0].full_name).toBe("a/main");
    }
  });

  it("preserves structured failure from client", async () => {
    const result = await searchRepositories(
      { query: "will-fail" },
      {
        httpClient: {
          async request() {
            return {
              ok: false,
              status: 503,
              statusText: "Service Unavailable",
              headers: {}
            };
          }
        },
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 2
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_class).toBe("TRANSIENT_ERROR");
      expect(result.retryable).toBe(true);
    }
  });
});
