# Agent 可观测性与评测框架：行业实践综述（v1）

> 目标：总结行业在 agent observability / evaluation / regression / feedback loop 上的主流做法，帮助判断哪些是“平台通用能力”，哪些需要自研。

---

## 1. 执行摘要

行业在 agent 可观测性与评测框架上，已经逐步收敛到 4 层结构：

1. **Observability / Tracing**
2. **Evaluation / Feedback**
3. **Regression / Benchmarking**
4. **Online Feedback Loop**

一个成熟的 agent 平台，通常不会只做其中一层，而是至少把前两层打通。

### 1.1 当前最强共识

- **只看 final answer 已经不够**
- **必须记录中间步骤（loop/tool/retrieval）**
- **必须能把失败分到 stage/type**
- **必须有固定 case 做版本回归**
- **线上 bad cases 必须回流到离线评测**

---

## 2. 行业框架的三种主形态

### 2.1 Observability-first 平台
代表：
- LangSmith
- Arize Phoenix
- Weights & Biases Weave
- Helicone（更偏 LLM request 观测）

特点：
- 强 trace / span / call tree
- 强运行过程可视化
- 强 prompt / tool / latency / token 诊断
- 常带基础 feedback / evaluator，但不一定以 regression 为中心

适合：
- 先看 agent 到底做了什么
- 先定位 loop / tool / latency / prompt 问题

### 2.2 Eval-first 平台
代表：
- Braintrust
- OpenAI Evals
- promptfoo
- DeepEval
- LangSmith evaluators

特点：
- 强 case-based evaluation
- 强基线、对比、回归
- 强 rubric / scorer / judge 设计
- 对 trace 的精细程度通常不如 observability-first 平台

适合：
- 先看版本有没有退化
- 想建立 release gate
- 想做 benchmark / regression / A/B 对比

### 2.3 自研中台 + 通用平台混合
很多成熟团队最后都会走到这一步：

- tracing 用通用思路（如 span/event）
- eval 用自家 dataset + rubric
- failure taxonomy 自定义
- dashboard / release gate 自研

原因很现实：
- 通用平台不完全匹配业务流程
- policy / permission / human handoff 往往有强业务特性
- 工具契约和状态机细节需要自己定义

---

## 3. 行业在 observability 上怎么做

### 3.1 基本模型：run + span
现在行业在 agent 观测层基本都在靠近 tracing 思路。

一个典型结构：

- 一个用户请求 = 一个 `run`
- run 下包含多个 `span` / `events`
- span 类型可能包括：
  - LLM call
  - retrieval
  - planner
  - tool call
  - memory read/write
  - final answer synthesis

### 3.2 记录字段
常见记录字段：

- input / output
- prompt / response
- tool input / output
- latency
- token usage
- errors
- metadata tags
- parent-child relationship

### 3.3 行业里的实际重点
可观测性层回答的是：

> **它做了什么？**

而不是：

> **它做得好不好？**

所以这层更像 agent 的“运行录像”，不是最终成绩单。

---

## 4. 行业在 evaluation 上怎么做

### 4.1 从 outcome-only 转向 process-aware eval
早期很多系统只评 final answer correctness。

现在更成熟的做法会同时评：

#### A. Outcome
- 最终任务是否成功
- 最终答案是否正确
- 是否完成用户目标

#### B. Process
- route / plan 是否合理
- retrieval 是否命中关键上下文
- tool 选择是否正确
- tool output 是否被正确消费
- loop 是否过长、过度试错

#### C. Policy
- 是否越权
- 是否误执行危险操作
- 是否应澄清未澄清
- 是否应拒答未拒答

### 4.2 评测对象拆分
行业里常见的评测拆法：

- Router / Planner eval
- Retrieval / Context eval
- Tool-use eval
- Final-answer eval
- Safety / Policy eval

这和传统单轮 QA eval 最大的区别，就是：

> **过程本身也要被评测。**

---

## 5. 行业在 regression 上怎么做

### 5.1 固定 case 集成为标配
一旦 agent 进入产品，团队通常都会维护：

- benchmark / test cases
- baseline metrics
- 版本 diff report

每次以下变化都会触发回归：
- 模型版本
- system prompt
- routing/planning 逻辑
- retrieval 策略
- tool contract
- guardrails

### 5.2 输出什么
行业里比较成熟的回归输出通常包括：

- success_rate diff
- failure_by_stage diff
- failure_by_type diff
- 新增坏例
- 修复好例
- latency / cost diff

### 5.3 一个很强的共识
如果一个 agent 平台没有 regression，它几乎不可能稳定迭代。

因为你无法回答：
- 这次改动到底变好了没有
- 是整体变差，还是某类题退化
- 新功能是不是带回了旧问题

---

## 6. 行业在 feedback loop 上怎么做

### 6.1 自动评测不够，人工反馈仍然重要
对 agent 来说，很多错误是自动评测很难完整覆盖的，比如：
- narrative 误导
- 多步决策虽合理但很脆弱
- 高风险场景的边界判断

所以很多团队会加：
- thumbs up / down
- reviewer rubric
- failure tagging
- case annotation
- online bad-case collection

### 6.2 成熟闭环
行业里最成熟的闭环大致是：

```text
online run
  ↓
trace + feedback
  ↓
bad case sampling
  ↓
human labeling / failure tagging
  ↓
dataset update
  ↓
offline regression
  ↓
release decision
```

这条闭环往往比单独某个模型或平台更重要。

---

## 7. 代表性平台对比

| 平台/方案 | 侧重点 | 强项 | 弱项 | 更适合 |
|---|---|---|---|---|
| LangSmith | observability + eval | trace、run tree、dataset/evaluator 一体化 | 深度依赖 LangChain 生态时更顺手 | 先观测再评测 |
| Arize Phoenix | observability | tracing、LLM app diagnostics、retrieval 分析较强 | release-gate / regression 需补配套 | 过程诊断 |
| Weave | observability + experiment tracking | trace、artifact、实验追踪 | 业务评测 schema 往往仍需自定 | 研发实验与回放 |
| Braintrust | eval-first | dataset、scoring、回归、评测工作流清晰 | 中间过程观测不如 tracing-first 产品直观 | 回归与版本对比 |
| OpenAI Evals | eval-first | benchmark/eval 思路强，适合构建标准集 | 生产级 trace/ops 不是重点 | 离线评测 |
| promptfoo | eval-first | 轻量、配置化、A/B 和 regression 快 | agent 中间步骤观测较弱 | 快速回归 |
| DeepEval | eval-first | LLM app eval、judge/rubric 丰富 | 生产级 tracing 仍需外补 | 评测实验 |
| OpenTelemetry + 自研 | tracing 标准底座 | 灵活、可控、可接现有监控体系 | 成本高，需要自己定义 agent schema | 生产中台 |

---

## 8. 行业最关键的 5 个共识

### 共识 1：Final answer 不是唯一评测对象
因为 agent 常见两种危险情况：
- 最终对，但过程违规或极脆弱
- 最终错，但错因在上游 stage

### 共识 2：Trace schema 必须先统一
没有统一 schema：
- 版本间不可比
- evaluator 难复用
- 失败难自动归因

### 共识 3：Failure taxonomy 是核心资产
真正能持续迭代的团队，通常都有自己的：
- failure stage
- failure type
- severity
- owner mapping

### 共识 4：回归要和上线流程绑定
成熟团队不会只把 eval 当研究工具，而会把它变成：
- pre-release gate
- nightly regression
- change review evidence

### 共识 5：线上反馈必须回流离线集
否则系统会永远只在“实验室”里优化。

---

## 9. 对你的研究最有价值的启发

如果你要研究 agent observability / evaluation，行业上最值得抓的不是某个具体平台，而是背后的结构：

### 9.1 先统一运行记录结构
比如：
- run record
- span / step record
- tool record
- final answer consistency

### 9.2 再统一 failure taxonomy
比如：
- routing
- retrieval
- tool
- synthesis
- safety

### 9.3 再定义 baseline + regression 流程
比如：
- 小样例集
- failure injection
- nightly replay
- release diff

换句话说：

> **平台可以换，但 schema、taxonomy 和 regression 流程最好掌握在自己手里。**

---

## 10. 推荐研究顺序

如果继续做这一方向，建议按这个顺序：

### Step 1
先研究：**run record / trace schema 的行业共识**

### Step 2
再研究：**failure taxonomy 和分阶段归因**

### Step 3
再研究：**release gate / regression / feedback loop**

### Step 4
最后再比较：**不同平台如何承载这些能力**

---

## 11. 一句话结论

行业已经基本证明：

> **agent 可观测性与评测不是一个“额外功能”，而是 agent 工程化的底座。**

没有 trace、eval、regression、feedback loop 的 agent，通常只能停留在 demo 或早期实验阶段。
