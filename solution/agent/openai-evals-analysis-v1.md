# OpenAI Evals 分析（v1）

> 目标：从 agent 可观测性与评测框架视角，分析 OpenAI Evals 的定位、能力边界、适用方式与局限。

---

## 1. 结论

OpenAI Evals 更像一个：

> **以 dataset + scorer + CLI 运行为核心的离线评测框架**

而不是一个完整的 agent observability 平台。

它的强项在：
- 标准化 eval 组织方式
- case-based regression
- model-graded eval
- 通过 completion function 评测“模型之外的系统”

它的弱项在：
- 对 agent 中间过程的原生观测不强
- 对 trace / span / loop 可视化支持弱
- 更适合离线 benchmark / regression，不是生产级 observability 中台

所以如果从你的研究目标出发：

### 适合 OpenAI Evals 做的事
- 构建评测集
- 设计 scorer / rubric
- 跑版本回归
- 评测一个 agent/system 的最终表现

### 不适合 OpenAI Evals 单独做的事
- 观察 agent 的每一步行为
- 做 loop/tool/retrieval 级别可视化
- 充当生产调试平台

---

## 2. 它的核心设计思路

从仓库 README 和 build 文档看，OpenAI Evals 的基本结构是：

```text
dataset (JSONL)
  +
eval spec (YAML)
  +
eval class / template
  +
completion function (optional)
  ↓
CLI run
  ↓
metrics / report
```

这说明它的核心不是 trace，而是：

- **样例集怎么组织**
- **评分逻辑怎么定义**
- **如何把同一套 eval 重复跑在不同模型/系统上**

---

## 3. OpenAI Evals 的几个关键概念

### 3.1 Dataset-first
它要求先把样例组织成 JSONL。

每个样本通常至少有：
- `input`
- `ideal`（基础 eval）
- 或更多 rubric 字段（model-graded eval）

这意味着它天然非常适合：
- benchmark
- regression
- 固定 case 测试

### 3.2 Eval registry
评测通过 YAML 注册。

典型结构：
- eval 名称
- 版本
- eval class
- dataset 路径
- metrics

这个设计的价值在于：
- eval 可复用
- 版本可管理
- 同一评测可以跑在不同 completion target 上

### 3.3 Completion Functions
这是 OpenAI Evals 对 agent/system 最关键的扩展点。

它的思路是：

> 不一定直接测裸模型，也可以测一个“会在内部做额外动作再输出答案”的 completion function。

文档给的例子包括：
- 内部先检索
- 内部先浏览
- 内部包一层 LangChain LLM

这对 agent 很重要，因为意味着：

> **OpenAI Evals 可以把 agent 当成一个 completion provider 来测。**

但要注意：
它测到的仍然主要是“输入 → 输出”的表现，而不是完整运行时观测。

---

## 4. 它在 agent 评测上的价值

### 4.1 最大价值：能评“系统”，不只评“模型”
因为有 completion function，理论上你可以把下面这些都包进去：
- retrieval
- tool use
- external chain
- agent runtime

然后把整个系统作为被测对象。

这非常适合：
- 版本前后对比
- A/B prompt 对比
- planner 版本对比
- tool policy 对比

### 4.2 第二个价值：支持 model-graded eval
这意味着对于难以精确字符串比对的任务，可以通过：
- rubric
- evaluation prompt
- judge model

来判断输出质量。

这类能力对 agent 特别有用，因为很多 agent 任务不是简单 exact match。

### 4.3 第三个价值：适合做 meta-eval
文档里强调了 meta-eval：

> 对 model-graded eval 本身也做校验。

这是个很重要的行业信号：
- 不只是评模型
- 连评测器本身也要评

这个思路很值得借鉴到 agent eval 框架里。

---

## 5. 它的局限

### 5.1 对 observability 不够强
OpenAI Evals 不是 tracing 平台。

它没有把这些当第一公民：
- span tree
- loop trace visualization
- tool call timeline
- token / latency drilldown per step

所以如果你问：

> “agent 为什么错？”

OpenAI Evals 单独使用时，回答能力有限。

它更擅长回答：

> “这个版本在这组 case 上表现如何？”

### 5.2 对分阶段归因支持需要你自己补
它原生思路更偏：
- 样例
- 输出
- 评分

而不是：
- retrieval stage
- planning stage
- tool stage
- synthesis stage

如果你想做 agent 级 failure taxonomy，通常要自己：
- 记录 run record
- 记录 step trace
- 在 scorer 里注入 stage/type judgement

### 5.3 更偏离线，不偏生产运行观测
它很适合：
- 离线回归
- benchmark
- 验证新版本

但不太像：
- 线上诊断中台
- 生产实时观测系统

---

## 6. 对 agent 研究最值得借鉴的地方

我觉得 OpenAI Evals 最值得借鉴的不是具体代码，而是这 4 个设计思想。

### 6.1 dataset 是核心资产
评测框架不是先从模型或平台开始，而是先从：
- 样例集
- 标签
- rubric
- versioning

开始。

### 6.2 evaluator 要可配置
通过 YAML + 模板 + rubric，把评测逻辑做成配置化对象，而不是散落脚本。

### 6.3 completion function 把“系统评测”纳入统一接口
这个思路非常适合 agent：
- 不关心内部多复杂
- 只要暴露一个统一 completion 接口，就能纳入评测框架

### 6.4 meta-eval 思维很重要
对评测器本身做校验，是很成熟的做法。

---

## 7. 如果把 OpenAI Evals 放进 agent 框架里，合适的位置在哪

我建议把它放在：

### **评测 / 回归层**
而不是放在：

### **观测 / trace 层**

也就是：

```text
runtime / tracing / logs
        ↓
structured run records
        ↓
OpenAI Evals-style dataset + scorer + regression
```

更具体一点：

- **上游**：你自己的 agent runtime 负责记录 run record、loop trace、tool trace
- **下游**：Evals 风格框架负责基于这些结果做 case-based scoring 和 regression

这才是比较合理的组合。

---

## 8. 对你的直接启发

如果你的目标是研究 agent observability + evaluation，那么 OpenAI Evals 给你的启发应该是：

### 应该借鉴
- dataset-first
- config-driven eval
- model-graded eval
- system-as-completion-function
- meta-eval

### 不应该直接照搬成全部方案
- 不要指望它承担 tracing
- 不要指望它天然支持 stage-level observability
- 不要把 agent 过程观测和离线评分混成一层

---

## 9. 一句话判断

如果只用一句话评价 OpenAI Evals：

> **它非常适合作为 agent 的离线评测与回归框架底座，但不适合作为 agent 的完整可观测性平台。**

---

## 10. 下一步建议

基于 OpenAI Evals，下一步最值得继续研究的是：

1. **它的 eval object / dataset / scorer 结构，怎样迁移到 agent case schema**
2. **completion function 思路，怎样映射到 agent runtime interface**
3. **它缺失的 trace / stage attribution，应该怎样补到你的框架里**

如果继续往下做，最自然的下一篇就是：

- `openai-evals-for-agent-framework-design.md`

专门回答：

> 如何把 OpenAI Evals 的思路，改造成适合 agent 的评测框架。
