export type InputType = "github_url" | "shorthand" | "local_path";

export interface RepositoryInput {
  raw: string;
}

export interface ParsedRepositoryTarget {
  input_raw: string;
  input_type: InputType;
  host: string;
  owner: string;
  repo: string;
  source_url?: string;
  source_path?: string;
}

export interface NormalizedRepositoryTarget {
  host: string;
  owner: string;
  repo: string;
  canonical_id: string;
  canonical_compare_key: string;
  canonical_url: string;
  normalized_path?: string;
  repo_root?: string;
  path_source?: "absolute" | "relative" | "home";
}

export interface CanonicalIdentityMapping {
  input_id: string;
  api_canonical_id: string;
  changed: boolean;
}

export interface CanonicalRepositoryMetadata {
  default_branch: string;
  visibility: "public" | "private" | "local";
  exists: boolean;
}

export interface IntakeSuccess {
  ok: true;
  input_raw: string;
  input_type: InputType;
  normalized: NormalizedRepositoryTarget;
  repository: CanonicalRepositoryMetadata;
  normalizations_applied: string[];
  identity_mapping: CanonicalIdentityMapping;
  display_name: string;
}

export interface IntakeErrorDetails {
  input?: string;
  host?: string | null;
  suggestions?: string[];
  [key: string]: unknown;
}

export interface IntakeFailure {
  ok: false;
  error_class: "INPUT_ERROR" | "PERMISSION_OR_UNSUPPORTED" | "TRANSIENT_ERROR";
  error_code: string;
  message: string;
  summary: string;
  details: IntakeErrorDetails;
  retryable: boolean;
}

export type IntakeResult = IntakeSuccess | IntakeFailure;

export interface ParseResult {
  ok: true;
  value: ParsedRepositoryTarget;
}

export interface ParseFailure {
  ok: false;
  message: string;
  details: IntakeErrorDetails;
}

export type ParseRepositoryTargetResult = ParseResult | ParseFailure;
