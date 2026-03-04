import type { NormalizedRepositoryTarget, ParsedRepositoryTarget } from "./types";

export interface NormalizationOutput {
  normalized: NormalizedRepositoryTarget;
  normalizations_applied: string[];
}

function stripDotGit(repo: string): { repo: string; changed: boolean } {
  if (repo.toLowerCase().endsWith(".git")) {
    return {
      repo: repo.slice(0, -4),
      changed: true
    };
  }

  return { repo, changed: false };
}

function normalizeOwnerOrRepo(value: string): { value: string; changed: boolean } {
  const trimmed = value.trim();
  return {
    value: trimmed,
    changed: trimmed !== value
  };
}

export function normalizeRepositoryTarget(parsed: ParsedRepositoryTarget): NormalizationOutput {
  const normalizations_applied: string[] = [];

  const host = parsed.host.trim().toLowerCase();
  if (host !== parsed.host) {
    normalizations_applied.push("normalize_host_case");
  }

  const ownerResult = normalizeOwnerOrRepo(parsed.owner);
  const repoResult = normalizeOwnerOrRepo(parsed.repo);

  if (ownerResult.changed || repoResult.changed) {
    normalizations_applied.push("trim_segments");
  }

  const dotGitResult = stripDotGit(repoResult.value);
  if (dotGitResult.changed) {
    normalizations_applied.push("strip_dot_git");
  }

  const sourcePath = parsed.source_path ?? "";
  if (sourcePath.includes("/tree/") || sourcePath.includes("/blob/")) {
    normalizations_applied.push("collapse_subpath_to_repo_root");
  }

  const normalized: NormalizedRepositoryTarget = {
    host,
    owner: ownerResult.value,
    repo: dotGitResult.repo,
    canonical_id: `${ownerResult.value}/${dotGitResult.repo}`,
    canonical_compare_key: `${ownerResult.value}/${dotGitResult.repo}`.toLowerCase(),
    canonical_url: `https://github.com/${ownerResult.value}/${dotGitResult.repo}`
  };

  return {
    normalized,
    normalizations_applied
  };
}
