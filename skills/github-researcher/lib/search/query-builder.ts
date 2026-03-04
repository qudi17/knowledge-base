import type { NormalizedSearchOptions, SearchRequest } from "./types";

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

export function normalizeSearchOptions(input: SearchRequest): NormalizedSearchOptions {
  return {
    query: collapseWhitespace(input.query),
    sort: input.sort ?? "stars",
    order: input.order ?? "desc",
    page: normalizePositiveInt(input.page, 1),
    per_page: normalizePositiveInt(input.per_page, 20),
    include_forks: input.include_forks ?? false,
    include_archived: input.include_archived ?? false,
    language: input.language ? collapseWhitespace(input.language) : undefined
  };
}

export function buildSearchQuery(options: NormalizedSearchOptions): string {
  const parts: string[] = [options.query];

  if (options.language) {
    parts.push(`language:${options.language}`);
  }

  if (!options.include_forks) {
    parts.push("fork:false");
  }

  if (!options.include_archived) {
    parts.push("archived:false");
  }

  return parts.join(" ").trim();
}
