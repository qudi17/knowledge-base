import { normalizeSearchOptions } from "./query-builder";
import { searchGitHubRepositories, type SearchClientOptions } from "./github-search-client";
import type { SearchRequest, SearchResult } from "./types";

function noResultSuggestions(): string[] {
  return [
    "Broaden keywords (remove very specific terms).",
    "Try an alternate keyword or remove quotes.",
    "Temporarily include forks to widen candidates."
  ];
}

export async function searchRepositories(
  request: SearchRequest,
  options: SearchClientOptions = {}
): Promise<SearchResult> {
  const normalized = normalizeSearchOptions(request);
  const result = await searchGitHubRepositories(normalized, options);

  if (!result.ok) {
    return result;
  }

  let filteredItems = result.items;

  if (!normalized.include_forks) {
    filteredItems = filteredItems.filter((item) => !item.fork);
  }

  if (!normalized.include_archived) {
    filteredItems = filteredItems.filter((item) => !item.archived);
  }

  return {
    ...result,
    total_count: filteredItems.length,
    items: filteredItems,
    suggestions: filteredItems.length === 0 ? noResultSuggestions() : undefined
  };
}
