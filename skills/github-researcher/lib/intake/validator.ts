import { ERROR_CLASS, ERROR_CODE } from "./error-codes";
import type { IntakeFailure, NormalizedRepositoryTarget } from "./types";

export interface ValidationSuccess {
  ok: true;
}

export interface ValidationFailure {
  ok: false;
  error: IntakeFailure;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function inputError(input: string, message: string, details: Record<string, unknown> = {}): IntakeFailure {
  return {
    ok: false,
    error_class: ERROR_CLASS.INPUT_ERROR,
    error_code: ERROR_CODE.INVALID_REPOSITORY_FORMAT,
    message,
    summary: `Input invalid: ${message}`,
    details: {
      input,
      ...details
    },
    retryable: false
  };
}

export function validateRepositoryCandidate(
  inputRaw: string,
  target: NormalizedRepositoryTarget
): ValidationResult {
  if (target.host !== "github.com") {
    return {
      ok: false,
      error: {
        ok: false,
        error_class: ERROR_CLASS.PERMISSION_OR_UNSUPPORTED,
        error_code: ERROR_CODE.UNSUPPORTED_HOST,
        message: "Only github.com repositories are supported in v1.",
        summary: "Unsupported host for v1 repository intake.",
        details: {
          input: inputRaw,
          host: target.host,
          suggestions: ["Use https://github.com/owner/repo or @owner/repo"]
        },
        retryable: false
      }
    };
  }

  if (!target.owner || !target.repo) {
    return {
      ok: false,
      error: inputError(inputRaw, "Owner and repository are required.")
    };
  }

  if (target.owner.includes(" ") || target.repo.includes(" ")) {
    return {
      ok: false,
      error: inputError(inputRaw, "Owner and repository cannot include spaces.")
    };
  }

  return { ok: true };
}
