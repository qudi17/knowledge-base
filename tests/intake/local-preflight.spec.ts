import { describe, expect, it } from "vitest";

import { resolveLocalRepositoryTarget } from "../../skills/github-researcher/lib/intake/local-resolver";
import { runRepositoryPreflight } from "../../skills/github-researcher/lib/intake/preflight";

describe("local intake resolver", () => {
  it("normalizes relative and home paths to deterministic real paths", async () => {
    const result = await resolveLocalRepositoryTarget("~/work/repo", "~/work/repo", {
      cwd: () => "/tmp",
      homedir: () => "/Users/eddy",
      realpath: async (target) => target.replace("~/", "/Users/eddy/"),
      access: async () => undefined,
      stat: async () => ({ isDirectory: () => true }),
      runGit: async (_cwd, args) => {
        if (args[0] === "rev-parse") return { ok: true, stdout: "/Users/eddy/work/repo\n" };
        if (args[0] === "symbolic-ref") return { ok: true, stdout: "main\n" };
        if (args[0] === "config") return { ok: false };
        return { ok: false };
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.normalized_path).toBe("/Users/eddy/work/repo");
      expect(result.normalized.repo_root).toBe("/Users/eddy/work/repo");
      expect(result.normalized.canonical_id).toBe("local:repo");
      expect(result.repository.visibility).toBe("local");
    }
  });

  it("returns PATH_NOT_FOUND for missing path", async () => {
    const result = await resolveLocalRepositoryTarget("./missing", "./missing", {
      cwd: () => "/tmp",
      homedir: () => "/Users/eddy",
      realpath: async () => {
        throw new Error("missing");
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error_code).toBe("PATH_NOT_FOUND");
      expect(result.error.retryable).toBe(false);
    }
  });

  it("returns PATH_NOT_READABLE for permission denied", async () => {
    const result = await resolveLocalRepositoryTarget("./repo", "./repo", {
      cwd: () => "/tmp",
      homedir: () => "/Users/eddy",
      realpath: async () => "/tmp/repo",
      access: async () => {
        throw new Error("EACCES");
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error_code).toBe("PATH_NOT_READABLE");
      expect(result.error.error_class).toBe("PERMISSION_OR_UNSUPPORTED");
    }
  });

  it("returns NON_GIT_DIRECTORY for non-git directory", async () => {
    const result = await resolveLocalRepositoryTarget("./dir", "./dir", {
      cwd: () => "/tmp",
      homedir: () => "/Users/eddy",
      realpath: async () => "/tmp/dir",
      access: async () => undefined,
      stat: async () => ({ isDirectory: () => true }),
      runGit: async () => ({ ok: false, stderr: "fatal: not a git repository" })
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error_code).toBe("NON_GIT_DIRECTORY");
    }
  });

  it("derives canonical owner/repo from GitHub remote when present", async () => {
    const result = await resolveLocalRepositoryTarget("./repo", "./repo", {
      cwd: () => "/tmp",
      homedir: () => "/Users/eddy",
      realpath: async () => "/tmp/repo",
      access: async () => undefined,
      stat: async () => ({ isDirectory: () => true }),
      runGit: async (_cwd, args) => {
        if (args[0] === "rev-parse") return { ok: true, stdout: "/tmp/repo\n" };
        if (args[0] === "symbolic-ref") return { ok: true, stdout: "develop\n" };
        if (args[0] === "config") return { ok: true, stdout: "git@github.com:OpenAI/openai-cookbook.git\n" };
        return { ok: false };
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.canonical_id).toBe("OpenAI/openai-cookbook");
      expect(result.normalized.canonical_url).toBe("https://github.com/OpenAI/openai-cookbook");
      expect(result.repository.default_branch).toBe("develop");
    }
  });
});

describe("runRepositoryPreflight local mode", () => {
  it("accepts local path input and returns input_type=local_path", async () => {
    const result = await runRepositoryPreflight("./repo", {
      localResolverDeps: {
        cwd: () => "/tmp",
        homedir: () => "/Users/eddy",
        realpath: async () => "/tmp/repo",
        access: async () => undefined,
        stat: async () => ({ isDirectory: () => true }),
        runGit: async (_cwd, args) => {
          if (args[0] === "rev-parse") return { ok: true, stdout: "/tmp/repo\n" };
          if (args[0] === "symbolic-ref") return { ok: false };
          if (args[0] === "config") return { ok: false };
          return { ok: false };
        }
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input_type).toBe("local_path");
      expect(result.repository.visibility).toBe("local");
      expect(result.repository.default_branch).toBe("main");
      expect(result.normalized.repo_root).toBe("/tmp/repo");
    }
  });
});
