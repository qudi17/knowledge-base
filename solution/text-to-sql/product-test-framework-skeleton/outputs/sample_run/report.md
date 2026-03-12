# Product Text-to-SQL Eval Report

## Summary
- case_count: 6
- success_rate: 0.5
- retrieval_pass_rate: 0.8333
- generation_pass_rate: 0.6667
- sql_exec_rate: 0.8333
- result_match_rate: 0.8333
- final_answer_consistency_rate: 0.8
- p50_latency_ms: 10
- p95_latency_ms: 10

## Failure By Stage
- retrieval: 1
- generation: 2

## Failure By Type
- missing_required_context: 1
- agent_loop_error: 1
- final_answer_inconsistency: 1

## Baseline Diff
- success_rate: current=0.5, baseline=0.66, diff=-0.16
- retrieval_pass_rate: current=0.8333, baseline=0.66, diff=0.1733
- generation_pass_rate: current=0.6667, baseline=1.0, diff=-0.3333
- sql_exec_rate: current=0.8333, baseline=1.0, diff=-0.1667
- result_match_rate: current=0.8333, baseline=0.33, diff=0.5033
- final_answer_consistency_rate: current=0.8, baseline=0.33, diff=0.47
