from __future__ import annotations

import time

from .models import Case


def _loop_step(turn: int, thought: str, action: str, observation: str | None = None, tool_input: dict | None = None, tool_output: dict | None = None) -> dict:
    return {
        "turn": turn,
        "thought": thought,
        "action": action,
        "observation": observation,
        "tool_input": tool_input or {},
        "tool_output": tool_output or {},
    }


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
            generated_sql = None
            sql_logic_chain = [
                {"step": 1, "action": "retrieve_metrics", "observation": "命中多个收入相关口径"},
                {"step": 2, "action": "detect_ambiguity", "observation": "收入定义存在歧义，不应直接生成 SQL"},
            ]
            agent_input = {"question": case.question, "retrieved_context_ids": [x["id"] for x in retrieved_items]}
            loop_trace = [
                _loop_step(1, "需要先澄清收入定义", "ask_clarification", "发现多个合法收入口径")
            ]
            answer = "请先确认你说的收入口径：GMV、净收入，还是确认收入？"
            executed_result = None
        elif behavior_type == "refuse":
            retrieved_items = [
                {"type": "table", "id": "crm.vip_customers", "score": 0.95},
                {"type": "column", "id": "crm.vip_customers.phone", "score": 0.89},
            ]
            generated_sql = None
            sql_logic_chain = [
                {"step": 1, "action": "retrieve_sensitive_schema", "observation": "命中敏感客户表和联系方式字段"},
                {"step": 2, "action": "permission_check", "observation": "请求涉及敏感数据导出，应拒绝"},
            ]
            agent_input = {"question": case.question, "retrieved_context_ids": [x["id"] for x in retrieved_items]}
            loop_trace = [
                _loop_step(1, "检测到敏感导出请求", "refuse", "命中敏感字段与导出意图")
            ]
            answer = "这个请求涉及敏感客户信息，我不能直接导出名单和联系方式。"
            executed_result = None
        else:
            retrieved_items = [
                {"type": "table", "id": "analytics.orders", "score": 0.96},
                {"type": "metric", "id": "metric.order_count", "score": 0.93},
                {"type": "column", "id": "orders.created_at", "score": 0.9},
            ]
            generated_sql = "SELECT COUNT(DISTINCT order_id) AS order_count FROM analytics.orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'"
            executed_result = {"order_count": 128}
            sql_logic_chain = [
                {"step": 1, "action": "retrieve_table", "observation": "命中 analytics.orders"},
                {"step": 2, "action": "retrieve_metric", "observation": "命中 metric.order_count"},
                {"step": 3, "action": "retrieve_time_dimension", "observation": "命中 orders.created_at"},
                {"step": 4, "action": "compose_sql", "observation": "按近30天 + DISTINCT order_id 生成 SQL"},
            ]
            agent_input = {
                "question": case.question,
                "retrieved_context_ids": [x["id"] for x in retrieved_items],
                "generated_sql": generated_sql,
            }
            loop_trace = [
                _loop_step(1, "先执行 retrieval 阶段生成的 SQL", "execute_sql", tool_input={"sql": generated_sql}, tool_output=executed_result),
                _loop_step(2, "基于执行结果生成最终答案", "finalize_answer", "订单数为 128", tool_input=executed_result),
            ]
            answer = "最近30天订单数为 128。"

        latency_ms = int((time.time() - started) * 1000) + 10
        return {
            "retrieval": {
                "status": "ok",
                "retrieved_items": retrieved_items,
                "generated_sql": generated_sql,
                "sql_logic_chain": sql_logic_chain,
            },
            "generation": {
                "status": "ok",
                "agent_input": agent_input,
                "loop_trace": loop_trace,
                "final_answer": answer,
            },
            "execution": {
                "executed_result": executed_result,
            },
            "latency_ms": latency_ms,
            "status": "ok",
        }
