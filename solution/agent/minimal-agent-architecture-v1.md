# 最小可用 Agent 架构（v1）

> 目标：回答一个更本质的问题——真实业务里，agent 最小要长什么样，才能既有用，又不会迅速失控。

---

## 1. 结论

对于多数业务型 AI 系统，推荐默认从 **最小 agent** 出发，而不是从“全自主多工具系统”出发。

所谓最小 agent，通常只包含 4 个核心部分：

1. **Input normalization**
2. **Planning / routing**
3. **Tool execution**
4. **Answer synthesis**

如果问题需要多轮处理，再增加：

5. **Loop control**
6. **Guardrails / stop conditions**

也就是说，最小可用 agent 不是“什么都能干”，而是：

> **能完成一个有限闭环，并且每一步都能被记录、限制、复盘。**

---

## 2. 为什么大多数系统最后都会 agent 化

真实业务场景通常同时存在：

- 输入不规范
- 需要检索上下文
- 需要调工具
- 需要校验中间结果
- 需要失败重试
- 需要澄清或拒答

这意味着系统很难永远停留在：

- 单轮 prompt
- 固定 workflow
- 无状态问答

很多“不是 agent”的方案，最后只是：

- 超长 prompt
- if/else 状态机
- 隐式路由器
- 手工编排的多步链路

本质上仍然是 agent，只是没有显式命名。

---

## 3. 推荐的最小分层

### L0. Fixed workflow layer
固定步骤：
- 权限检查
- 输入清洗
- schema 校验
- 输出格式校验

这些尽量不要交给 agent 自由发挥。

### L1. Agent decision layer
让 agent 决定：
- 需不需要检索
- 该调哪个工具
- 是否要澄清
- 是否继续 loop

### L2. Tool layer
工具必须：
- 输入/输出稳定
- 可记录
- 可重放
- 可失败显式化

### L3. Synthesis layer
把中间结果变成最终回答。

---

## 4. 推荐最小闭环

```text
user input
  ↓
normalize
  ↓
route / plan
  ↓
retrieve or call tool
  ↓
check result
  ↓
final answer / clarification / refusal
```

如果没有必要，不要在 v1 就引入：
- 多 agent 协作
- 无上限 loop
- 自主工具发现
- 自主改写系统策略

---

## 5. workflow 和 agent 的边界

这是最值得提前想清楚的。

### 应该固定的部分
- 权限判断
- 敏感数据处理
- SQL / API 执行器
- 输出 schema 校验
- retry 上限
- 人工审批点

### 可以交给 agent 的部分
- 问题路由
- 检索策略
- 工具选择
- 是否澄清
- 最终回答组织

一句话：

> **高风险、强约束、可规则化的部分固定；不确定、依赖语义判断的部分交给 agent。**

---

## 6. 最小 agent 的状态设计

推荐至少维护以下状态：

- `user_input`
- `normalized_input`
- `context`
- `plan`
- `tool_calls`
- `tool_results`
- `decision_trace`
- `final_answer`
- `status`

不要把“状态”完全藏在 prompt 里。

否则后续会出现：
- 无法回放
- 无法 diff
- 无法定位退化

---

## 7. 停止条件（Stop Conditions）

agent 失控通常不是因为它太聪明，而是因为没有停下来。

建议 v1 就明确：

- 最大 loop 次数
- 最大 tool 次数
- 最大总耗时
- 最大 token 消耗
- 触发拒答/升级人工的条件

特别是以下情况必须停：
- 连续失败重试
- 权限不明
- 关键上下文不足
- 高风险问题语义不清

---

## 8. 反模式

### 反模式 1：把所有步骤都交给 agent
结果：
- 不稳定
- 难调试
- 风险不可控

### 反模式 2：没有显式 plan
结果：
- 每步都像即兴发挥
- 无法判断错在检索还是执行还是回答

### 反模式 3：没有 tool contract
结果：
- tool 返回不稳定
- trace 不可比较
- 回归困难

### 反模式 4：没有 stop condition
结果：
- loop 漫游
- token 失控
- 错误放大

---

## 9. 推荐 v1 架构模板

```text
Agent Runtime
├── Normalizer
├── Router / Planner
├── Tool Registry
├── Tool Executor
├── State Store
├── Guardrails
├── Answer Synthesizer
└── Trace Logger
```

其中最不能省的是：
- Guardrails
- State Store
- Trace Logger

---

## 10. 一句话建议

如果要落地真实业务 agent，最好的起点不是“更强自主性”，而是：

> **更小的闭环、更清晰的边界、更强的可观测性。**

这是多数 agent 系统能否走到生产的分水岭。
