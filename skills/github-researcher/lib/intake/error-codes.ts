export const ERROR_CLASS = {
  INPUT_ERROR: "INPUT_ERROR",
  PERMISSION_OR_UNSUPPORTED: "PERMISSION_OR_UNSUPPORTED",
  TRANSIENT_ERROR: "TRANSIENT_ERROR"
} as const;

export type ErrorClass = (typeof ERROR_CLASS)[keyof typeof ERROR_CLASS];

export const ERROR_CODE = {
  INVALID_REPOSITORY_FORMAT: "INVALID_REPOSITORY_FORMAT",
  UNSUPPORTED_HOST: "UNSUPPORTED_HOST",
  REPOSITORY_NOT_FOUND: "REPOSITORY_NOT_FOUND",
  PRIVATE_REPOSITORY_UNSUPPORTED: "PRIVATE_REPOSITORY_UNSUPPORTED",
  PERMISSION_OR_UNSUPPORTED: "PERMISSION_OR_UNSUPPORTED",
  RATE_LIMITED: "RATE_LIMITED",
  TRANSIENT_UPSTREAM_FAILURE: "TRANSIENT_UPSTREAM_FAILURE"
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

const RETRYABLE_BY_CODE: Record<ErrorCode, boolean> = {
  INVALID_REPOSITORY_FORMAT: false,
  UNSUPPORTED_HOST: false,
  REPOSITORY_NOT_FOUND: false,
  PRIVATE_REPOSITORY_UNSUPPORTED: false,
  PERMISSION_OR_UNSUPPORTED: false,
  RATE_LIMITED: true,
  TRANSIENT_UPSTREAM_FAILURE: true
};

export function isRetryableCode(errorCode: ErrorCode): boolean {
  return RETRYABLE_BY_CODE[errorCode] ?? false;
}

export function classifyFromStatus(status: number): {
  error_class: ErrorClass;
  error_code: ErrorCode;
  retryable: boolean;
} {
  if (status === 404) {
    return {
      error_class: ERROR_CLASS.INPUT_ERROR,
      error_code: ERROR_CODE.REPOSITORY_NOT_FOUND,
      retryable: false
    };
  }

  if (status === 401 || status === 403 || status === 451) {
    return {
      error_class: ERROR_CLASS.PERMISSION_OR_UNSUPPORTED,
      error_code: ERROR_CODE.PERMISSION_OR_UNSUPPORTED,
      retryable: false
    };
  }

  if (status === 429) {
    return {
      error_class: ERROR_CLASS.TRANSIENT_ERROR,
      error_code: ERROR_CODE.RATE_LIMITED,
      retryable: true
    };
  }

  if (status >= 500) {
    return {
      error_class: ERROR_CLASS.TRANSIENT_ERROR,
      error_code: ERROR_CODE.TRANSIENT_UPSTREAM_FAILURE,
      retryable: true
    };
  }

  return {
    error_class: ERROR_CLASS.TRANSIENT_ERROR,
    error_code: ERROR_CODE.TRANSIENT_UPSTREAM_FAILURE,
    retryable: true
  };
}
