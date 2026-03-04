import type { CoreRoleExplanation, ScoredCoreModule } from "./types";

export function explainCoreModuleRoles(selected: ScoredCoreModule[]): CoreRoleExplanation[] {
  return selected.map((module) => {
    const summaryPrefix = module.stability === "stable" ? "Stable core module" : "Evolving core module";
    const manualNote = module.manually_promoted ? " Manual promotion applied." : "";

    return {
      module_id: module.module_id,
      summary: `${summaryPrefix} for ${module.responsibility}.${manualNote}`.trim(),
      entry_points: [...module.entry_points],
      stability: module.stability,
      evidence_class_count: module.evidence_class_count,
      rationale: module.rationale
    };
  });
}
