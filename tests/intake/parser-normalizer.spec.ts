import { describe, expect, it } from "vitest";

import { normalizeRepositoryTarget } from "../../skills/github-researcher/lib/intake/normalizer";
import { parseRepositoryTarget } from "../../skills/github-researcher/lib/intake/parser";

describe("parseRepositoryTarget", () => {
  it("parses shorthand", () => {
    const result = parseRepositoryTarget("@openai/openai-cookbook");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.owner).toBe("openai");
      expect(result.value.repo).toBe("openai-cookbook");
    }
  });

  it("parses github URL with subpath", () => {
    const result = parseRepositoryTarget("https://github.com/openai/openai-cookbook/tree/main/examples");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.owner).toBe("openai");
      expect(result.value.repo).toBe("openai-cookbook");
      expect(result.value.source_path).toContain("/tree/");
    }
  });

  it("rejects malformed input", () => {
    const result = parseRepositoryTarget("github.com/openai");
    expect(result.ok).toBe(false);
  });
});

describe("normalizeRepositoryTarget", () => {
  it("strips dot git and collapses subpath", () => {
    const parsed = parseRepositoryTarget("https://github.com/OpenAI/openai-cookbook.git/tree/main/examples");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const normalized = normalizeRepositoryTarget(parsed.value);
    expect(normalized.normalized.canonical_id).toBe("OpenAI/openai-cookbook");
    expect(normalized.normalizations_applied).toContain("strip_dot_git");
    expect(normalized.normalizations_applied).toContain("collapse_subpath_to_repo_root");
  });
});
