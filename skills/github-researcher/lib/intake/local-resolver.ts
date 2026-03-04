import { access, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ERROR_CLASS, ERROR_CODE } from "./error-codes";
import type { IntakeFailure, IntakeResult, IntakeSuccess, NormalizedRepositoryTarget } from "./types";

const execFileAsync = promisify(execFile);

export interface LocalResolverDeps {
  cwd?: () => string;
  homedir?: () => string;
  realpath?: (target: string) => Promise<string>;
  access?: (target: string) => Promise<void>;
  stat?: (target: string) => Promise<{ isDirectory: () => boolean }>;
  runGit?: (cwd: string, args: string[]) => Promise<{ ok: boolean; stdout?: string; stderr?: string }>;
}

export interface LocalResolutionSuccess {
  ok: true;
  normalized: NormalizedRepositoryTarget;
  repository: IntakeSuccess["repository"];
  normalizations_applied: string[];
}

export interface LocalResolutionFailure {
  ok: false;
  error: IntakeFailure;
}

export type LocalResolutionResult = LocalResolutionSuccess | LocalResolutionFailure;

function buildFailure(params: {
  input: string;
  code: string;
  message: string;
  summary: string;
  details?: Record<string, unknown>;
  error_class?: IntakeFailure["error_class"];
}): LocalResolutionFailure {
  return {
    ok: false,
    error: {
      ok: false,
      error_class: params.error_class ?? ERROR_CLASS.INPUT_ERROR,
      error_code: params.code,
      message: params.message,
      summary: params.summary,
      details: {
        input: params.input,
        ...(params.details ?? {})
      },
      retryable: false
    }
  };
}

function parseCanonicalFromRemote(remoteUrl: string): { canonicalId: string; canonicalUrl: string } | null {
  const httpsMatch = remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (httpsMatch) {
    return {
      canonicalId: `${httpsMatch[1]}/${httpsMatch[2]}`,
      canonicalUrl: `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`
    };
  }

  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      canonicalId: `${sshMatch[1]}/${sshMatch[2]}`,
      canonicalUrl: `https://github.com/${sshMatch[1]}/${sshMatch[2]}`
    };
  }

  return null;
}

function defaultRunGit(cwdPath: string, args: string[]): Promise<{ ok: boolean; stdout?: string; stderr?: string }> {
  return execFileAsync("git", ["-C", cwdPath, ...args], { timeout: 5000 })
    .then((out) => ({ ok: true, stdout: out.stdout }))
    .catch((error: { stderr?: string }) => ({ ok: false, stderr: error.stderr }));
}

function expandHomePath(inputPath: string, homePath: string): { value: string; changed: boolean; source: "home" | "relative" | "absolute" } {
  if (inputPath.startsWith("~/")) {
    return { value: resolve(homePath, inputPath.slice(2)), changed: true, source: "home" };
  }

  if (!isAbsolute(inputPath)) {
    return { value: inputPath, changed: false, source: "relative" };
  }

  return { value: inputPath, changed: false, source: "absolute" };
}

export async function resolveLocalRepositoryTarget(
  inputRaw: string,
  rawPath: string,
  deps: LocalResolverDeps = {}
): Promise<LocalResolutionResult> {
  const cwdFn = deps.cwd ?? (() => process.cwd());
  const homeFn = deps.homedir ?? (() => homedir());
  const realpathFn = deps.realpath ?? realpath;
  const accessFn = deps.access ?? access;
  const statFn = deps.stat ?? stat;
  const runGit = deps.runGit ?? defaultRunGit;

  const normalizations_applied: string[] = [];

  const expanded = expandHomePath(rawPath, homeFn());
  let candidate = expanded.value;

  if (expanded.source === "home") {
    normalizations_applied.push("expand_home");
  }

  if (expanded.source === "relative") {
    candidate = resolve(cwdFn(), candidate);
    normalizations_applied.push("resolve_relative");
  }

  if (candidate.endsWith("/")) {
    candidate = candidate.replace(/\/+$/, "");
    normalizations_applied.push("strip_trailing_slash");
  }

  let normalizedPath: string;
  try {
    normalizedPath = await realpathFn(candidate);
    if (normalizedPath !== candidate) {
      normalizations_applied.push("resolve_realpath");
    }
  } catch {
    return buildFailure({
      input: inputRaw,
      code: ERROR_CODE.PATH_NOT_FOUND,
      message: "Local path does not exist.",
      summary: "Local repository preflight failed: path not found.",
      details: {
        normalized_path: candidate,
        suggestions: [
          "Check the path exists and is spelled correctly.",
          "Use an absolute path to avoid working-directory ambiguity.",
          "Verify the repository is available on this machine."
        ]
      }
    });
  }

  try {
    await accessFn(normalizedPath);
  } catch {
    return buildFailure({
      input: inputRaw,
      code: ERROR_CODE.PATH_NOT_READABLE,
      message: "Local path is not readable.",
      summary: "Local repository preflight failed: path is not readable.",
      error_class: ERROR_CLASS.PERMISSION_OR_UNSUPPORTED,
      details: {
        normalized_path: normalizedPath,
        suggestions: [
          "Check filesystem permissions for the target path.",
          "Run with a user that can read the repository directory.",
          "Choose a different local repository path."
        ]
      }
    });
  }

  const stats = await statFn(normalizedPath);
  if (!stats.isDirectory()) {
    return buildFailure({
      input: inputRaw,
      code: ERROR_CODE.NON_GIT_DIRECTORY,
      message: "Local input must be a directory inside a git repository.",
      summary: "Local repository preflight failed: input is not a directory.",
      details: {
        normalized_path: normalizedPath,
        suggestions: [
          "Provide a repository directory path.",
          "If pointing at a file, use its parent repository path.",
          "Run `git rev-parse --show-toplevel` to confirm repository root."
        ]
      }
    });
  }

  const repoRootResult = await runGit(normalizedPath, ["rev-parse", "--show-toplevel"]);
  if (!repoRootResult.ok || !repoRootResult.stdout?.trim()) {
    return buildFailure({
      input: inputRaw,
      code: ERROR_CODE.NON_GIT_DIRECTORY,
      message: "Path is not inside a git repository.",
      summary: "Local repository preflight failed: non-git directory.",
      details: {
        normalized_path: normalizedPath,
        suggestions: [
          "Choose a path inside an existing git repository.",
          "Initialize a git repository with `git init` if appropriate.",
          "Verify `.git` metadata is present and accessible."
        ]
      }
    });
  }

  const repoRoot = repoRootResult.stdout.trim();
  if (repoRoot !== normalizedPath) {
    normalizations_applied.push("resolve_repo_root");
  }

  const branchResult = await runGit(repoRoot, ["symbolic-ref", "--short", "HEAD"]);
  const defaultBranch = branchResult.ok && branchResult.stdout?.trim() ? branchResult.stdout.trim() : "main";
  if (!branchResult.ok) {
    normalizations_applied.push("fallback_default_branch_main");
  }

  const remoteResult = await runGit(repoRoot, ["config", "--get", "remote.origin.url"]);
  const remoteUrl = remoteResult.ok ? remoteResult.stdout?.trim() ?? "" : "";
  const repoName = basename(repoRoot);

  const parsedRemote = remoteUrl ? parseCanonicalFromRemote(remoteUrl) : null;
  const canonicalId = parsedRemote?.canonicalId ?? `local:${repoName}`;
  const canonicalUrl = parsedRemote?.canonicalUrl ?? "";

  const normalized: NormalizedRepositoryTarget = {
    host: "local",
    owner: repoName,
    repo: repoName,
    canonical_id: canonicalId,
    canonical_compare_key: canonicalId.toLowerCase(),
    canonical_url: canonicalUrl,
    normalized_path: normalizedPath,
    repo_root: repoRoot,
    path_source: expanded.source
  };

  return {
    ok: true,
    normalized,
    repository: {
      default_branch: defaultBranch,
      visibility: "local",
      exists: true
    },
    normalizations_applied
  };
}

export async function runLocalRepositoryPreflight(
  inputRaw: string,
  rawPath: string,
  deps: LocalResolverDeps = {}
): Promise<IntakeResult> {
  const resolved = await resolveLocalRepositoryTarget(inputRaw, rawPath, deps);
  if (!resolved.ok) {
    return resolved.error;
  }

  return {
    ok: true,
    input_raw: inputRaw,
    input_type: "local_path",
    normalized: resolved.normalized,
    repository: resolved.repository,
    normalizations_applied: resolved.normalizations_applied,
    identity_mapping: {
      input_id: resolved.normalized.normalized_path ?? rawPath,
      api_canonical_id: resolved.normalized.canonical_id,
      changed: true
    },
    display_name: resolved.normalized.repo_root ?? resolved.normalized.canonical_id
  };
}
