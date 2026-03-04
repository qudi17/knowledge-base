import type { CoreWorkflow, WorkflowNode } from "./types";

export interface WorkflowTraceInput {
  workflow_id: string;
  nodes: WorkflowNode[];
}

export interface WorkflowReconstructionResult {
  workflows: CoreWorkflow[];
  accepted_count: number;
}

function isHighValueException(node: WorkflowNode): boolean {
  const name = (node.function_name ?? "").toLowerCase();
  return /retry|error|fail|fallback|recover/.test(name);
}

export function validateCoreWorkflow(workflow: CoreWorkflow): CoreWorkflow {
  const moduleCount = new Set(workflow.nodes.map((node) => node.module_id)).size;

  if (moduleCount < 2) {
    return {
      ...workflow,
      module_count: moduleCount,
      accepted: false,
      rejection_reason: "workflow must cross at least 2 modules"
    };
  }

  const mainlineCount = workflow.nodes.filter((node) => node.kind === "mainline").length;
  if (mainlineCount < 2) {
    return {
      ...workflow,
      module_count: moduleCount,
      accepted: false,
      rejection_reason: "workflow must include mainline continuity"
    };
  }

  return {
    ...workflow,
    module_count: moduleCount,
    accepted: true,
    rejection_reason: undefined
  };
}

export function reconstructCoreWorkflows(
  traces: WorkflowTraceInput[],
  minWorkflows = 1,
  _targetWorkflows = 2
): WorkflowReconstructionResult {
  const normalized = traces.map((trace) => {
    let exceptionCount = 0;
    const collapsedException = trace.nodes.filter((node, index) => {
      if (node.kind === "mainline") return true;
      if (index === 0) return false;
      if (trace.nodes[index - 1]?.kind !== "mainline") return false;
      if (!isHighValueException(node)) return false;
      if (exceptionCount >= 2) return false;
      exceptionCount += 1;
      return true;
    });

    return validateCoreWorkflow({
      workflow_id: trace.workflow_id,
      nodes: collapsedException,
      module_count: 0,
      accepted: false
    });
  });

  const accepted = normalized.filter((workflow) => workflow.accepted);

  if (accepted.length < minWorkflows && normalized.length > 0) {
    normalized[0] = {
      ...normalized[0],
      accepted: false,
      rejection_reason: normalized[0].rejection_reason ?? "minimum workflow target unmet"
    };
  }
  return {
    workflows: normalized,
    accepted_count: accepted.length
  };
}
