import type { PhaseScopeChunk, PhaseScopePlan } from "./types";
import { preserveCoreFirstPhaseOrder } from "../core/core-first-sequencer";

export interface PhasePlannerModuleInput {
  module_id: string;
  file_count: number;
  core_rank?: number;
}

export interface ShouldUsePhasedInput {
  candidate_files: number;
  module_count: number;
  estimated_tokens?: number;
  force_phased?: boolean;
}

const FILE_THRESHOLD = 1200;
const MODULE_THRESHOLD = 60;
const TOKEN_THRESHOLD = 1_200_000;

export function shouldUsePhasedCoverageExecution(input: ShouldUsePhasedInput): boolean {
  if (input.force_phased) return true;
  if (input.candidate_files > FILE_THRESHOLD) return true;
  if (input.module_count > MODULE_THRESHOLD) return true;
  if ((input.estimated_tokens ?? 0) > TOKEN_THRESHOLD) return true;
  return false;
}

function sortModules(input: PhasePlannerModuleInput[]): PhasePlannerModuleInput[] {
  const stagedOrder = preserveCoreFirstPhaseOrder(
    input.map((module) => ({
      module_id: module.module_id,
      stage:
        (module.core_rank ?? Number.MAX_SAFE_INTEGER) <= 1
          ? "entry_modules"
          : (module.core_rank ?? Number.MAX_SAFE_INTEGER) <= 5
            ? "core_business"
            : "supporting_modules",
      weight: module.file_count
    }))
  );
  const byId = new Map(input.map((module) => [module.module_id, module]));
  return stagedOrder.map((moduleId) => byId.get(moduleId)).filter((item): item is PhasePlannerModuleInput => Boolean(item));
}

export function buildPhaseScopePlan(input: {
  phase_prefix: string;
  modules: PhasePlannerModuleInput[];
  max_files_per_phase?: number;
  max_phases?: number;
  force_phased?: boolean;
}): PhaseScopePlan {
  const ordered = sortModules(input.modules);
  const totalFiles = ordered.reduce((sum, item) => sum + item.file_count, 0);
  const phased = shouldUsePhasedCoverageExecution({
    candidate_files: totalFiles,
    module_count: ordered.length,
    force_phased: input.force_phased
  });

  if (!phased) {
    return {
      phased: false,
      reason: "below_large_repo_threshold",
      chunks: [
        {
          phase_id: `${input.phase_prefix}.1`,
          order_index: 1,
          module_ids: ordered.map((item) => item.module_id),
          estimated_files: totalFiles
        }
      ]
    };
  }

  const maxFiles = input.max_files_per_phase ?? 800;
  const maxPhases = input.max_phases ?? 12;

  const chunks: PhaseScopeChunk[] = [];
  let currentModules: string[] = [];
  let currentFiles = 0;

  for (const module of ordered) {
    const overBudget = currentFiles > 0 && currentFiles + module.file_count > maxFiles;
    const canOpenNewChunk = chunks.length + 1 < maxPhases;

    if (overBudget && canOpenNewChunk) {
      const idx = chunks.length + 1;
      chunks.push({
        phase_id: `${input.phase_prefix}.${idx}`,
        order_index: idx,
        module_ids: currentModules,
        estimated_files: currentFiles
      });
      currentModules = [];
      currentFiles = 0;
    }

    currentModules.push(module.module_id);
    currentFiles += module.file_count;
  }

  if (currentModules.length > 0) {
    const idx = chunks.length + 1;
    chunks.push({
      phase_id: `${input.phase_prefix}.${idx}`,
      order_index: idx,
      module_ids: currentModules,
      estimated_files: currentFiles
    });
  }

  return {
    phased: true,
    reason: "large_repo_partitioned",
    chunks
  };
}
