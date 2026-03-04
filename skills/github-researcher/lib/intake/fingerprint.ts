import { createHash } from "node:crypto";

import type { IntakeSuccess } from "./types";

export interface FingerprintInput {
  preflight: IntakeSuccess;
  mode_hint?: string;
}

function serializeForFingerprint(input: FingerprintInput): string {
  const normalized = input.preflight.normalized;

  const canonical = normalized.canonical_id.toLowerCase();
  const branch = input.preflight.repository.default_branch.toLowerCase();
  const mode = input.mode_hint ?? input.preflight.input_type;
  const path = normalized.normalized_path?.toLowerCase() ?? "";
  const root = normalized.repo_root?.toLowerCase() ?? "";

  return [mode, canonical, branch, path, root].join("|");
}

export function buildRunInputFingerprint(input: FingerprintInput): string {
  const payload = serializeForFingerprint(input);
  return createHash("sha256").update(payload).digest("hex");
}
