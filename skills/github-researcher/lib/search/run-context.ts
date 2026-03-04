import type { SearchContextMetadata } from "../reliability/types";
import type { SearchResultItem, SearchSortMode } from "./types";

export interface BuildSearchContextInput {
  query_text: string;
  sort_mode: SearchSortMode;
  page: number;
  result_rank: number;
  selected: Pick<SearchResultItem, "full_name" | "html_url" | "stars" | "updated_at">;
}

export function buildSearchContext(input: BuildSearchContextInput): SearchContextMetadata {
  return {
    query_text: input.query_text,
    sort_mode: input.sort_mode,
    page: input.page,
    result_rank: input.result_rank,
    selected_full_name: input.selected.full_name,
    selected_html_url: input.selected.html_url,
    selected_stars: input.selected.stars,
    selected_updated_at: input.selected.updated_at
  };
}

export function attachSearchContext<TInput extends Record<string, unknown>>(
  input: TInput,
  search_context: SearchContextMetadata
): TInput & { search_context: SearchContextMetadata } {
  return {
    ...input,
    search_context
  };
}
