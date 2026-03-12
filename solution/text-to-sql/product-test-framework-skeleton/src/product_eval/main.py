from __future__ import annotations

import argparse
from pathlib import Path

from .case_loader import load_cases
from .evaluator import evaluate_case
from .report import build_report, build_summary, load_baseline, save_outputs
from .runner import MockProductRunner


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--baseline", default="configs/baseline.json")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    base_dir = Path(__file__).resolve().parents[2]
    cases_path = Path(args.cases)
    if not cases_path.is_absolute():
        cases_path = base_dir / cases_path

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = base_dir / output_path

    baseline_path = Path(args.baseline)
    if not baseline_path.is_absolute():
        baseline_path = base_dir / baseline_path

    cases = load_cases(cases_path)
    runner = MockProductRunner()
    records = []
    for case in cases:
        run_result = runner.run_case(case)
        records.append(evaluate_case(case, run_result))

    summary = build_summary(records)
    baseline = load_baseline(baseline_path)
    report_md = build_report(summary, baseline)
    save_outputs(output_path, records, summary, report_md)


if __name__ == "__main__":
    main()
