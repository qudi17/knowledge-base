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


@dataclass
class RunRecord:
    case_id: str
    question: str
    generated_sql: str | None
    final_answer: str
    latency_ms: int
    status: str
    sql_executable: bool
    result_match: bool
    behavior_pass: bool
    primary_failure_type: str | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
