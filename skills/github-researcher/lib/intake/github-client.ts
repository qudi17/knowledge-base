import { classifyFromStatus, ERROR_CLASS, ERROR_CODE, isRetryableCode } from "./error-codes";
import type {
  CanonicalRepositoryResponse,
  GitHubRepositoryApiResponse,
  HttpClient,
  HttpRequest,
  HttpResponse
} from "./http-types";
import { retryTransient } from "./retry";
import type { IntakeFailure } from "./types";

export interface GitHubClientOptions {
  token?: string;
  userAgent?: string;
  httpClient?: HttpClient;
}

class FetchHttpClient implements HttpClient {
  async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers
    });

    let data: T | undefined;
    let rawBody: string | undefined;

    try {
      rawBody = await response.text();
      data = rawBody ? (JSON.parse(rawBody) as T) : undefined;
    } catch {
      data = undefined;
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: {},
      data,
      rawBody
    };
  }
}

function buildFailure(params: {
  input: string;
  errorClass: IntakeFailure["error_class"];
  errorCode: string;
  message: string;
  summary: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}): IntakeFailure {
  return {
    ok: false,
    error_class: params.errorClass,
    error_code: params.errorCode,
    message: params.message,
    summary: params.summary,
    details: {
      input: params.input,
      ...(params.details ?? {})
    },
    retryable: params.retryable
  };
}

export interface CanonicalRepositoryResultSuccess {
  ok: true;
  value: CanonicalRepositoryResponse;
  attempts: number;
}

export interface CanonicalRepositoryResultFailure {
  ok: false;
  error: IntakeFailure;
  attempts: number;
}

export type CanonicalRepositoryResult =
  | CanonicalRepositoryResultSuccess
  | CanonicalRepositoryResultFailure;

export async function fetchCanonicalRepository(
  inputId: string,
  owner: string,
  repo: string,
  options: GitHubClientOptions = {}
): Promise<CanonicalRepositoryResult> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": options.userAgent ?? "github-researcher-intake"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const client = options.httpClient ?? new FetchHttpClient();

  try {
    const retryResult = await retryTransient(
      async () => {
        const response = await client.request<GitHubRepositoryApiResponse>({
          method: "GET",
          url: `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
          headers,
          timeoutMs: 10_000
        });

        if (!response.ok) {
          const classified = classifyFromStatus(response.status);
          throw buildFailure({
            input: inputId,
            errorClass: classified.error_class,
            errorCode: classified.error_code,
            retryable: classified.retryable,
            message: `GitHub API responded with ${response.status}.`,
            summary: "Repository preflight failed while resolving canonical identity.",
            details: {
              status: response.status,
              status_text: response.statusText
            }
          });
        }

        if (!response.data) {
          throw buildFailure({
            input: inputId,
            errorClass: ERROR_CLASS.TRANSIENT_ERROR,
            errorCode: ERROR_CODE.TRANSIENT_UPSTREAM_FAILURE,
            retryable: true,
            message: "GitHub API returned empty response body.",
            summary: "Repository preflight failed due to incomplete upstream response."
          });
        }

        if (response.data.private) {
          throw buildFailure({
            input: inputId,
            errorClass: ERROR_CLASS.PERMISSION_OR_UNSUPPORTED,
            errorCode: ERROR_CODE.PRIVATE_REPOSITORY_UNSUPPORTED,
            retryable: false,
            message: "Private repositories are unsupported in v1.",
            summary: "Repository is private and unsupported in current phase.",
            details: {
              owner,
              repo
            }
          });
        }

        const canonicalOwner = response.data.owner.login;
        const canonicalRepo = response.data.name;
        const canonicalId = `${canonicalOwner}/${canonicalRepo}`;

        return {
          host: "github.com" as const,
          owner: canonicalOwner,
          repo: canonicalRepo,
          canonical_id: canonicalId,
          canonical_url: response.data.html_url,
          default_branch: response.data.default_branch,
          visibility: response.data.private ? ("private" as const) : ("public" as const),
          changed: canonicalId.toLowerCase() !== inputId.toLowerCase()
        };
      },
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        maxDelayMs: 2_000,
        shouldRetry: (error) => {
          if (typeof error === "object" && error !== null && "retryable" in error) {
            return Boolean((error as IntakeFailure).retryable);
          }
          if (typeof error === "object" && error !== null && "error_code" in error) {
            return isRetryableCode((error as { error_code: never }).error_code);
          }
          return true;
        }
      }
    );

    return {
      ok: true,
      value: retryResult.value,
      attempts: retryResult.attempts
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "ok" in error && (error as IntakeFailure).ok === false) {
      return {
        ok: false,
        error: error as IntakeFailure,
        attempts: 3
      };
    }

    return {
      ok: false,
      error: buildFailure({
        input: inputId,
        errorClass: ERROR_CLASS.TRANSIENT_ERROR,
        errorCode: ERROR_CODE.TRANSIENT_UPSTREAM_FAILURE,
        retryable: true,
        message: error instanceof Error ? error.message : "Unknown GitHub API failure.",
        summary: "Repository preflight failed due to transient upstream error."
      }),
      attempts: 3
    };
  }
}
