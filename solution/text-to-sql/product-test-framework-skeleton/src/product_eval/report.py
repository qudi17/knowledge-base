from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from .models import RunRecord


def build_summary(records: list[RunRecord]) -> dict:
    total = len(records) or 1
    stage_failures = Counter(r.judgement.primary_failure_stage for r in records if r.judgement.primary_failure_stage)
    type_failures = Counter(r.judgement.primary_failure_type for r in records if r.judgement.primary_failure_type)
    latencies = sorted(r.latency_ms for r in records)
    consistency_values = [r.generation.final_answer_consistency for r in records if r.generation.final_answer_consistency is not None]
    consistency_rate = round(sum(1 for x in consistency_values if x) / len(consistency_values), 4) if consistency_values else None
    return {
        "case_count": len(records),
        "success_rate": round(sum(1 for r in records if r.judgement.primary_failure_stage is None) / total, 4),
        "retrieval_pass_rate": round(sum(1 for r in records if r.retrieval.hit) / total, 4),
        "generation_pass_rate": round(sum(1 for r in records if r.generation.uses_retrieved_context_correctly is not False) / total, 4),
        "sql_exec_rate": round(sum(1 for r in records if r.execution.sql_executable) / total, 4),
        "result_match_rate": round(sum(1 for r in records if r.execution.result_match) / total, 4),
        "final_answer_consistency_rate": consistency_rate,
        "p50_latency_ms": latencies[len(latencies) // 2] if latencies else 0,
        "p95_latency_ms": latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))] if latencies else 0,
        "failure_by_stage": dict(stage_failures),
        "failure_by_type": dict(type_failures),
    }


def load_baseline(path: str | Path) -> dict | None:
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def build_report(summary: dict, baseline: dict | None) -> str:
    lines = [
        "# Product Text-to-SQL Eval Report",
        "",
        "## Summary",
        f"- case_count: {summary['case_count']}",
        f"- success_rate: {summary['success_rate']}",
        f"- retrieval_pass_rate: {summary['retrieval_pass_rate']}",
        f"- generation_pass_rate: {summary['generation_pass_rate']}",
        f"- sql_exec_rate: {summary['sql_exec_rate']}",
        f"- result_match_rate: {summary['result_match_rate']}",
        f"- final_answer_consistency_rate: {summary['final_answer_consistency_rate']}",
        f"- p50_latency_ms: {summary['p50_latency_ms']}",
        f"- p95_latency_ms: {summary['p95_latency_ms']}",
        "",
        "## Failure By Stage",
    ]
    if summary["failure_by_stage"]:
        for k, v in summary["failure_by_stage"].items():
            lines.append(f"- {k}: {v}")
    else:
        lines.append("- none")

    lines.extend(["", "## Failure By Type"])
    if summary["failure_by_type"]:
        for k, v in summary["failure_by_type"].items():
            lines.append(f"- {k}: {v}")
    else:
        lines.append("- none")

    lines.append("")
    lines.append("## Baseline Diff")
    if baseline:
        for key in ["success_rate", "retrieval_pass_rate", "generation_pass_rate", "sql_exec_rate", "result_match_rate", "final_answer_consistency_rate"]:
            current = summary.get(key)
            base = baseline.get(key)
            if current is not None and base is not None:
                lines.append(f"- {key}: current={current}, baseline={base}, diff={round(current - base, 4)}")
    else:
        lines.append("- no baseline found")
    lines.append("")
    return "\n".join(lines)


def save_outputs(output_dir: str | Path, records: list[RunRecord], summary: dict, report_md: str) -> None:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "run_records.json").write_text(
        json.dumps([r.to_dict() for r in records], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "report.md").write_text(report_md, encoding="utf-8")
