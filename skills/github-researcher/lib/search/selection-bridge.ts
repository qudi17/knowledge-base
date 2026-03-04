import { runRepositoryPreflight, type PreflightOptions } from "../intake/preflight";
import { runWithReliability, type ReliabilityRunInput, type ReliabilityRunResult } from "../reliability/orchestrator";
import type { IntakeFailure, IntakeSuccess } from "../intake/types";
import type { SearchContextMetadata } from "../reliability/types";
import { attachSearchContext, buildSearchContext } from "./run-context";
import type { SearchResultItem, SearchSortMode } from "./types";

const FULL_NAME_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export interface SelectionLaunchInput {
  run_id: string;
  query_text: string;
  sort_mode: SearchSortMode;
  page: number;
  result_rank: number;
  selected: Pick<SearchResultItem, "full_name" | "html_url" | "stars" | "updated_at">;
}

export interface SelectionLaunchReady {
  ok: true;
  run_id: string;
  repository_input: string;
  search_context: SearchContextMetadata;
}

export interface SelectionLaunchInvalid {
  ok: false;
  status: "invalid_selection";
  message: string;
}

export type SelectionLaunchPreparation = SelectionLaunchReady | SelectionLaunchInvalid;

export interface LaunchExecution<TInput extends Record<string, unknown>> {
  input: TInput;
  input_fingerprint: string;
  stages: ReliabilityRunInput<TInput>["stages"];
  now_ms?: () => number;
}

export interface ConfirmAndLaunchInput<TInput extends Record<string, unknown>> extends SelectionLaunchInput {
  confirmed: boolean;
  preflight_options?: PreflightOptions;
  launch?: LaunchExecution<TInput>;
  preflight_runner?: typeof runRepositoryPreflight;
  reliability_runner?: typeof runWithReliability<TInput & { search_context: SearchContextMetadata }>;
}

export type SelectionLaunchResult<TInput extends Record<string, unknown>> =
  | {
      ok: false;
      status: "rejected";
      message: string;
      search_context: SearchContextMetadata;
    }
  | {
      ok: false;
      status: "preflight_failed";
      error: IntakeFailure;
      search_context: SearchContextMetadata;
    }
  | {
      ok: true;
      status: "launched";
      preflight: IntakeSuccess;
      run?: ReliabilityRunResult;
      search_context: SearchContextMetadata;
      launch_input?: TInput & { search_context: SearchContextMetadata };
    };

export function prepareSelectionLaunch(input: SelectionLaunchInput): SelectionLaunchPreparation {
  if (!FULL_NAME_PATTERN.test(input.selected.full_name)) {
    return {
      ok: false,
      status: "invalid_selection",
      message: "Selected repository full_name must match owner/repo."
    };
  }

  const search_context = buildSearchContext({
    query_text: input.query_text,
    sort_mode: input.sort_mode,
    page: input.page,
    result_rank: input.result_rank,
    selected: input.selected
  });

  return {
    ok: true,
    run_id: input.run_id,
    repository_input: `https://github.com/${input.selected.full_name}`,
    search_context
  };
}

export async function confirmAndLaunchFromSelection<TInput extends Record<string, unknown>>(
  input: ConfirmAndLaunchInput<TInput>
): Promise<SelectionLaunchResult<TInput>> {
  const prepared = prepareSelectionLaunch(input);
  if (!prepared.ok) {
    return {
      ok: false,
      status: "rejected",
      message: prepared.message,
      search_context: buildSearchContext({
        query_text: input.query_text,
        sort_mode: input.sort_mode,
        page: input.page,
        result_rank: input.result_rank,
        selected: input.selected
      })
    };
  }

  if (!input.confirmed) {
    return {
      ok: false,
      status: "rejected",
      message: "Launch rejected: explicit confirmation was not provided.",
      search_context: prepared.search_context
    };
  }

  const preflightRunner = input.preflight_runner ?? runRepositoryPreflight;
  const preflightResult = await preflightRunner(prepared.repository_input, input.preflight_options);

  if (!preflightResult.ok) {
    return {
      ok: false,
      status: "preflight_failed",
      error: preflightResult,
      search_context: prepared.search_context
    };
  }

  if (!input.launch) {
    return {
      ok: true,
      status: "launched",
      preflight: preflightResult,
      search_context: prepared.search_context
    };
  }

  const launch_input = attachSearchContext(input.launch.input, prepared.search_context);
  const reliabilityRunner =
    input.reliability_runner ??
    ((runWithReliability as unknown) as typeof runWithReliability<TInput & { search_context: SearchContextMetadata }>);

  const run = await reliabilityRunner({
    run_id: prepared.run_id,
    input: launch_input,
    input_fingerprint: input.launch.input_fingerprint,
    stages: input.launch.stages as ReliabilityRunInput<TInput & { search_context: SearchContextMetadata }>["stages"],
    now_ms: input.launch.now_ms,
    search_context: prepared.search_context
  });

  return {
    ok: true,
    status: "launched",
    preflight: preflightResult,
    run,
    search_context: prepared.search_context,
    launch_input
  };
}
