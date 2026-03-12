# 面向产品的 Text-to-SQL 测试框架（v2）

> 目标：针对公司内部产品，而不是论文 benchmark，建设一套可持续回归、可定位退化、可支撑上线决策的 text-to-SQL 测试框架。

关联文档：
- [Text-to-SQL / Data Analyst Agent 方法论](./README.md)
- [真实业务 text-to-SQL agent 测试标准（v1）](./real-world-evaluation-standard-v1.md)
- [Benchmark 数据格式模板（v1）](./benchmark-schema-v1.md)
- [最小 Python Skeleton](./product-test-framework-skeleton/README.md)

---

## 1. 设计目标

和通用 benchmark 不同，产品测试框架重点回答 5 个问题：

1. **这个版本会不会退化？**
2. **哪类题退化了？**
3. **是 schema / join / metric / 时间语义 哪层出了问题？**
4. **高风险问题是否被正确澄清、拒答或限制返回？**
5. **延迟、执行成功率、错误率是否仍在可接受范围？**

---

## 2. 推荐总体架构

```text
case dataset
   ↓
product runner
   ↓
raw run records
   ↓
sql executor / result checker / behavior checker
   ↓
metrics aggregation
   ↓
summary + diff report
```

建议拆成 4 层：

### A. Case 协议层
描述单条测试题。

### B. Run 执行层
统一调用产品接口，拿回 SQL / answer / trace / latency。

### C. Eval 评测层
基于执行结果、golden result 和行为规则打分。

### D. Report 报告层
输出总体指标、tag 切片、失败样例、版本 diff。

---

## 3. Case 设计：不要只存 SQL

产品场景中，单题至少建议包含：

- `id`
- `question`
- `db_id` / `schema_id`
- `gold_sql`（可选）
- `gold_result`（推荐）
- `assertions`
- `tags`
- `behavior_expectation`
- `risk_level`
- `review_status`

其中最重要的是 3 类 case：

### 3.1 exact-sql case
适合基础 correctness。

特征：
- 有明确 gold SQL
- 结果可直接比对
- 适合单表、双表、基础聚合题

### 3.2 result-only case
适合真实业务问题。

特征：
- 不强制唯一 SQL
- 只要求结果正确
- 更适合复杂查询与多种等价 SQL

### 3.3 behavior case
适合产品治理。

特征：
- 核心不是 SQL，而是产品行为是否正确
- 例如：
  - 是否先澄清
  - 是否拒答敏感请求
  - 是否正确提示权限不足
  - 是否在空结果时给出合理说明

---

## 4. Runner 设计

Runner 只做一件事：

> 把标准化 case 输入产品，保存标准化 run record。

单次 run record 建议包含：

- `run_id`
- `case_id`
- `model_version`
- `prompt_version`
- `semantic_layer_version`
- `generated_sql`
- `final_answer`
- `tool_trace`
- `latency_ms`
- `status`
- `error`

### 4.1 统一输入/输出接口
建议产品 runner 抽象成：

```python
result = runner.run_case(case)
```

返回：

```python
{
  "generated_sql": "...",
  "final_answer": "...",
  "tool_trace": [],
  "latency_ms": 1200,
  "status": "ok"
}
```

### 4.2 Runner 只负责采集，不负责判分
这样后续更容易：
- 重跑 evaluator
- 新增指标
- 离线复盘旧结果

---

## 5. Evaluator 设计

建议把 evaluator 拆成 4 个子模块。

### 5.1 SQL 执行评测
输出：
- `sql_executable`
- `execution_error`

### 5.2 结果评测
输出：
- `result_match`
- `result_diff`

### 5.3 行为评测
输出：
- `clarification_ok`
- `safety_ok`
- `behavior_notes`

### 5.4 失败分类
输出：
- `primary_failure_type`
- `secondary_failure_types`

推荐 failure taxonomy：
- `schema_linking_error`
- `join_error`
- `metric_error`
- `time_semantics_error`
- `sql_execution_error`
- `result_mismatch`
- `clarification_error`
- `safety_error`
- `narrative_error`

---

## 6. 指标设计

第一版就够用的指标：

### 基础指标
- `case_count`
- `success_rate`
- `sql_exec_rate`
- `result_match_rate`
- `behavior_pass_rate`
- `p50_latency_ms`
- `p95_latency_ms`

### 安全与治理指标
- `clarification_required_pass_rate`
- `sensitive_request_block_rate`
- `unsafe_sql_rate`
- `permission_boundary_violation_rate`

### 诊断指标
- `failure_count_by_type`
- `pass_rate_by_tag`
- `result_match_rate_by_domain`

---

## 7. 报告设计

每次 run 最少输出 3 份结果：

### 7.1 raw run records
逐题原始结果，便于复盘。

### 7.2 summary.json
机器可读汇总指标。

### 7.3 report.md
人可读报告，包括：
- 总体指标
- 各 tag 切片
- 新增失败
- 修复题目
- 典型坏例

---

## 8. 推荐目录结构

```text
product-test-framework/
├── cases/
│   ├── bronze.jsonl
│   ├── silver.jsonl
│   └── gold.jsonl
├── runners/
├── evaluators/
├── reports/
├── outputs/
└── configs/
```

如果和知识库一起维护，推荐把 skeleton 放在：

```text
knowledge-base/solution/text-to-sql/product-test-framework-skeleton/
```

---

## 9. 第一版落地范围（建议）

先别做大而全，建议 v1 只覆盖：

### case
- 20 条 exact-sql case
- 20 条 result-only case
- 10 条 behavior case

### evaluator
- SQL 可执行
- 结果比对
- 澄清/拒答行为检查
- failure taxonomy 一级分类

### report
- summary JSON
- markdown 报告
- 和 baseline 的 diff

---

## 10. 版本化建议

每次 run 建议显式记录：

- benchmark version
- model version
- prompt version
- semantic layer version
- runner version
- evaluator version

否则后续很难定位退化来源。

---

## 11. 推荐推进顺序

### Phase 1：定义协议
先把 case / run / metric / report schema 定下来。

### Phase 2：接最小 skeleton
哪怕 runner 先用 mock，也先把链路跑通。

### Phase 3：补样例集
优先覆盖高频问题和高风险问题。

### Phase 4：接 CI / 回归
把 benchmark 纳入版本发布前检查。

---

## 12. 推荐结论

针对你的产品，最佳做法不是“套一个 benchmark”，而是：

> 用 benchmark 思维定义 case，用产品工程思维建设 runner / evaluator / report。

也就是：
- **Spider/BIRD 提供指标灵感**
- **你的协议定义产品 case**
- **你的 runner/evaluator 决定能否长期可用**

如果继续推进，下一步最值得做的是：
1. 补 10 条真实产品 case
2. 把 skeleton 的 mock runner 替换成产品 API runner
3. 接第一版 baseline 回归
