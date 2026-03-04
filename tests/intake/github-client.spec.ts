import { describe, expect, it } from "vitest";

import { fetchCanonicalRepository } from "../../skills/github-researcher/lib/intake/github-client";

describe("fetchCanonicalRepository", () => {
  it("returns canonical metadata on success", async () => {
    const result = await fetchCanonicalRepository("openai/openai-cookbook", "openai", "openai-cookbook", {
      httpClient: {
        async request() {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            headers: {},
            data: {
              id: 1,
              name: "openai-cookbook",
              full_name: "OpenAI/openai-cookbook",
              private: false,
              default_branch: "main",
              html_url: "https://github.com/OpenAI/openai-cookbook",
              owner: { login: "OpenAI" }
            }
          };
        }
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.canonical_id).toBe("OpenAI/openai-cookbook");
      expect(result.value.changed).toBe(false);
    }
  });

  it("maps private repository to unsupported", async () => {
    const result = await fetchCanonicalRepository("openai/private-repo", "openai", "private-repo", {
      httpClient: {
        async request() {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            headers: {},
            data: {
              id: 2,
              name: "private-repo",
              full_name: "openai/private-repo",
              private: true,
              default_branch: "main",
              html_url: "https://github.com/openai/private-repo",
              owner: { login: "openai" }
            }
          };
        }
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error_code).toBe("PRIVATE_REPOSITORY_UNSUPPORTED");
      expect(result.error.error_class).toBe("PERMISSION_OR_UNSUPPORTED");
    }
  });

  it("retries transient upstream failures with bounded max attempts", async () => {
    let attempts = 0;

    const result = await fetchCanonicalRepository("openai/flaky-repo", "openai", "flaky-repo", {
      httpClient: {
        async request() {
          attempts += 1;
          return {
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            headers: {}
          };
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(attempts).toBe(3);
    if (!result.ok) {
      expect(result.error.error_class).toBe("TRANSIENT_ERROR");
      expect(result.error.error_code).toBe("TRANSIENT_UPSTREAM_FAILURE");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("does not retry non-retryable not-found failures", async () => {
    let attempts = 0;

    const result = await fetchCanonicalRepository("openai/missing-repo", "openai", "missing-repo", {
      httpClient: {
        async request() {
          attempts += 1;
          return {
            ok: false,
            status: 404,
            statusText: "Not Found",
            headers: {}
          };
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(attempts).toBe(1);
    if (!result.ok) {
      expect(result.error.error_class).toBe("INPUT_ERROR");
      expect(result.error.error_code).toBe("REPOSITORY_NOT_FOUND");
      expect(result.error.retryable).toBe(false);
    }
  });
});
