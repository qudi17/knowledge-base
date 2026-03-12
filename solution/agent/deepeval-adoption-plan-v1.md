# DeepEval 落地方案草案（v1）

> 目标：给出一套适合公司内部 agent 项目的 DeepEval 落地方案，满足 self-host、数据不出公司、可与自定义 run record / failure taxonomy 结合。

---

## 1. 结论

如果要在你的实际项目中落地一套 **可本地运行、可扩展、可和自定义 agent runtime 结合** 的 eval 方案，DeepEval 是一个可行选项。

它更适合被放在：

> **评测与回归层**

而不是承担完整 observability 平台角色。

推荐的总体结构是：

```text
agent runtime
  ↓
run record / loop trace / tool trace
  ↓
case adapter
  ↓
DeepEval metrics / custom evaluators
  ↓
summary / regression / release gate
```

一句话：

> **DeepEval 负责评测与回归；你的 runtime 负责观测与归因。**

---

## 2. 为什么选 DeepEval

### 2.1 满足硬约束
- **License**：Apache-2.0，足够开放
- **Self-host**：可本地运行
- **数据不出公司**：可以，本地执行；前提是你接入的 judge model / provider 也在公司允许边界内

### 2.2 对你的项目更合适的原因
相比纯 CLI 配置型方案，DeepEval 的优势是：
- 更适合 Python 项目集成
- 更容易写自定义 metric / evaluator
- 更适合和自定义 agent runtime 深度结合
- 更容易把 run record、loop trace、failure taxonomy 映射进评测逻辑

### 2.3 它在你体系里的定位
不要把 DeepEval 当成：
- tracing 平台
- runtime orchestrator
- 线上诊断中台

要把它当成：
- case-based evaluation engine
- metric framework
- regression harness

---

## 3. 推荐落地边界

### DeepEval 负责什么
- 读取 case
- 调用被测 agent / adapter
- 执行 metric
- 聚合得分
- 输出报告
- 跑版本回归

### 你的 agent runtime 负责什么
- run record
- loop trace
- tool trace
- retrieval trace
- permission / guardrail logging
- primary failure attribution 原始素材

### 为什么要这样切
因为真实 agent 系统里，评测和观测不是一回事：
- **观测**回答：发生了什么
- **评测**回答：做得好不好

---

## 4. 推荐技术架构

### 4.1 最小落地架构

```text
project/
├── agent_runtime/
│   ├── runner.py
│   ├── tracing.py
│   └── schemas.py
├── eval/
│   ├── cases/
│   ├── metrics/
│   ├── adapters/
│   ├── reports/
│   └── run_eval.py
└── outputs/
```

### 4.2 两层接口

#### A. runtime interface
负责把 agent 真正跑起来：

```python
run_result = agent_runner.run(case)
```

输出至少包含：
- final_answer
- run_record
- loop_trace
- tool_calls
- tool_results
- latency
- token_usage

#### B. eval adapter
负责把 runtime 输出转成 DeepEval 能消费的对象。

---

## 5. case schema 设计

不要直接把 DeepEval 的最小输入当成你的唯一 case schema。

建议保留你自己的 richer case schema：

```json
{
  "id": "agent_case_001",
  "input": "帮我总结本周销售异常",
  "expected_behavior": {
    "must_retrieve": ["sales_weekly_report"],
    "must_call_tools": ["query_sales", "query_anomaly_reason"],
    "requires_clarification": false
  },
  "expected_output": {
    "key_points": ["华东区域下滑", "某产品缺货影响"]
  },
  "risk_level": "medium",
  "tags": ["sales", "analysis", "agent"]
}
```

然后再由 adapter 映射到 DeepEval 所需结构。

### 原则
- **case schema 属于你自己**
- DeepEval 是消费层，不是主 schema owner

---

## 6. run record 设计

建议保留一份与你项目绑定的标准 run record，例如：

```json
{
  "run_id": "...",
  "case_id": "agent_case_001",
  "user_input": "...",
  "agent_input": {...},
  "loop_trace": [...],
  "tool_calls": [...],
  "tool_results": [...],
  "final_answer": "...",
  "status": "ok",
  "latency_ms": 1320,
  "token_usage": {...},
  "judgement": {
    "primary_failure_stage": null,
    "primary_failure_type": null
  }
}
```

DeepEval 不应替代这份记录。

---

## 7. metric 设计

### 7.1 第一版建议只做 4 类 metric

#### A. Outcome metrics
- 最终任务是否完成
- 最终答案是否命中关键点

#### B. Consistency metrics
- final answer 与 tool result 是否一致
- final answer 与 loop trace 是否一致

#### C. Process metrics
- 是否调用了必要工具
- 是否缺少关键 retrieval context
- loop 是否超长

#### D. Policy metrics
- 应澄清未澄清
- 应拒答未拒答
- 是否越权

### 7.2 其中哪些可以直接用 DeepEval 思路
- answer quality
- rubric / judge-based score
- case-by-case pass/fail

### 7.3 哪些建议自定义
- retrieval correctness
- tool-use correctness
- loop-trace schema validity
- failure stage attribution

也就是说：

> **DeepEval 的价值在于 metric 框架，不在于你必须只用它现成指标。**

---

## 8. 推荐接入方式

### Phase 1：先做离线回归
先不要碰线上链路。

做法：
- 固定一批 cases
- 用 runtime 跑出 run_result
- 用 adapter 丢给 DeepEval
- 输出 summary / diff

### Phase 2：接自定义 metrics
补这些指标：
- retrieval pass
- tool call correctness
- final answer consistency
- loop trace completeness

### Phase 3：接 release gate
把以下场景纳入发布检查：
- prompt 更新
- model 更新
- planner 更新
- tool contract 更新
- guardrail 更新

### Phase 4：接 replay
对历史 run record 重跑 evaluator，确认：
- 是 agent 变了
- 是 metric 变了
- 还是数据集变了

---

## 9. 推荐输出

每次 eval 至少输出 3 份：

### 9.1 run_records.json
保留完整运行细节。

### 9.2 summary.json
保留：
- success_rate
- consistency_rate
- policy_pass_rate
- failure_by_stage
- failure_by_type

### 9.3 report.md
保留：
- 总体指标
- 失败样例
- 新增坏例
- 修复好例
- 版本 diff

---

## 10. 失败归因策略

不要把 failure taxonomy 完全交给 DeepEval 默认逻辑。

建议做法：

### 一级归因
- routing
- retrieval
- tool
- synthesis
- safety

### 二级归因
例如：
- `missing_required_context`
- `wrong_tool_selection`
- `tool_execution_error`
- `final_answer_inconsistency`
- `clarification_error`

### 实施方式
- runtime 产生原始证据
- DeepEval custom metric / post-processor 产出归因结果

---

## 11. 风险与局限

### 11.1 不要把 DeepEval 当 observability 平台
它不能替代：
- trace viewer
- span tree
- 在线调试

### 11.2 judge model 带来额外依赖
如果某些 metric 用 LLM judge：
- 成本会上升
- 结果会有波动
- 数据会进入 judge 模型 provider

所以如果你要求“数据不能出公司”，要优先：
- 规则型 metric
- 本地/内网模型 judge
- 或完全不用外部 judge

### 11.3 metric 漂移问题
自定义 metric 一多，后面要注意：
- 版本管理
- meta-eval
- evaluator 自测

---

## 12. 推荐实施顺序

### 第一步
先建立：
- case schema
- run record schema
- failure taxonomy

### 第二步
再接 DeepEval：
- answer metric
- consistency metric
- policy metric

### 第三步
最后做：
- regression baseline
- CI gate
- nightly replay

顺序不要反。

---

## 13. 最终建议

如果你决定用 DeepEval 落地，我建议采用下面的组合：

> **自定义 agent runtime + 自定义 run record/schema + DeepEval 作为 evaluation engine**

也就是：
- runtime 在你手里
- trace 在你手里
- taxonomy 在你手里
- DeepEval 负责把这些结果系统化评测和回归

这是最符合你当前约束的落地方式。

---

## 14. 下一步建议

如果继续推进，最自然的下一步是二选一：

1. **写一份 DeepEval 对接 agent 的接口设计文档**
2. **直接出一个 DeepEval integration skeleton**

我更建议先做 **1**，把：
- case adapter
- run result adapter
- custom metrics
- report schema

先定义清楚，再写代码。