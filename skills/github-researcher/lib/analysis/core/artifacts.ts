import type {
  CoreRoleExplanation,
  CoreSelectionConfig,
  CoreSnapshotArtifact,
  CoreSnapshotModule,
  ScoredCoreModule
} from "./types";
import type { CoverageManifest } from "../coverage/types";

export interface BuildSnapshotInput {
  selected_modules: ScoredCoreModule[];
  role_explanations: CoreRoleExplanation[];
  selection_config: CoreSelectionConfig;
  generated_at?: string;
}

export interface CoverageManifestSnapshot {
  phase: "06";
  generated_at: string;
  manifest: CoverageManifest;
  snapshot_version: number;
}

function isoNow(): string {
  return new Date().toISOString();
}

function mapRoleById(roles: CoreRoleExplanation[]): Map<string, CoreRoleExplanation> {
  return new Map(roles.map((role) => [role.module_id, role]));
}

function toSnapshotModules(
  selected: ScoredCoreModule[],
  roles: CoreRoleExplanation[]
): CoreSnapshotModule[] {
  const roleMap = mapRoleById(roles);

  return [...selected]
    .sort((a, b) => b.core_score - a.core_score || a.module_id.localeCompare(b.module_id))
    .map((module) => {
      const role = roleMap.get(module.module_id);
      return {
        module_id: module.module_id,
        module_path: module.module_path,
        core_score: module.core_score,
        entry_points: [...module.entry_points],
        stability: module.stability,
        responsibility: module.responsibility,
        evidence_class_count: module.evidence_class_count,
        rationale: module.rationale,
        role_summary: role?.summary ?? module.responsibility,
        manually_promoted: module.manually_promoted
      };
    });
}

export function buildCoreSnapshotArtifact(input: BuildSnapshotInput): CoreSnapshotArtifact {
  return {
    phase: "05",
    generated_at: input.generated_at ?? isoNow(),
    selection_config: input.selection_config,
    modules: toSnapshotModules(input.selected_modules, input.role_explanations),
    top5_overlap_target: 0.8,
    frozen: false,
    snapshot_version: 1
  };
}

export function parseCoreSnapshotArtifact(raw: string): CoreSnapshotArtifact {
  const parsed = JSON.parse(raw) as CoreSnapshotArtifact;

  if (parsed.phase !== "05") {
    throw new Error("Invalid snapshot phase.");
  }

  if (!Array.isArray(parsed.modules)) {
    throw new Error("Invalid snapshot modules.");
  }

  return parsed;
}

export function freezeCoreConclusionSnapshot(
  artifact: CoreSnapshotArtifact,
  at: string = isoNow()
): CoreSnapshotArtifact {
  return {
    ...artifact,
    frozen: true,
    generated_at: at
  };
}

export function updateCoreSnapshotAfterRevalidation(
  artifact: CoreSnapshotArtifact,
  reason: string,
  at: string = isoNow()
): CoreSnapshotArtifact {
  return {
    ...artifact,
    snapshot_version: artifact.snapshot_version + 1,
    revalidation: {
      reason,
      updated_at: at
    }
  };
}

export function buildCoverageManifestSnapshot(
  manifest: CoverageManifest,
  at: string = isoNow()
): CoverageManifestSnapshot {
  return {
    phase: "06",
    generated_at: at,
    manifest,
    snapshot_version: 1
  };
}

export function parseCoverageManifestSnapshot(raw: string): CoverageManifestSnapshot {
  const parsed = JSON.parse(raw) as CoverageManifestSnapshot;
  if (parsed.phase !== "06") {
    throw new Error("Invalid coverage snapshot phase.");
  }
  if (!parsed.manifest || !Array.isArray(parsed.manifest.entries)) {
    throw new Error("Invalid coverage manifest snapshot payload.");
  }
  return parsed;
}
