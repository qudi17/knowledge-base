from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from .models import RunRecord


def build_summary(records: list[RunRecord]) -> dict:
    total = len(records) or 1
    failures = Counter(r.primary_failure_type for r in records if r.primary_failure_type)
    latencies = sorted(r.latency_ms for r in records)
    return {
        "case_count": len(records),
        "success_rate": round(sum(1 for r in records if r.result_match and r.behavior_pass) / total, 4),
        "sql_exec_rate": round(sum(1 for r in records if r.sql_executable) / total, 4),
        "result_match_rate": round(sum(1 for r in records if r.result_match) / total, 4),
        "behavior_pass_rate": round(sum(1 for r in records if r.behavior_pass) / total, 4),
        "p50_latency_ms": latencies[len(latencies) // 2] if latencies else 0,
        "p95_latency_ms": latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))] if latencies else 0,
        "failure_count_by_type": dict(failures),
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
        f"- sql_exec_rate: {summary['sql_exec_rate']}",
        f"- result_match_rate: {summary['result_match_rate']}",
        f"- behavior_pass_rate: {summary['behavior_pass_rate']}",
        f"- p50_latency_ms: {summary['p50_latency_ms']}",
        f"- p95_latency_ms: {summary['p95_latency_ms']}",
        "",
        "## Failure Breakdown",
    ]
    if summary["failure_count_by_type"]:
        for k, v in summary["failure_count_by_type"].items():
            lines.append(f"- {k}: {v}")
    else:
        lines.append("- none")

    lines.append("")
    lines.append("## Baseline Diff")
    if baseline:
        for key in ["success_rate", "sql_exec_rate", "result_match_rate", "behavior_pass_rate"]:
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
