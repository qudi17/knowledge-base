# OSS Data Analyst：semantic layer 设计拆解与最小可复现架构（研究补充）

- 关联主报告：[We removed 80% of our agent’s tools](./2025-12-22-we-removed-80-percent-of-our-agents-tools.md)
- 关联仓库：https://github.com/vercel-labs/oss-data-analyst

## 元信息
- 报告生成日期：2026-03-11
- Domain：text-to-sql
- 关键词：semantic layer, schema grounding, file-system agent, minimal architecture, text-to-sql, YAML catalog
- 研究对象仓库 HEAD：`af11371c872d79b7ad3d3d2e794fa339dd94e160`

---

## TL;DR
1. `oss-data-analyst` 最值得学的不是 prompt，而是 **semantic layer 的写法**：它把“模型需要知道但不该猜”的东西变成了可 grep、可读、可 join 的 YAML。 
2. 这套 semantic layer 采用 **两层结构**：`catalog.yml` 做总索引，`entities/*.yml` 做实体细节；前者帮助导航，后者承载可执行语义。 Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/catalog.yml#L1-L48 Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Accounts.yml#L1-L117
3. 它的最小 agent 架构也非常清晰：**一个受控文件浏览工具 + 一个查询执行工具 + 一个结构化收尾工具**，已经足够形成可用的 text-to-SQL 闭环。 Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L65-L97
4. 如果你自己做类似系统，优先建设的顺序应该是：**数据语义文件 > 最小执行链路 > eval 集**，而不是先堆复杂 tool orchestration。
5. 这套模式可以推广到其他“从自然语言到结构化操作”的场景：SQL、配置分析、代码库问答、指标查询、报表解释。

---

## Part B1：semantic layer 设计拆解

## 1. 为什么这套 semantic layer 对 LLM 友好

LLM 做 text-to-SQL 时最容易犯的错，不是 SQL 语法本身，而是：

- 选错表
- 选错字段
- 搞错业务指标定义
- join 路径不对
- 不知道枚举值口径
- 不知道时间字段应该用哪一个

`oss-data-analyst` 的 semantic layer，本质上是在解决这些“猜测问题”。

它不是把 schema 全塞给模型，而是把 schema 按“人类分析师也会这样理解”的方式重新整理了一遍。

---

## 2. 两层结构：catalog + entities

### 2.1 `catalog.yml`：导航层

`catalog.yml` 中每个实体包含：

- `name`
- `grain`
- `description`
- `fields`
- `example_questions`
- `use_cases`

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/catalog.yml#L1-L48

这一层的作用不是执行，而是**定位**：

- 用户问题更像哪类实体？
- 这个实体能回答什么问题？
- 应该先打开哪个 entity 文件？

我会把它理解成：

> **给模型的 schema 目录页 / 导航页 / 主题地图**

### 2.2 `entities/*.yml`：执行语义层

例如 `Company.yml` / `People.yml` / `Accounts.yml` 内都有：

- `name`
- `type`
- `table`
- `grain`
- `description`
- `common_questions`
- `dimensions`
- `time_dimensions`
- `measures`
- `joins`

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Company.yml#L1-L96
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/People.yml#L1-L106
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Accounts.yml#L1-L117

这一层才是真正帮助模型写 SQL 的部分。

---

## 3. 每个字段为什么重要

### 3.1 `grain`
`grain` 是 text-to-SQL 里常被忽视、但非常关键的信息。

比如：
- one row per company
- one row per person
- one row per account

它帮助模型判断：

- `count(*)` 到底在数什么
- 聚合前是否需要去重
- join 后会不会把粒度打爆

这对避免错误聚合非常重要。

### 3.2 `description`
这是“业务语义压缩说明”。

它告诉模型：
- 这个实体讲的是哪类业务对象
- 常见分析目标是什么
- 哪些字段是这个实体的核心解释维度

这能显著减少模型把表当成“纯字段集合”处理的倾向。

### 3.3 `fields` / `dimensions`
这是 schema grounding 的基础层。

- `catalog.yml` 的 `fields` 帮助快速粗筛
- entity 里的 `dimensions` 才给出真正可用的字段语义

每个 dimension 里至少有：
- `name`
- `sql`
- `type`
- `description`

这相当于把“字段字典”结构化了。

### 3.4 `sample_values`
这是一个很小、但非常有价值的设计。

例如：
- `industry`: `[Technology, Finance, Healthcare, Retail, Manufacturing]`
- `department`: `[Engineering, Sales, Marketing, HR, Finance, Operations]`
- `status`: `[Active, Inactive, Suspended, Closed]`

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Company.yml#L22-L27
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/People.yml#L42-L47
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Accounts.yml#L32-L42

它的作用是：

- 降低枚举值 hallucination
- 帮模型知道筛选值长什么样
- 帮模型对自然语言同义表达做归一

这是非常值得抄的点。

### 3.5 `time_dimensions`
很多 SQL 错误其实是“时间字段选错”。

单独把时间维拆出来，能帮助模型快速回答：
- 哪些字段可用于时间过滤
- 哪些字段适合做趋势分析
- 应该按哪个时间维来解释“新增 / 创建 / 合同开始 / 合同结束”

### 3.6 `measures`
这层是 text-to-SQL 真正跨过“纯 schema”进入“语义指标”的地方。

例如：
- `count`
- `total_revenue`
- `avg_salary`
- `total_monthly_value`

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Accounts.yml#L75-L104

measure 的关键价值是：

- 把常用聚合逻辑命名化
- 减少模型自己临时发明指标
- 帮助生成 narrative 时使用更贴近业务的语言

### 3.7 `joins`
这是从“单表问答”走向“真正分析”的关键。

每个 join 都显式标出：
- `target_entity`
- `relationship`
- `join_columns.from`
- `join_columns.to`

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Accounts.yml#L106-L117

这个设计比只告诉模型 foreign key 存在更好，因为它把：

- 关系方向
- join 目标
- join 列

都说清楚了。

---

## 4. 一个可复用的 semantic layer 模板

如果要做你自己的版本，我建议至少长这样：

```yaml
# catalog.yml
entities:
  - name: Orders
    grain: one row per order
    description: Customer orders for commerce analysis
    fields: [order_id, customer_id, status, total_amount, created_at]
    example_questions:
      - Last 30 days GMV
      - Order count by status
      - Top customers by order value
    use_cases: >-
      Revenue monitoring, conversion analysis, customer segmentation
```

```yaml
# entities/Orders.yml
name: Orders
type: fact_table
table: analytics.orders
grain: one row per order
description: Order facts for revenue and conversion analysis
common_questions:
  - What is GMV in the last 30 days?
  - How many paid orders do we have?

dimensions:
  - name: order_id
    sql: order_id
    type: string
    description: Unique order identifier

  - name: status
    sql: status
    type: string
    description: Order status
    sample_values: [pending, paid, refunded, cancelled]

time_dimensions:
  - name: created_at
    sql: created_at
    type: time
    description: Order creation time

measures:
  - name: count
    sql: order_id
    type: count_distinct
    description: Number of orders

  - name: gmv
    sql: total_amount
    type: sum
    description: Gross merchandise value

joins:
  - target_entity: Customers
    relationship: many_to_one
    join_columns:
      from: customer_id
      to: customer_id
```

### 我建议的最低要求
最少要有：
- `grain`
- `description`
- `dimensions`
- `time_dimensions`
- `measures`
- `joins`
- `sample_values`（尽量补）
- `example_questions` / `common_questions`

---

## 5. 这套 semantic layer 还缺什么

它已经够 demo 好用，但距离企业级还有几层没补：

- 指标口径版本管理
- 同义词 / alias 体系
- 权限与 row-level security 语义
- 度量依赖关系（metric lineage）
- 多数据源 / 多 schema 统一抽象
- 维度值规范化字典
- ambiguity clarification 规则

所以你可以把它当成：

> **lightweight semantic layer for LLMs**

而不是成熟语义平台的终点形态。

---

## Part B2：最小可复现架构

## 6. 这个 repo 的最小架构到底是什么

从代码看，它就是下面这个闭环：

```text
User question
  -> Agent
    -> bash explore semantic files
    -> generate SQL
    -> ExecuteSQL
    -> retry on error
    -> FinalizeReport
  -> UI render narrative
```

核心实现点：

- 工具集：`bash`、`ExecuteSQL`、`FinalizeReport`
- 语义文件：上传进 sandbox 的 `src/semantic/**/*.yml`
- 主循环：`streamText()` + stop when FinalizeReport

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L21-L97
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/tools/shell.ts#L15-L25
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/tools/execute-sqlite.ts#L8-L41

---

## 7. 我建议你自己做时的最小目录

```text
my-data-analyst/
├── src/
│   ├── agent/
│   │   ├── run-agent.ts
│   │   ├── prompt.ts
│   │   └── tools/
│   │       ├── shell.ts
│   │       ├── execute-sql.ts
│   │       └── finalize.ts
│   ├── semantic/
│   │   ├── catalog.yml
│   │   └── entities/
│   │       ├── orders.yml
│   │       ├── customers.yml
│   │       └── products.yml
│   └── db/
│       └── execute.ts
├── evals/
│   ├── benchmark.json
│   └── graders/
├── app/
│   ├── api/chat/route.ts
│   └── page.tsx
└── README.md
```

这个骨架已经足够开始。

---

## 8. 三个工具就够起步

### 8.1 工具 1：shell / file explorer
只负责：
- `ls`
- `cat`
- `grep` / `rg`
- 必要时 `head`

注意：
- 限制目录范围
- 默认只读
- 不给任意网络访问

### 8.2 工具 2：execute-sql
只负责：
- 执行只读 SQL
- 返回 rows / columns / rowCount / error

建议你做时比 repo 更严格：
- 只允许 `SELECT`
- 禁止 `INSERT/UPDATE/DELETE/DDL`
- 可选：加 `LIMIT` 守卫
- 可选：加 query timeout

### 8.3 工具 3：finalize
只负责结构化收尾：
- SQL
- 结果摘要
- narrative
- assumptions
- caveats

这样前端和日志系统都更好接。

---

## 9. 最小 prompt 框架

可以直接照这个思路：

```text
You are a data analyst agent.

You must follow this workflow:
1. Explore semantic files before writing SQL.
2. Never guess field names.
3. Use joins only if they are defined in entity YAML.
4. Execute read-only SQL.
5. If SQL fails, analyze the error and modify the query.
6. Retry at most 2 times.
7. Finish with FinalizeReport.

Answer style:
- Lead with the answer.
- Then explain method, assumptions, caveats.
- Keep concise.
```

关键不是 prompt 写得多华丽，而是：
- 规则少但硬
- 与 semantic layer 一致
- 与工具能力一致

---

## 10. 最小 eval 集怎么建

如果你真要做，最好不要等到产品做完才评测。

我建议至少建这 6 类题：

1. **单表聚合**
   - 例：各行业公司数量
2. **单表过滤**
   - 例：2024 年后创建的活跃账户
3. **双表 join**
   - 例：每个公司员工数
4. **多跳 join**
   - 例：账户经理对应管理的账户收入
5. **时间分析**
   - 例：按月新增合同数
6. **模糊问题 / 需澄清问题**
   - 例：表现最好的客户是谁？

每条 benchmark 至少存：
- 用户问题
- 期望 SQL（或等价逻辑）
- 关键结果断言
- 是否允许多种正确答案

不要只测“SQL 能跑”，要测：
- 结果是否正确
- narrative 是否合理
- 是否用了错误 join
- 是否违反语义定义

---

## 11. 从 demo 到生产，优先补哪几层

### 第一层：安全
- 真正只读 SQL
- 超时 / row limit
- 目录访问白名单
- 沙箱隔离

### 第二层：语义增强
- 同义词词典
- 业务指标别名
- 常见问题模板
- ambiguity clarification

### 第三层：评测与观测
- benchmark 集
- 查询日志
- tool trace
- 失败原因分类

### 第四层：企业能力
- 权限模型
- schema 分域
- 指标版本管理
- 多源统一语义层

---

## 12. 一个我认可的实施顺序

如果让我自己做一个类似系统，我会按这个顺序：

### Phase 1：最小可用
- 3~5 个核心实体
- YAML semantic layer
- bash + read-only SQL + finalize
- 20 条 benchmark

### Phase 2：提升稳定性
- sample values 补全
- joins 补全
- 时间维规范化
- 错误分类与 retry 策略

### Phase 3：提升真实可用性
- 同义词映射
- 模糊问题澄清
- 结果可视化
- 多数据域支持

### Phase 4：企业化
- 权限控制
- observability
- 回归评测
- schema 变更自动检查

---

## 13. 最后的判断

如果你问我这套 repo 最该学什么，我的答案不是“Vercel Sandbox”也不是“Claude Opus 4.5”，而是这两句话：

1. **先把数据语义整理成模型可直接阅读的文件。**
2. **先用最小工具集跑通，再决定哪些复杂度真的值得加。**

这两个点，才是这套系统真正可迁移的部分。

---

## 参考与证据
- 仓库主页：https://github.com/vercel-labs/oss-data-analyst
- README：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/README.md#L1-L142
- Agent 主循环：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L1-L151
- shell tool：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/tools/shell.ts#L1-L26
- SQL tool：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/tools/execute-sqlite.ts#L1-L42
- catalog：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/catalog.yml#L1-L48
- Company entity：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Company.yml#L1-L96
- People entity：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/People.yml#L1-L106
- Accounts entity：https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Accounts.yml#L1-L117
