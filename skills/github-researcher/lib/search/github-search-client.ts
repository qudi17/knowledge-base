import { classifyFromStatus, ERROR_CLASS, ERROR_CODE } from "../intake/error-codes";
import type { HttpClient, HttpRequest, HttpResponse } from "../intake/http-types";
import { retryTransient } from "../intake/retry";
import { buildSearchQuery, normalizeSearchOptions } from "./query-builder";
import type {
  GitHubSearchApiResponse,
  SearchFailure,
  SearchRequest,
  SearchResult,
  SearchResultItem
} from "./types";

export interface SearchClientOptions {
  token?: string;
  userAgent?: string;
  httpClient?: HttpClient;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
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

function mapItem(item: GitHubSearchApiResponse["items"][number]): SearchResultItem {
  const [ownerFromName = item.owner.login, repoFromName = item.name] = item.full_name.split("/");

  return {
    full_name: item.full_name,
    owner: ownerFromName,
    repo: repoFromName,
    description: item.description ?? "",
    stars: item.stargazers_count,
    updated_at: item.updated_at,
    html_url: item.html_url,
    archived: item.archived,
    fork: item.fork
  };
}

function buildFailure(params: {
  error_class: SearchFailure["error_class"];
  error_code: string;
  message: string;
  summary: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}): SearchFailure {
  return {
    ok: false,
    error_class: params.error_class,
    error_code: params.error_code,
    message: params.message,
    summary: params.summary,
    details: params.details ?? {},
    retryable: params.retryable
  };
}

export async function searchGitHubRepositories(
  request: SearchRequest,
  options: SearchClientOptions = {}
): Promise<SearchResult> {
  const normalized = normalizeSearchOptions(request);
  const query = buildSearchQuery(normalized);

  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("order", normalized.order);
  url.searchParams.set("page", String(normalized.page));
  url.searchParams.set("per_page", String(normalized.per_page));
  if (normalized.sort !== "best_match") {
    url.searchParams.set("sort", normalized.sort);
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": options.userAgent ?? "github-researcher-search"
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const client = options.httpClient ?? new FetchHttpClient();

  try {
    const retried = await retryTransient(
      async () => {
        const response = await client.request<GitHubSearchApiResponse>({
          method: "GET",
          url: url.toString(),
          headers,
          timeoutMs: 10_000
        });

        if (!response.ok) {
          const classified = classifyFromStatus(response.status);
          throw buildFailure({
            error_class: classified.error_class,
            error_code: classified.error_code,
            message: `GitHub search API responded with ${response.status}.`,
            summary: "Repository search failed while querying GitHub.",
            retryable: classified.retryable,
            details: {
              status: response.status,
              status_text: response.statusText,
              query
            }
          });
        }

        if (!response.data) {
          throw buildFailure({
            error_class: ERROR_CLASS.TRANSIENT_ERROR,
            error_code: ERROR_CODE.TRANSIENT_UPSTREAM_FAILURE,
            message: "GitHub search API returned empty response body.",
            summary: "Repository search failed due to incomplete upstream response.",
            retryable: true,
            details: { query }
          });
        }

        return response.data;
      },
      {
        maxAttempts: options.maxAttempts ?? 3,
        baseDelayMs: options.baseDelayMs ?? 50,
        maxDelayMs: options.maxDelayMs ?? 250,
        shouldRetry: (error) => {
          if (typeof error === "object" && error !== null && "retryable" in error) {
            return Boolean((error as SearchFailure).retryable);
          }
          return true;
        }
      }
    );

    const appliedFilters: string[] = [];
    if (!normalized.include_forks) appliedFilters.push("fork:false");
    if (!normalized.include_archived) appliedFilters.push("archived:false");
    if (normalized.language) appliedFilters.push(`language:${normalized.language}`);

    return {
      ok: true,
      total_count: retried.value.total_count,
      incomplete_results: retried.value.incomplete_results,
      items: retried.value.items.map(mapItem),
      query_diagnostics: {
        query,
        sort: normalized.sort,
        order: normalized.order,
        page: normalized.page,
        per_page: normalized.per_page,
        applied_filters: appliedFilters
      }
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "ok" in error && (error as SearchFailure).ok === false) {
      return error as SearchFailure;
    }

    return buildFailure({
      error_class: ERROR_CLASS.TRANSIENT_ERROR,
      error_code: ERROR_CODE.TRANSIENT_UPSTREAM_FAILURE,
      message: error instanceof Error ? error.message : "Unknown search failure.",
      summary: "Repository search failed due to transient upstream error.",
      retryable: true,
      details: { query }
    });
  }
}
