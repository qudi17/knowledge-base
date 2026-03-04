import { describe, expect, it } from "vitest";

import { runRepositoryPreflight } from "../../skills/github-researcher/lib/intake/preflight";

describe("runRepositoryPreflight", () => {
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
});
