import type { ParseRepositoryTargetResult, ParsedRepositoryTarget } from "./types";

const SHORTHAND_PATTERN = /^@([^/\s]+)\/([^/\s]+)$/;

function buildParsedTarget(params: {
  inputRaw: string;
  inputType: "github_url" | "shorthand" | "local_path";
  host: string;
  owner: string;
  repo: string;
  sourceUrl?: string;
  sourcePath?: string;
}): ParsedRepositoryTarget {
  return {
    input_raw: params.inputRaw,
    input_type: params.inputType,
    host: params.host,
    owner: params.owner,
    repo: params.repo,
    source_url: params.sourceUrl,
    source_path: params.sourcePath
  };
}

function parseGithubUrl(inputRaw: string, value: string): ParseRepositoryTargetResult {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      message: "Repository input is not a valid URL or @owner/repo shorthand.",
      details: {
        input: inputRaw,
        suggestions: ["https://github.com/owner/repo", "@owner/repo"]
      }
    };
  }

  const host = url.host.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    return {
      ok: false,
      message: "Repository URL must include owner and repository name.",
      details: {
        input: inputRaw,
        host,
        suggestions: ["https://github.com/owner/repo"]
      }
    };
  }

  return {
    ok: true,
    value: buildParsedTarget({
      inputRaw,
      inputType: "github_url",
      host,
      owner: segments[0],
      repo: segments[1],
      sourceUrl: value,
      sourcePath: url.pathname
    })
  };
}

function parseLocalPath(inputRaw: string, value: string): ParseRepositoryTargetResult {
  return {
    ok: true,
    value: buildParsedTarget({
      inputRaw,
      inputType: "local_path",
      host: "local",
      owner: "",
      repo: "",
      sourcePath: value
    })
  };
}

export function parseRepositoryTarget(inputRaw: string): ParseRepositoryTargetResult {
  const value = inputRaw.trim();

  if (!value) {
    return {
      ok: false,
      message: "Repository input is required.",
      details: {
        input: inputRaw,
        suggestions: ["https://github.com/owner/repo", "@owner/repo"]
      }
    };
  }

  const shorthand = value.match(SHORTHAND_PATTERN);
  if (shorthand) {
    return {
      ok: true,
      value: buildParsedTarget({
        inputRaw,
        inputType: "shorthand",
        host: "github.com",
        owner: shorthand[1],
        repo: shorthand[2]
      })
    };
  }

  if (value.includes("://")) {
    return parseGithubUrl(inputRaw, value);
  }

  if (value.includes("github.com/")) {
    return {
      ok: false,
      message: "Repository input is not a valid URL or @owner/repo shorthand.",
      details: {
        input: inputRaw,
        suggestions: ["https://github.com/owner/repo", "@owner/repo"]
      }
    };
  }

  return parseLocalPath(inputRaw, value);
}
