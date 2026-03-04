import { describe, expect, it } from "vitest";

import { validateRepositoryCandidate } from "../../skills/github-researcher/lib/intake/validator";

describe("validateRepositoryCandidate", () => {
  it("accepts github target", () => {
    const result = validateRepositoryCandidate("https://github.com/openai/openai-cookbook", {
      host: "github.com",
      owner: "openai",
      repo: "openai-cookbook",
      canonical_id: "openai/openai-cookbook",
      canonical_compare_key: "openai/openai-cookbook",
      canonical_url: "https://github.com/openai/openai-cookbook"
    });

    expect(result.ok).toBe(true);
  });

  it("rejects unsupported host", () => {
    const result = validateRepositoryCandidate("https://gitlab.com/openai/openai-cookbook", {
      host: "gitlab.com",
      owner: "openai",
      repo: "openai-cookbook",
      canonical_id: "openai/openai-cookbook",
      canonical_compare_key: "openai/openai-cookbook",
      canonical_url: "https://gitlab.com/openai/openai-cookbook"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error_code).toBe("UNSUPPORTED_HOST");
    }
  });
});
