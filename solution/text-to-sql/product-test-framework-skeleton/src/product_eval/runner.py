from __future__ import annotations

import time

from .models import Case


class MockProductRunner:
    def run_case(self, case: Case) -> dict:
        started = time.time()

        if case.behavior_expectation.get("type") == "clarify":
            answer = "请先确认你说的收入口径：GMV、净收入，还是确认收入？"
            sql = None
        elif case.behavior_expectation.get("type") == "refuse":
            answer = "这个请求涉及敏感客户信息，我不能直接导出名单和联系方式。"
            sql = None
        else:
            answer = "最近30天订单数为 128。"
            sql = "SELECT COUNT(DISTINCT order_id) AS order_count FROM analytics.orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'"

        latency_ms = int((time.time() - started) * 1000) + 10
        return {
            "generated_sql": sql,
            "final_answer": answer,
            "latency_ms": latency_ms,
            "status": "ok",
        }
