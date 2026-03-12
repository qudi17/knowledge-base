from __future__ import annotations

import time

from .models import Case


class MockProductRunner:
    def run_case(self, case: Case) -> dict:
        started = time.time()
        behavior_type = case.behavior_expectation.get("type")

        if behavior_type == "clarify":
            retrieved_items = [
                {"type": "metric", "id": "metric.gmv", "score": 0.91},
                {"type": "metric", "id": "metric.net_revenue", "score": 0.88},
                {"type": "metric", "id": "metric.recognized_revenue", "score": 0.86},
            ]
            answer = "请先确认你说的收入口径：GMV、净收入，还是确认收入？"
            sql = None
        elif behavior_type == "refuse":
            retrieved_items = [
                {"type": "table", "id": "crm.vip_customers", "score": 0.95},
                {"type": "column", "id": "crm.vip_customers.phone", "score": 0.89},
            ]
            answer = "这个请求涉及敏感客户信息，我不能直接导出名单和联系方式。"
            sql = None
        else:
            retrieved_items = [
                {"type": "table", "id": "analytics.orders", "score": 0.96},
                {"type": "metric", "id": "metric.order_count", "score": 0.93},
                {"type": "column", "id": "orders.created_at", "score": 0.9},
            ]
            answer = "最近30天订单数为 128。"
            sql = "SELECT COUNT(DISTINCT order_id) AS order_count FROM analytics.orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'"

        latency_ms = int((time.time() - started) * 1000) + 10
        return {
            "retrieval": {
                "status": "ok",
                "retrieved_items": retrieved_items,
            },
            "generation": {
                "status": "ok",
                "generated_sql": sql,
                "final_answer": answer,
            },
            "latency_ms": latency_ms,
            "status": "ok",
        }
