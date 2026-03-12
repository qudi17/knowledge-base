from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Case:
    id: str
    question: str
    db_id: str
    gold_result: dict[str, Any] | None = None
    tags: list[str] = field(default_factory=list)
    behavior_expectation: dict[str, Any] = field(default_factory=dict)
    expected_retrieval: dict[str, list[str]] = field(default_factory=dict)


@dataclass
class RetrievalRecord:
    status: str
    retrieved_items: list[dict[str, Any]] = field(default_factory=list)
    expected_items: list[str] = field(default_factory=list)
    hit: bool = False
    recall: float = 0.0
    notes: list[str] = field(default_factory=list)


@dataclass
class GenerationRecord:
    status: str
    generated_sql: str | None
    final_answer: str
    uses_retrieved_context_correctly: bool | None = None
    notes: list[str] = field(default_factory=list)


@dataclass
class ExecutionRecord:
    sql_executable: bool
    result_match: bool
    error: str | None = None


@dataclass
class JudgementRecord:
    primary_failure_stage: str | None = None
    primary_failure_type: str | None = None
    secondary_failure_types: list[str] = field(default_factory=list)


@dataclass
class RunRecord:
    case_id: str
    question: str
    latency_ms: int
    status: str
    retrieval: RetrievalRecord
    generation: GenerationRecord
    execution: ExecutionRecord
    judgement: JudgementRecord

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
