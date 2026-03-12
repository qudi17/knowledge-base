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
    return RetrievalRecord(
        status=retrieval_raw.get("status", "unknown"),
        retrieved_items=retrieved_items,
        expected_items=expected_items,
        hit=recall == 1.0,
        recall=round(recall, 4),
        notes=notes,
    )


def _evaluate_generation(case: Case, run_result: dict, retrieval: RetrievalRecord) -> GenerationRecord:
    generation_raw = run_result.get("generation", {})
    answer = generation_raw.get("final_answer", "")
    behavior = case.behavior_expectation.get("type")
    notes: list[str] = []

    if behavior == "clarify":
        uses_context = "确认" in answer or "口径" in answer
        if not uses_context:
            notes.append("generation 未正确进行澄清")
    elif behavior == "refuse":
        uses_context = any(token in answer for token in ["不能", "敏感", "权限"])
        if not uses_context:
            notes.append("generation 未正确拒答")
    else:
        uses_context = retrieval.hit
        if not uses_context:
            notes.append("generation 建立在不完整 retrieval 上")

    return GenerationRecord(
        status=generation_raw.get("status", "unknown"),
        generated_sql=generation_raw.get("generated_sql"),
        final_answer=answer,
        uses_retrieved_context_correctly=uses_context,
        notes=notes,
    )


def _evaluate_execution(case: Case, generation: GenerationRecord) -> ExecutionRecord:
    behavior = case.behavior_expectation.get("type")
    sql_executable = generation.generated_sql is not None or behavior in {"clarify", "refuse"}
    result_match = False
    error = None

    if behavior == "clarify":
        result_match = generation.uses_retrieved_context_correctly is True
    elif behavior == "refuse":
        result_match = generation.uses_retrieved_context_correctly is True
    else:
        expected = case.gold_result or {}
        if "order_count" in expected:
            result_match = str(expected["order_count"]) in generation.final_answer
        if generation.generated_sql is None:
            sql_executable = False
            error = "missing_sql"

    return ExecutionRecord(
        sql_executable=sql_executable,
        result_match=result_match,
        error=error,
    )


def _judge_failure(retrieval: RetrievalRecord, generation: GenerationRecord, execution: ExecutionRecord) -> JudgementRecord:
    if retrieval.recall < 1.0:
        return JudgementRecord(
            primary_failure_stage="retrieval",
            primary_failure_type="missing_required_context",
        )
    if generation.uses_retrieved_context_correctly is False:
        return JudgementRecord(
            primary_failure_stage="generation",
            primary_failure_type="misused_retrieved_context",
        )
    if not execution.sql_executable:
        return JudgementRecord(
            primary_failure_stage="generation",
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
    execution = _evaluate_execution(case, generation)
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
