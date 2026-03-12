# Agent 可观测性与评测框架（v1）

> 目标：建立一套可以支撑 agent 调试、回归和上线评估的最小观测与评测框架。

---

## 1. 结论

agent 落地最常见的问题不是“能力不够”，而是：

- 不知道它为什么这么做
- 不知道错在哪一步
- 不知道新版本是变好还是变坏
- 不知道风险是否在扩大

因此，agent 系统必须默认具备：

1. **run record**
2. **loop trace**
3. **tool trace**
4. **failure taxonomy**
5. **regression baseline**

---

## 2. 最小 run record

推荐每次运行至少记录：

- `run_id`
- `case_id`
- `user_input`
- `normalized_input`
- `agent_input`
- `plan`
- `tool_calls`
- `tool_results`
- `loop_trace`
- `final_answer`
- `status`
- `latency_ms`
- `token_usage`
- `judgement`

如果是高风险场景，再加：
- `permission_decision`
- `safety_flags`
- `human_handoff`

---

## 3. loop trace 最小 schema

每一步建议统一记录：

- `turn`
- `thought`
- `action`
- `observation`
- `tool_input`
- `tool_output`
- `decision_reason`
- `status`

其中最关键的是：
- 当前为什么做这个动作
- 这个动作拿到了什么结果
- 下一步为什么继续或停止

---

## 4. tool trace 要求

每次工具调用建议记录：

- `tool_name`
- `tool_version`
- `input`
- `output`
- `latency_ms`
- `error`
- `retry_count`

否则会出现：
- 同一个 agent 行为变了，但不知道是不是工具变了
- 工具降级了，但被误以为是模型退化

---

## 5. failure taxonomy

建议至少分 4 层：

### F1. Input / Routing
- 输入规范化错误
- 路由错误
- 计划错误

### F2. Retrieval / Context
- 没拿到关键上下文
- 上下文噪声过大
- 上下文冲突未处理

### F3. Tool / Execution
- 工具选择错误
- 工具执行失败
- 重试策略错误
- 输出解析错误

### F4. Synthesis / Answer
- 最终答案与中间结果不一致
- narrative 误导
- 应澄清未澄清
- 应拒答未拒答

建议每次失败至少落：
- 一个 `primary_failure_stage`
- 一个 `primary_failure_type`
- 零到多个 `secondary_failure_types`

---

## 6. 关键指标

### 稳定性指标
- success_rate
- completion_rate
- timeout_rate
- retry_rate

### 诊断指标
- failure_by_stage
- failure_by_type
- tool_error_rate
- loop_error_rate

### 一致性指标
- final_answer_consistency_rate
- plan_to_action_consistency_rate
- tool_result_to_answer_consistency_rate

### 效率指标
- p50_latency_ms
- p95_latency_ms
- avg_tool_calls
- avg_loop_turns
- token_per_success

### 风险指标
- unsafe_action_rate
- permission_violation_rate
- clarification_miss_rate
- hallucination_rate

---

## 7. 回归评测

每次以下变更，都建议跑回归：

- 模型版本变化
- system prompt 变化
- planner 逻辑变化
- tool contract 变化
- retrieval 策略变化
- guardrail 变化

建议输出：
- 总体指标 diff
- failure_by_stage diff
- failure_by_type diff
- 新增坏例
- 修复好例

---

## 8. 推荐评测方法

### 8.1 case-based regression
固定样例集，观察版本前后退化。

### 8.2 failure injection
故意注入：
- 缺失上下文
- tool 错误
- loop trace 缺字段
- final answer 不一致

验证观测系统是否能正确归因。

### 8.3 replay-based debugging
对历史 run record 重放 evaluator，确认：
- 是模型问题
- 是工具问题
- 还是评测逻辑变化

---

## 9. 上线前最低要求

一个准备进生产的 agent，至少应该做到：

- 每次运行有完整 run record
- 每步 loop 可回放
- 关键 tool 调用可追踪
- 失败可按 stage/type 归类
- 有基线集可跑回归
- 高风险问题有 guardrail 与人工兜底

如果这些都没有，问题通常不是“agent 不够强”，而是“系统还没准备好上线”。

---

## 10. 一句话建议

agent 的第一优先级不是更强推理，而是：

> **先让它可见、可测、可控。**

只有做到这一点，后续的 planner、memory、multi-agent 才有稳定演进的基础。
