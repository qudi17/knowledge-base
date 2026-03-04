import { describe, expect, it } from "vitest";

import {
  reconstructCoreWorkflows,
  validateCoreWorkflow
} from "../../skills/github-researcher/lib/analysis/core/workflow-reconstruction";

describe("workflow reconstruction", () => {
  it("accepts cross-module workflows with mainline continuity", () => {
    const workflow = validateCoreWorkflow({
      workflow_id: "wf-1",
      nodes: [
        { module_id: "entry", function_name: "main", kind: "mainline" },
        { module_id: "core", function_name: "execute", kind: "mainline" }
      ],
      module_count: 0,
      accepted: false
    });

    expect(workflow.accepted).toBe(true);
    expect(workflow.module_count).toBe(2);
  });

  it("rejects workflows that do not cross modules or lose mainline continuity", () => {
    const singleModule = validateCoreWorkflow({
      workflow_id: "wf-single",
      nodes: [
        { module_id: "core", function_name: "a", kind: "mainline" },
        { module_id: "core", function_name: "b", kind: "mainline" }
      ],
      module_count: 0,
      accepted: false
    });
    expect(singleModule.accepted).toBe(false);
    expect(singleModule.rejection_reason).toContain("at least 2 modules");

    const weakMainline = validateCoreWorkflow({
      workflow_id: "wf-mainline",
      nodes: [
        { module_id: "entry", function_name: "parse", kind: "mainline" },
        { module_id: "core", function_name: "handle_error", kind: "exception" }
      ],
      module_count: 0,
      accepted: false
    });
    expect(weakMainline.accepted).toBe(false);
    expect(weakMainline.rejection_reason).toContain("mainline continuity");
  });

  it("keeps bounded high-value exception nodes and reports accepted count", () => {
    const result = reconstructCoreWorkflows(
      [
        {
          workflow_id: "wf-ok",
          nodes: [
            { module_id: "entry", function_name: "main", kind: "mainline" },
            { module_id: "core", function_name: "process", kind: "mainline" },
            { module_id: "core", function_name: "retry_request", kind: "exception" },
            { module_id: "support", function_name: "emit", kind: "mainline" },
            { module_id: "support", function_name: "error_fallback", kind: "exception" },
            { module_id: "support", function_name: "low_value_branch", kind: "exception" }
          ]
        },
        {
          workflow_id: "wf-bad",
          nodes: [{ module_id: "entry", function_name: "main", kind: "mainline" }]
        }
      ],
      1,
      2
    );

    expect(result.accepted_count).toBe(1);
    const kept = result.workflows.find((item) => item.workflow_id === "wf-ok");
    expect(kept?.accepted).toBe(true);
    expect(kept?.nodes.filter((node) => node.kind === "exception").length).toBe(2);
  });
});
