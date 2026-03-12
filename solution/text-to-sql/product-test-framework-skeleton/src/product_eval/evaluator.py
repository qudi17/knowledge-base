from __future__ import annotations

from .models import (
    Case,
    ExecutionRecord,
    GenerationRecord,
    JudgementRecord,
    RetrievalRecord,
    RunRecord,
)


def _evaluate_retrieval(case: Case, run_result: dict) -> RetrievalRecord:
    retrieval_raw = run_result.get("retrieval", {})
    retrieved_items = retrieval_raw.get("retrieved_items", [])
    expected_items = case.expected_retrieval.get("must_have", [])
    retrieved_ids = {item.get("id") for item in retrieved_items}
    hit_count = sum(1 for item in expected_items if item in retrieved_ids)
    recall = hit_count / len(expected_items) if expected_items else 1.0
    notes: list[str] = []
    if recall < 1.0:
        notes.append("retrieval 未召回全部 must_have 项")
    if retrieval_raw.get("generated_sql"):
        notes.append("SQL 生成已归属 retrieval 阶段")
    return RetrievalRecord(
        status=retrieval_raw.get("status", "unknown"),
        retrieved_items=retrieved_items,
        expected_items=expected_items,
        hit=recall == 1.0,
        recall=round(recall, 4),
        generated_sql=retrieval_raw.get("generated_sql"),
        sql_logic_chain=retrieval_raw.get("sql_logic_chain", []),
        notes=notes,
    )


def _check_loop_trace_schema(loop_trace: list[dict]) -> tuple[bool, list[str]]:
    required = {"turn", "thought", "action", "observation", "tool_input", "tool_output"}
    notes: list[str] = []
    ok = True
    for idx, step in enumerate(loop_trace, start=1):
        missing = required - set(step.keys())
        if missing:
            ok = False
            notes.append(f"loop_trace step {idx} 缺少字段: {sorted(missing)}")
    return ok, notes


def _check_final_answer_consistency(case: Case, answer: str, executed_result: dict | None) -> bool | None:
    behavior = case.behavior_expectation.get("type")
    if behavior in {"clarify", "refuse"}:
        return True
    if not executed_result:
        return None
    if "order_count" in executed_result:
        return str(executed_result["order_count"]) in answer
    return None


def _evaluate_generation(case: Case, run_result: dict, retrieval: RetrievalRecord) -> GenerationRecord:
    generation_raw = run_result.get("generation", {})
    execution_raw = run_result.get("execution", {})
    answer = generation_raw.get("final_answer", "")
    behavior = case.behavior_expectation.get("type")
    notes: list[str] = []

    loop_trace = generation_raw.get("loop_trace", [])
    loop_ok, loop_notes = _check_loop_trace_schema(loop_trace)
    notes.extend(loop_notes)

    if behavior == "clarify":
        uses_context = "确认" in answer or "口径" in answer
        if not uses_context:
            notes.append("generation 未正确进行澄清")
    elif behavior == "refuse":
        uses_context = any(token in answer for token in ["不能", "敏感", "权限"])
        if not uses_context:
            notes.append("generation 未正确拒答")
    else:
        uses_context = retrieval.hit and retrieval.generated_sql is not None and loop_ok
        if not uses_context:
            notes.append("generation 建立在不完整 retrieval / SQL 规划上，或 loop_trace schema 不完整")

    final_answer_consistency = _check_final_answer_consistency(case, answer, execution_raw.get("executed_result"))
    if final_answer_consistency is False:
        notes.append("final_answer 与执行结果不一致")

    return GenerationRecord(
        status=generation_raw.get("status", "unknown"),
        agent_input=generation_raw.get("agent_input", {}),
        loop_trace=loop_trace,
        final_answer=answer,
        uses_retrieved_context_correctly=uses_context,
        final_answer_consistency=final_answer_consistency,
        notes=notes,
    )


def _evaluate_execution(case: Case, retrieval: RetrievalRecord, generation: GenerationRecord, run_result: dict) -> ExecutionRecord:
    behavior = case.behavior_expectation.get("type")
    execution_raw = run_result.get("execution", {})
    executed_result = execution_raw.get("executed_result")
    sql_executable = retrieval.generated_sql is not None or behavior in {"clarify", "refuse"}
    result_match = False
    error = None

    if behavior == "clarify":
        result_match = generation.uses_retrieved_context_correctly is True
    elif behavior == "refuse":
        result_match = generation.uses_retrieved_context_correctly is True
    else:
        expected = case.gold_result or {}
        if "order_count" in expected and executed_result:
            result_match = executed_result.get("order_count") == expected.get("order_count")
        if retrieval.generated_sql is None:
            sql_executable = False
            error = "missing_sql_in_retrieval_stage"

    return ExecutionRecord(
        sql_executable=sql_executable,
        result_match=result_match,
        executed_result=executed_result,
        error=error,
    )


def _judge_failure(retrieval: RetrievalRecord, generation: GenerationRecord, execution: ExecutionRecord) -> JudgementRecord:
    if retrieval.recall < 1.0:
        return JudgementRecord(
            primary_failure_stage="retrieval",
            primary_failure_type="missing_required_context",
        )
    if not retrieval.generated_sql and execution.error == "missing_sql_in_retrieval_stage":
        return JudgementRecord(
            primary_failure_stage="retrieval",
            primary_failure_type="missing_sql_plan",
        )
    if any("loop_trace step" in note for note in generation.notes):
        return JudgementRecord(
            primary_failure_stage="generation",
            primary_failure_type="agent_loop_error",
        )
    if generation.final_answer_consistency is False:
        return JudgementRecord(
            primary_failure_stage="generation",
            primary_failure_type="final_answer_inconsistency",
        )
    if generation.uses_retrieved_context_correctly is False:
        return JudgementRecord(
            primary_failure_stage="generation",
            primary_failure_type="misused_retrieved_context",
        )
    if not execution.sql_executable:
        return JudgementRecord(
            primary_failure_stage="execution",
            primary_failure_type="sql_execution_error",
        )
    if not execution.result_match:
        return JudgementRecord(
            primary_failure_stage="generation",
            primary_failure_type="result_mismatch",
        )
    return JudgementRecord()


def evaluate_case(case: Case, run_result: dict) -> RunRecord:
    retrieval = _evaluate_retrieval(case, run_result)
    generation = _evaluate_generation(case, run_result, retrieval)
    execution = _evaluate_execution(case, retrieval, generation, run_result)
    judgement = _judge_failure(retrieval, generation, execution)

    return RunRecord(
        case_id=case.id,
        question=case.question,
        latency_ms=run_result.get("latency_ms", 0),
        status=run_result.get("status", "unknown"),
        retrieval=retrieval,
        generation=generation,
        execution=execution,
        judgement=judgement,
    )
