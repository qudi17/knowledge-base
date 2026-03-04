export type SearchSortMode = "stars" | "updated" | "best_match";

export interface SearchRequest {
  query: string;
  sort?: SearchSortMode;
  order?: "desc" | "asc";
  page?: number;
  per_page?: number;
  include_forks?: boolean;
  include_archived?: boolean;
  language?: string;
}

export interface NormalizedSearchOptions {
  query: string;
  sort: SearchSortMode;
  order: "desc" | "asc";
  page: number;
  per_page: number;
  include_forks: boolean;
  include_archived: boolean;
  language?: string;
}

export interface SearchResultItem {
  full_name: string;
  owner: string;
  repo: string;
  description: string;
  stars: number;
  updated_at: string;
  html_url: string;
  archived: boolean;
  fork: boolean;
}

export interface SearchQueryDiagnostics {
  query: string;
  sort: SearchSortMode;
  order: "desc" | "asc";
  page: number;
  per_page: number;
  applied_filters: string[];
}

export interface SearchSuccess {
  ok: true;
  total_count: number;
  incomplete_results: boolean;
  items: SearchResultItem[];
  query_diagnostics: SearchQueryDiagnostics;
  suggestions?: string[];
}

export interface SearchFailure {
  ok: false;
  error_class: "INPUT_ERROR" | "PERMISSION_OR_UNSUPPORTED" | "TRANSIENT_ERROR";
  error_code: string;
  message: string;
  summary: string;
  details: Record<string, unknown>;
  retryable: boolean;
}

export type SearchResult = SearchSuccess | SearchFailure;

export interface GitHubSearchRepositoryItem {
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  updated_at: string;
  html_url: string;
  archived: boolean;
  fork: boolean;
  owner: {
    login: string;
  };
}

export interface GitHubSearchApiResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchRepositoryItem[];
}
