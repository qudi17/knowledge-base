export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpHeaders = Record<string, string>;

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: HttpHeaders;
  timeoutMs?: number;
}

export interface HttpResponse<T> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: HttpHeaders;
  data?: T;
  rawBody?: string;
}

export interface HttpClient {
  request<T>(request: HttpRequest): Promise<HttpResponse<T>>;
}

export interface GitHubRepositoryApiResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: {
    login: string;
  };
}

export interface CanonicalRepositoryResponse {
  host: "github.com";
  owner: string;
  repo: string;
  canonical_id: string;
  canonical_url: string;
  default_branch: string;
  visibility: "public" | "private";
  changed: boolean;
}
