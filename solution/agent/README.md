# Agent 方法论

本目录沉淀面向真实业务场景的 agent 方法论，重点关注：

- minimal agent architecture
- agent 与 workflow 的边界
- observability / evaluation / regression
- 可控性、失败归因与生产落地

> 目标：不是做“看起来很聪明的 agent”，而是做**可诊断、可约束、可回归、可上线**的 agent。

---

## 当前内容

### 研究 / 方法论
- [最小可用 Agent 架构（v1）](./minimal-agent-architecture-v1.md)
- [Agent 可观测性与评测框架（v1）](./agent-observability-and-evaluation-v1.md)
- [Agent 可观测性与评测框架：行业实践综述（v1）](./industry-survey-agent-observability-and-evaluation.md)

---

## 核心共识

### 1. 真实业务 AI 系统大多绕不开 agent
只要系统需要：
- 分步决策
- 使用工具
- 根据中间结果调整下一步
- 处理澄清、异常、权限、回退

它本质上就在 agent 化。

### 2. 关键问题不是“要不要 agent”，而是“多轻、多稳、多可控”
落地重点通常不在能力上限，而在：
- 最小闭环
- 失败可诊断
- 风险可约束
- 版本可回归

### 3. 先建观测和评测，再谈复杂自主性
没有 trace、run record 和 failure taxonomy 的 agent，后面基本无法稳定迭代。

---

## 后续建议

如果继续扩展本目录，建议优先补：
- agent failure taxonomy（machine-readable）
- tool contract 设计规范
- planner / executor / critic 边界设计
- human-in-the-loop checkpoints
