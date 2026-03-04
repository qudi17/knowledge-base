import type { CoreEvidenceBundle, CoreModuleCandidate, StabilityMarker } from "./types";

export interface ModuleSource {
  module_path: string;
  responsibility: string;
  entry_points?: string[];
  stability?: StabilityMarker;
  invoked_by_core_flow?: boolean;
  alias_of?: string;
  manual_promotion_reason?: string;
  evidence?: Partial<CoreEvidenceBundle>;
}

const EXCLUDED_DIR_PATTERN = /(^|\/)__(tests|mocks)__($|\/)|(^|\/)tests?($|\/)|(^|\/)examples?($|\/)|(^|\/)scripts?($|\/)/i;

function toModuleId(path: string): string {
  return path.trim().replace(/^\.\//, "").toLowerCase();
}

function mergeUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function defaultEvidence(input?: Partial<CoreEvidenceBundle>): CoreEvidenceBundle {
  return {
    critical_path: input?.critical_path ?? 0,
    change_activity: input?.change_activity ?? 0,
    dependency_centrality: input?.dependency_centrality ?? 0,
    evidence_classes: [...new Set(input?.evidence_classes ?? [])]
  };
}

function max(a: number, b: number): number {
  return a > b ? a : b;
}

export function extractModuleCandidates(sources: ModuleSource[]): CoreModuleCandidate[] {
  const grouped = new Map<string, CoreModuleCandidate>();

  for (const source of sources) {
    const path = source.module_path.trim();
    const excluded = EXCLUDED_DIR_PATTERN.test(path);
    if (excluded && !source.invoked_by_core_flow) {
      continue;
    }

    const canonicalPath = source.alias_of ? source.alias_of.trim() : path;
    const moduleId = toModuleId(canonicalPath);

    const candidate = grouped.get(moduleId);
    const seedEvidence = defaultEvidence(source.evidence);

    if (!candidate) {
      grouped.set(moduleId, {
        module_id: moduleId,
        module_path: canonicalPath,
        responsibility: source.responsibility,
        entry_points: mergeUnique(source.entry_points ?? []),
        stability: source.stability ?? "evolving",
        invoked_by_core_flow: source.invoked_by_core_flow,
        manual_promotion_reason: source.manual_promotion_reason,
        evidence: seedEvidence
      });
      continue;
    }

    candidate.entry_points = mergeUnique([...candidate.entry_points, ...(source.entry_points ?? [])]);
    candidate.responsibility = candidate.responsibility || source.responsibility;
    candidate.stability = candidate.stability === "stable" && source.stability !== "evolving" ? "stable" : (source.stability ?? candidate.stability);
    candidate.invoked_by_core_flow = Boolean(candidate.invoked_by_core_flow || source.invoked_by_core_flow);
    candidate.manual_promotion_reason = candidate.manual_promotion_reason ?? source.manual_promotion_reason;
    candidate.evidence = {
      critical_path: max(candidate.evidence.critical_path, seedEvidence.critical_path),
      change_activity: max(candidate.evidence.change_activity, seedEvidence.change_activity),
      dependency_centrality: max(candidate.evidence.dependency_centrality, seedEvidence.dependency_centrality),
      evidence_classes: mergeUnique([...candidate.evidence.evidence_classes, ...seedEvidence.evidence_classes])
    };
  }

  return [...grouped.values()].sort((a, b) => a.module_id.localeCompare(b.module_id));
}
