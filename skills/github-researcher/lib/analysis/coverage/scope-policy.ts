import type { CoverageEntryStatus, CoverageManifestEntry } from "./types";

export interface CoverageScopeInput {
  phase_id: string;
  path: string;
  parseable?: boolean;
  deferred?: boolean;
}

export interface CoverageScopeDecision extends CoverageManifestEntry {
  status: CoverageEntryStatus;
}

export const defaultCoverageExclusionPolicy: RegExp[] = [
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)dist(\/|$)/i,
  /(^|\/)build(\/|$)/i,
  /(^|\/)vendor(\/|$)/i,
  /(^|\/)\.next(\/|$)/i,
  /(^|\/)coverage(\/|$)/i,
  /\.min\.(js|css)$/i
];

function toModuleId(path: string): string {
  const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "root";
  }
  return parts.slice(0, 2).join("/").toLowerCase();
}

export function isExcludedByDefaultPolicy(path: string): boolean {
  return defaultCoverageExclusionPolicy.some((pattern) => pattern.test(path));
}

export function classifyCoverageScopeEntry(input: CoverageScopeInput): CoverageScopeDecision {
  const cleanPath = input.path.trim().replace(/\\/g, "/");
  const moduleId = toModuleId(cleanPath);

  if (isExcludedByDefaultPolicy(cleanPath)) {
    return {
      phase_id: input.phase_id,
      module_id: moduleId,
      path: cleanPath,
      status: "excluded",
      reason: "default_exclusion_policy"
    };
  }

  if (input.deferred) {
    return {
      phase_id: input.phase_id,
      module_id: moduleId,
      path: cleanPath,
      status: "deferred",
      reason: "deferred_scope"
    };
  }

  if (input.parseable === false) {
    return {
      phase_id: input.phase_id,
      module_id: moduleId,
      path: cleanPath,
      status: "unresolved",
      reason: "unparseable"
    };
  }

  return {
    phase_id: input.phase_id,
    module_id: moduleId,
    path: cleanPath,
    status: "scanned"
  };
}
