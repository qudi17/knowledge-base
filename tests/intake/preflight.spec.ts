import { describe, expect, it } from "vitest";

import { runRepositoryPreflight } from "../../skills/github-researcher/lib/intake/preflight";

describe("runRepositoryPreflight", () => {
  it("enforces parse/normalize/validate/canonical order by gating canonical fetch", async () => {
    let canonicalCalls = 0;
    const httpClient = {
      async request(request: { url: string }) {
        canonicalCalls += 1;
        expect(request.url).toContain("/repos/OpenAI/openai-cookbook");
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: {},
          data: {
            id: 10,
            name: "openai-cookbook",
            full_name: "OpenAI/openai-cookbook",
            private: false,
            default_branch: "main",
            html_url: "https://github.com/OpenAI/openai-cookbook",
            owner: { login: "OpenAI" }
          }
        };
      }
    };

    const malformed = await runRepositoryPreflight("github.com/openai/openai-cookbook", { httpClient });
    expect(malformed.ok).toBe(false);
    expect(canonicalCalls).toBe(0);

    const unsupported = await runRepositoryPreflight("https://gitlab.com/openai/openai-cookbook", { httpClient });
    expect(unsupported.ok).toBe(false);
    expect(canonicalCalls).toBe(0);

    const success = await runRepositoryPreflight(
      "https://github.com/OpenAI/openai-cookbook.git/tree/main/examples",
      { httpClient }
    );
    expect(success.ok).toBe(true);
    expect(canonicalCalls).toBe(1);
  });

  it("returns canonical success payload with default branch", async () => {
    const result = await runRepositoryPreflight("https://github.com/OpenAI/openai-cookbook.git/tree/main/examples", {
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
      expect(result.normalized.canonical_id).toBe("OpenAI/openai-cookbook");
      expect(result.repository.default_branch).toBe("main");
      expect(result.normalizations_applied).toContain("strip_dot_git");
      expect(result.normalizations_applied).toContain("collapse_subpath_to_repo_root");
      expect(result.display_name).toBe("OpenAI/openai-cookbook.git");
    }
  });

  it("returns structured failure for unsupported host", async () => {
    const result = await runRepositoryPreflight("https://gitlab.com/openai/openai-cookbook");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_class).toBe("PERMISSION_OR_UNSUPPORTED");
      expect(result.error_code).toBe("UNSUPPORTED_HOST");
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.details).toHaveProperty("input");
    }
  });

  it("returns structured failure for malformed input", async () => {
    const result = await runRepositoryPreflight("github.com/openai/openai-cookbook");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_class).toBe("INPUT_ERROR");
      expect(result.error_code).toBe("INVALID_REPOSITORY_FORMAT");
      expect(result.summary).toContain("Input invalid");
    }
  });

  it("classifies repository not found from canonical lookup", async () => {
    const result = await runRepositoryPreflight("https://github.com/openai/missing-repo", {
      httpClient: {
        async request() {
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
    if (!result.ok) {
      expect(result.error_code).toBe("REPOSITORY_NOT_FOUND");
      expect(result.error_class).toBe("INPUT_ERROR");
      expect(result.details).toHaveProperty("display_name", "openai/missing-repo");
      expect(result.details).toHaveProperty("canonical_id", "openai/missing-repo");
    }
  });

  it("classifies private repository as unsupported", async () => {
    const result = await runRepositoryPreflight("https://github.com/openai/private-repo", {
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
      expect(result.error_code).toBe("PRIVATE_REPOSITORY_UNSUPPORTED");
      expect(result.error_class).toBe("PERMISSION_OR_UNSUPPORTED");
    }
  });

  it("handles transient upstream failure with bounded attempts", async () => {
    let attempts = 0;
    const result = await runRepositoryPreflight("https://github.com/openai/flaky-repo", {
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
    if (!result.ok) {
      expect(result.error_code).toBe("TRANSIENT_UPSTREAM_FAILURE");
      expect(result.error_class).toBe("TRANSIENT_ERROR");
      expect(attempts).toBe(3);
    }
  });

  it("maps rename/transfer to canonical owner and repo", async () => {
    const result = await runRepositoryPreflight("https://github.com/openai/cookbook-old", {
      httpClient: {
        async request() {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            headers: {},
            data: {
              id: 3,
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
      expect(result.normalized.owner).toBe("OpenAI");
      expect(result.normalized.repo).toBe("openai-cookbook");
      expect(result.normalized.canonical_id).toBe("OpenAI/openai-cookbook");
      expect(result.identity_mapping.changed).toBe(true);
      expect(result.identity_mapping.input_id).toBe("openai/cookbook-old");
    }
  });
});
