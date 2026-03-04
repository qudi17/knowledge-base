import type { CoreModuleCandidate, CoreSelectionConfig, ScoredCoreModule } from "./types";

export const DEFAULT_SELECTION_CONFIG: CoreSelectionConfig = {
  weights: {
    critical_path: 0.5,
    change_activity: 0.3,
    dependency_centrality: 0.2
  },
  confidence_threshold: 0.7
};

function score(candidate: CoreModuleCandidate, config: CoreSelectionConfig): number {
  return (
    candidate.evidence.critical_path * config.weights.critical_path +
    candidate.evidence.change_activity * config.weights.change_activity +
    candidate.evidence.dependency_centrality * config.weights.dependency_centrality
  );
}

function rationale(candidate: CoreModuleCandidate, coreScore: number): string {
  return [
    `critical_path=${candidate.evidence.critical_path.toFixed(2)}`,
    `change_activity=${candidate.evidence.change_activity.toFixed(2)}`,
    `dependency_centrality=${candidate.evidence.dependency_centrality.toFixed(2)}`,
    `core_score=${coreScore.toFixed(3)}`,
    candidate.manual_promotion_reason ? `manual_promotion=${candidate.manual_promotion_reason}` : ""
  ]
    .filter(Boolean)
    .join("; ");
}

export function scoreCoreModules(
  candidates: CoreModuleCandidate[],
  config: CoreSelectionConfig = DEFAULT_SELECTION_CONFIG
): ScoredCoreModule[] {
  return [...candidates]
    .map((candidate) => {
      const coreScore = score(candidate, config);
      return {
        ...candidate,
        core_score: coreScore,
        evidence_class_count: new Set(candidate.evidence.evidence_classes).size,
        rationale: rationale(candidate, coreScore),
        manually_promoted: Boolean(candidate.manual_promotion_reason)
      };
    })
    .sort((a, b) => {
      if (b.core_score !== a.core_score) return b.core_score - a.core_score;
      if (b.evidence.critical_path !== a.evidence.critical_path) {
        return b.evidence.critical_path - a.evidence.critical_path;
      }
      if (b.evidence.change_activity !== a.evidence.change_activity) {
        return b.evidence.change_activity - a.evidence.change_activity;
      }
      if (b.evidence.dependency_centrality !== a.evidence.dependency_centrality) {
        return b.evidence.dependency_centrality - a.evidence.dependency_centrality;
      }
      return a.module_id.localeCompare(b.module_id);
    });
}

export function selectCoreModules(
  scored: ScoredCoreModule[],
  config: CoreSelectionConfig = DEFAULT_SELECTION_CONFIG
): ScoredCoreModule[] {
  return scored.filter((module) => {
    const byScore = module.core_score >= config.confidence_threshold;
    const byManual = module.manually_promoted;
    const enoughEvidence = module.evidence_class_count >= 2;
    return enoughEvidence && (byScore || byManual);
  });
}

export function top5OverlapRatio(current: ScoredCoreModule[], previousTop5Ids: string[]): number {
  const currentTop = current.slice(0, 5).map((module) => module.module_id);
  if (previousTop5Ids.length === 0) return 1;
  const previous = new Set(previousTop5Ids.slice(0, 5));
  const overlap = currentTop.filter((id) => previous.has(id)).length;
  return overlap / Math.min(5, previous.size);
}
