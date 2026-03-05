export type EvidenceValidationReasonCode =
  | "ok"
  | "missing_evidence_for_conclusion"
  | "missing_citation_links"
  | "missing_line_anchor"
  | "missing_function_level_snippet"
  | "missing_sha_link"
  | "missing_default_branch_link"
  | "invalid_dual_link_order"
  | "invalid_evidence_id"
  | "invalid_conclusion_id"
  | "invalid_snippet_segment"
  | "invalid_serialization_payload";

export type EvidenceValidationStatus = "valid" | "invalid" | "stale" | "partial";

export type EvidenceTier = "primary" | "supporting" | "conflict";

export type EvidenceSnippetKind = "mainline" | "branch" | "exception";

export type AnchorStrategy =
  | "line_anchor"
  | "function_signature_match"
  | "nearest_in_file_location";

export interface CitationAvailability {
  available: boolean;
  reason?: string;
}

export interface CitationLinkSet {
  line_start: number;
  line_end: number;
  anchor: string;
  anchor_strategy: AnchorStrategy;
  anchor_tier_used: 1 | 2 | 3;
  sha_url: string | null;
  default_branch_url: string | null;
  sha_status: CitationAvailability;
  default_branch_status: CitationAvailability;
}

export interface SnippetRecord {
  snippet_id: string;
  label: string;
  kind: EvidenceSnippetKind;
  path: string;
  function_signature: string | null;
  line_start: number;
  line_end: number;
  content: string;
  segment_index: number;
  segment_total: number;
  omitted_ranges: Array<{ start: number; end: number }>;
  language: string | null;
}

export interface EvidenceRecord {
  evidence_id: string;
  conclusion_id: string;
  key: string;
  phase_id: "07";
  tier: EvidenceTier;
  path: string;
  module_id: string;
  generated_at: string;
  citations: CitationLinkSet[];
  snippets: SnippetRecord[];
  validation_status: EvidenceValidationStatus;
  validation_reasons: EvidenceValidationReasonCode[];
}

export interface EvidenceValidationResult {
  valid: boolean;
  status: EvidenceValidationStatus;
  reasons: EvidenceValidationReasonCode[];
}

export interface ValidateEvidenceInput {
  key_conclusions: Array<{ conclusion_id: string; key: string }>;
  evidence_records: EvidenceRecord[];
  require_default_branch_link?: boolean;
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function hasLineAnchor(anchor: string): boolean {
  return /^#L\d+(-L\d+)?$/.test(anchor);
}

function hasFunctionSnippet(snippets: SnippetRecord[]): boolean {
  return snippets.some((snippet) => {
    const hasFunctionContext = Boolean(snippet.function_signature && snippet.function_signature.trim().length > 0);
    return hasFunctionContext && snippet.line_start > 0 && snippet.line_end >= snippet.line_start;
  });
}

function validateSnippetSegments(snippets: SnippetRecord[]): boolean {
  for (const snippet of snippets) {
    if (snippet.segment_index < 1 || snippet.segment_total < 1) {
      return false;
    }
    if (snippet.segment_index > snippet.segment_total) {
      return false;
    }
    if (!snippet.snippet_id || !snippet.label) {
      return false;
    }
  }
  return true;
}

function hasDeterministicDualLinkOrdering(citations: CitationLinkSet[]): boolean {
  return citations.every((citation) => {
    if (citation.sha_url && citation.default_branch_url) {
      return citation.sha_status.available && citation.default_branch_status.available;
    }
    if (citation.sha_url && !citation.default_branch_url) {
      return citation.sha_status.available;
    }
    if (!citation.sha_url && citation.default_branch_url) {
      return citation.default_branch_status.available;
    }
    return true;
  });
}

export function validateEvidenceRecord(
  record: EvidenceRecord,
  require_default_branch_link: boolean = false
): EvidenceValidationResult {
  const reasons: EvidenceValidationReasonCode[] = [];

  if (!record.evidence_id) {
    reasons.push("invalid_evidence_id");
  }
  if (!record.conclusion_id) {
    reasons.push("invalid_conclusion_id");
  }
  if (!isIsoTimestamp(record.generated_at)) {
    reasons.push("invalid_serialization_payload");
  }
  if (record.citations.length === 0) {
    reasons.push("missing_citation_links");
  }

  const hasAnchor = record.citations.every((citation) => hasLineAnchor(citation.anchor));
  if (!hasAnchor) {
    reasons.push("missing_line_anchor");
  }

  const hasShaLink = record.citations.some((citation) => Boolean(citation.sha_url));
  if (!hasShaLink) {
    reasons.push("missing_sha_link");
  }

  if (require_default_branch_link) {
    const hasDefault = record.citations.some((citation) => Boolean(citation.default_branch_url));
    if (!hasDefault) {
      reasons.push("missing_default_branch_link");
    }
  }

  if (!hasFunctionSnippet(record.snippets)) {
    reasons.push("missing_function_level_snippet");
  }
  if (!validateSnippetSegments(record.snippets)) {
    reasons.push("invalid_snippet_segment");
  }
  if (!hasDeterministicDualLinkOrdering(record.citations)) {
    reasons.push("invalid_dual_link_order");
  }

  if (reasons.length === 0) {
    return {
      valid: true,
      status: "valid",
      reasons: ["ok"]
    };
  }

  return {
    valid: false,
    status: "invalid",
    reasons
  };
}

export function validateEvidenceForConclusions(input: ValidateEvidenceInput): EvidenceValidationResult {
  const reasons: EvidenceValidationReasonCode[] = [];
  const byConclusion = new Map<string, EvidenceRecord[]>();

  for (const record of input.evidence_records) {
    const records = byConclusion.get(record.conclusion_id) ?? [];
    records.push(record);
    byConclusion.set(record.conclusion_id, records);
  }

  for (const conclusion of input.key_conclusions) {
    const records = byConclusion.get(conclusion.conclusion_id) ?? [];
    if (records.length === 0) {
      reasons.push("missing_evidence_for_conclusion");
      continue;
    }
    for (const record of records) {
      const result = validateEvidenceRecord(record, input.require_default_branch_link ?? false);
      if (!result.valid) {
        reasons.push(...result.reasons);
      }
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));
  if (uniqueReasons.length === 0) {
    return {
      valid: true,
      status: "valid",
      reasons: ["ok"]
    };
  }

  return {
    valid: false,
    status: "invalid",
    reasons: uniqueReasons
  };
}
