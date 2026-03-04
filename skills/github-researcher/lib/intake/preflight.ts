import { ERROR_CLASS, ERROR_CODE } from "./error-codes";
import { fetchCanonicalRepository, type GitHubClientOptions } from "./github-client";
import { runLocalRepositoryPreflight, type LocalResolverDeps } from "./local-resolver";
import { normalizeRepositoryTarget } from "./normalizer";
import { parseRepositoryTarget } from "./parser";
import { validateRepositoryCandidate } from "./validator";
import type { IntakeFailure, IntakeResult, IntakeSuccess } from "./types";

export interface PreflightOptions extends GitHubClientOptions {
  localResolverDeps?: LocalResolverDeps;
}

function failureFromParse(message: string, details: Record<string, unknown> = {}): IntakeFailure {
  return {
    ok: false,
    error_class: ERROR_CLASS.INPUT_ERROR,
    error_code: ERROR_CODE.INVALID_REPOSITORY_FORMAT,
    message,
    summary: `Input invalid: ${message}`,
    details,
    retryable: false
  };
}

export async function runRepositoryPreflight(
  inputRaw: string,
  options: PreflightOptions = {}
): Promise<IntakeResult> {
  const parseResult = parseRepositoryTarget(inputRaw);
  if (!parseResult.ok) {
    return failureFromParse(parseResult.message, parseResult.details);
  }

  const parsed = parseResult.value;
  if (parsed.input_type === "local_path") {
    return runLocalRepositoryPreflight(inputRaw, parsed.source_path ?? inputRaw, options.localResolverDeps);
  }

  const normalization = normalizeRepositoryTarget(parsed);

  const validation = validateRepositoryCandidate(inputRaw, normalization.normalized);
  if (!validation.ok) {
    return validation.error;
  }

  const inputId = `${normalization.normalized.owner}/${normalization.normalized.repo}`;
  const canonical = await fetchCanonicalRepository(
    inputId,
    normalization.normalized.owner,
    normalization.normalized.repo,
    options
  );

  if (!canonical.ok) {
    const error = canonical.error;
    return {
      ...error,
      summary: error.summary || "Repository preflight failed.",
      details: {
        ...error.details,
        display_name: inputId,
        canonical_id: inputId
      }
    };
  }

  const success: IntakeSuccess = {
    ok: true,
    input_raw: inputRaw,
    input_type: parsed.input_type,
    normalized: {
      ...normalization.normalized,
      owner: canonical.value.owner,
      repo: canonical.value.repo,
      canonical_id: canonical.value.canonical_id,
      canonical_compare_key: canonical.value.canonical_id.toLowerCase(),
      canonical_url: canonical.value.canonical_url
    },
    repository: {
      default_branch: canonical.value.default_branch,
      visibility: canonical.value.visibility,
      exists: true
    },
    normalizations_applied: normalization.normalizations_applied,
    identity_mapping: {
      input_id: inputId,
      api_canonical_id: canonical.value.canonical_id,
      changed: canonical.value.changed
    },
    display_name: `${parsed.owner}/${parsed.repo}`
  };

  return success;
}
