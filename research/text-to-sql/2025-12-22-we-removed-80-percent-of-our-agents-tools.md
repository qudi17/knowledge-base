# We removed 80% of our agent’s tools（研究报告）

- 来源：https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools

## 元信息
- 作者：Andrew Qu（Chief of Software, Vercel）
- 文章发布日期：2025-12-22
- 报告生成日期：2026-03-11
- Domain（自动生成）：text-to-sql
- 关键词：text-to-sql, semantic layer, file-system agent, bash tool, Vercel Sandbox, AI SDK, Cube
- 相关仓库：https://github.com/vercel-labs/oss-data-analyst

---

## TL;DR（结论优先）
1. **Vercel 的“100%”不是通用 text-to-SQL SOTA 结论，而是内部 5 个代表性查询上的端到端成功率**；更准确地说，这是一个强工程约束下的 case study。
2. 这篇文章最重要的启发不是“bash 比专用 tool 更强”，而是：**当 semantic layer 已经足够清晰时，LLM 直接读原始语义文件，往往比通过多层中介工具更稳。**
3. 他们把 agent 从“十几个专用工具 + 重 prompt + 手工 retrieval”缩减成 **bash + SQL 执行**，让模型自己用 `cat` / `grep` / `ls` 探索 schema，结果更快、更省 token、成功率更高。
4. 开源仓库 `vercel-labs/oss-data-analyst` 证明这不是纯概念：核心链路确实非常薄，主 agent 只暴露 `bash`、`ExecuteSQL`、`FinalizeReport` 三个工具。Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L14-L19 Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L86-L90
5. 这套方法的真正护城河是 **semantic layer 质量**，不是 tool 数量：catalog、entity YAML、join、measure、sample values、example questions 都在帮助模型少猜、多查。Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/catalog.yml#L1-L48
6. 如果数据定义混乱、指标口径分散、join 未治理，这个范式不会神奇修复数据问题，只会更快地产生错误 SQL。

---

## 文章解决的问题（Problem)

Vercel 在内部做了一个 Slack 中可用的 text-to-SQL agent（d0），目标是：

- 让非数据团队成员直接提自然语言问题
- 自动生成 SQL 并查询分析基础设施
- 返回可靠、可解释、可复用的分析结果

他们遇到的问题不是“模型完全不会写 SQL”，而是旧架构太重：

- 工具很多，失败点很多
- prompt 需要持续维护
- schema retrieval / validation / error recovery 都由人手工编码
- 每次模型升级都要重新校准整套 scaffolding

因此文章试图回答：

> **对于已经足够强的模型，text-to-SQL agent 是否应该“少做一些”，把探索权还给模型？**

---

## 方案拆解（Approach)

### 1) 从“专用工具集合”转向“文件系统代理”

旧方案的工具栈包含大量细分工具，如 schema lookup、join path finding、syntax validator、format results 等；文章里展示的示意代码中，工具接近 15 个。

新方案只保留两类核心能力：

- **在受控沙箱里执行 bash 命令**
- **执行 SQL 查询**

在开源仓库中，这个最小工具集被进一步落成：

- `bash`
- `ExecuteSQL`
- `FinalizeReport`

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L65-L97

### 2) semantic layer 直接暴露给模型

仓库把语义层文件放在 `src/semantic/` 目录，并通过 sandbox 中的 bash tool 上传成可浏览目录：

- `catalog.yml`：实体目录、示例问题、字段清单
- `entities/*.yml`：实体级维度、时间维度、指标、joins

`shell.ts` 中直接把 `./src/semantic` 上传到沙箱内的 `./semantic` 目录，并只包含 `**/*.yml`。

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/tools/shell.ts#L15-L25

这意味着模型看到的是一手材料，而不是工具层二次抽象后的摘要版本。

### 3) agent workflow 其实很“人类分析师”

`SYSTEM_PROMPT` 把流程写得很直接：

1. 先探索 schema
2. 再构造 SQL
3. 执行 SQL，报错时分析并修复
4. 最终输出 SQL + CSV + narrative

而且它明确要求：

- **永远先看 schema，不准猜字段名**
- 报错后不能重试同一条 SQL
- 最多修复两次
- 最终回答要简洁，先给直接答案

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L21-L61

### 4) 执行环境与数据层都做了最小化

仓库里的 demo 并没有直接连生产数仓，而是：

- 用 `@vercel/sandbox` 创建隔离执行环境
- 用 SQLite 演示查询执行
- 用脚本初始化 `companies / people / accounts` 三张表并灌入随机样本数据

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/tools/sandbox.ts#L25-L34
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/scripts/init-database.ts#L15-L78
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/scripts/seed-database.ts#L119-L229

这说明他们开源的是 **范式与最小可运行样板**，不是 d0 的完整内部生产版本。

---

## 关键细节（参数 / 流程 / 边界条件）

### A. benchmark 口径要谨慎理解

文章给出的对比是：

- 样本：5 个 representative queries
- 新方案结果：
  - 3.5x faster
  - 37% fewer tokens
  - 100% success rate

这不是公开大规模 benchmark，也没有展开 success 的细粒度定义，因此更适合作为工程启发，而不是论文式结论。

### B. semantic layer 的“可读性”比“形式化程度”更关键

从仓库看，semantic layer 并不复杂，但非常适合让模型搜索和拼接心智模型：

- `catalog.yml` 提供实体级摘要、字段列表、示例问题
- entity YAML 提供 dimension / time_dimension / measure / join
- `sample_values` 提供枚举语义线索
- `common_questions` 提供少量任务先验

例如：

- `People.yml` 里把 `department` 的候选值显式写出
- `Accounts.yml` 里给出 `is_active = status = 'Active'` 这种派生维度
- 各实体都显式描述 join 关系和方向

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/People.yml#L42-L46
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Accounts.yml#L54-L57
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/semantic/entities/Company.yml#L85-L96

### C. “少工具”不等于“零约束”

即使工具很少，系统里依然有约束：

- 沙箱隔离
- 明确 workflow prompt
- 最大 step count 100
- SQL 执行接口单独受控
- 最终输出必须走 `FinalizeReport`

所以这不是完全放任模型，而是：

> **把约束从“替模型决策”改成“约束执行边界 + 给高质量资料”。**

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L75-L90

---

## 开源仓库确认与核心架构

### 仓库身份
- Repo：`vercel-labs/oss-data-analyst`
- URL：https://github.com/vercel-labs/oss-data-analyst
- 默认分支：`main`
- 研究时 HEAD：`af11371c872d79b7ad3d3d2e794fa339dd94e160`
- 最近主分支提交（研究时可见）：`Update usage of bash tools and sandbox`

### 技术栈
- Next.js
- Vercel AI SDK
- Vercel Sandbox
- bash-tool
- SQLite
- Zod

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/package.json#L1-L123

### 最小主链路
1. `runAgent()` 创建 sandbox
2. 把 semantic YAML 上传到 sandbox
3. agent 以 `bash + ExecuteSQL + FinalizeReport` 运行
4. query 在 SQLite 中执行
5. narrative 和结果一起输出

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/agent.ts#L65-L97
Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/src/lib/tools/execute-sqlite.ts#L8-L41

### 语义层设计特征
从当前 demo 看，这套 schema 更接近 **lightweight semantic catalog**，而不是完整 BI semantic layer 平台：

- 有实体
- 有维度 / 时间维度 / measures
- 有 joins
- 有描述和样例问题
- 但没有看到复杂的指标血缘、口径版本化、权限层、同义词系统、复杂 DSL 编译器

所以它说明的是一种**足够好即可用**的方向：

> 不一定要先造完整语义平台，先把“模型能读懂的半结构化数据字典”建起来，就已经能显著改善 text-to-SQL。

---

## 优势

### 1. 更少中介层，信息损失更少
模型直接看 YAML，比先经过 retrieval tool / schema summary tool / join path tool 更少失真。

### 2. 适应 schema 变化更自然
README 明确强调：增加自己的 schema 时，只需要更新 `src/semantic/`，无需改 agent 代码。

Source: https://github.com/vercel-labs/oss-data-analyst/blob/af11371c872d79b7ad3d3d2e794fa339dd94e160/README.md#L84-L91

### 3. 工具面更小，维护面更小
工具越多，越容易出现：

- tool schema 漂移
- retriever 选错上下文
- tool orchestration 失配
- prompt 与 tool 描述耦合失效

### 4. 非常利于调试
因为模型探索路径接近人类：

- 看了哪些文件
- grep 了什么关键字
- 为什么选这个 join
- 为什么改 SQL

都容易解释。

---

## 劣势 / 限制

### 1. benchmark 非常小
5 个 query 的成功率不足以说明普适“100%”。

### 2. 强依赖 semantic layer 质量
如果命名混乱、字段歧义严重、join 信息不完整，这套设计不会自动补全业务语义。

### 3. demo 与真实企业环境有距离
开源仓库目前是 SQLite + 小数据集 + 3 个实体，更适合说明架构，不足以代表复杂企业数仓。

### 4. bash 探索也会带来成本
虽然工具少了，但把大量探索责任交给模型，依然可能带来：

- 多次 grep / cat 的 token 成本
- 大 schema 下的搜索路径不稳定
- 对目录组织质量的更高要求

---

## 适用场景

适合：

- 已有较清晰 semantic layer / 数据字典的团队
- 想快速做可解释、可调试 text-to-SQL agent 的团队
- 数据表数量中小，或已有人为整理过主题域边界
- 希望先做最小可用系统，再逐步补约束的场景

不太适合：

- 数据定义极乱、历史包袱很重的仓库
- 超大 schema 且没有主题分区/命名规范的企业数仓
- 需要强权限治理、细粒度 row-level security、审计链路的高要求生产场景（需要更多控制层）

---

## 风险与成本

### 风险
- 把这篇文章误读成“任何 agent 都应该只保留 bash”
- 把“少工具”误解为“不需要设计约束”
- 高估小样本 benchmark 的泛化性

### 成本
- 必须补 semantic layer / 文档治理
- 要设计沙箱和 SQL 执行边界
- 仍需要建立 eval 体系验证不同问题类型的成功率

---

## 可复用清单（我们能直接抄的点）

1. **先做最小工具集版本**：`bash + SQL + finalize`，不要一开始造十几个 schema tool。
2. **把语义层做成人能读、模型也能 grep 的文件结构**。
3. **在 catalog 中补 example questions 与字段列表**，这对模型做 schema linking 很有帮助。
4. **在 entity 文件里显式写 joins、sample values、派生维度**。
5. **把约束放在执行边界与修复循环上**，而不是过度限制推理路径。
6. **用端到端问题集做 benchmark**，而不是只测 SQL 语法正确率。

---

## 原文要点摘录与中文释义（短引用对照）

1. 原文："We deleted most of it and stripped the agent down to a single tool: execute arbitrary bash commands."
   - 中文释义：他们主动删掉大部分自定义工具，只保留通用 bash 能力，让模型自己探索。

2. 原文："Claude gets direct access to your files and figures things out using `grep`, `cat`, and `ls`."
   - 中文释义：核心不是新算法，而是让模型像工程师一样读文件、搜索和建立心智模型。

3. 原文："100% success rate instead of 80%."
   - 中文释义：在其内部 5 个代表性查询上，端到端成功率从 80% 提升到 100%。

4. 原文："This only worked because our semantic layer was already good documentation."
   - 中文释义：真正关键不是 bash，而是 semantic layer 已经是高质量文档。

5. 原文："Start with the simplest possible architecture. Model + file system + goal."
   - 中文释义：对于 agent builder，建议先从“模型 + 文件系统 + 目标”这种最小架构开始。

---

## 图 / 非文本内容（保持顺序）

1. 图：d0 在 Slack 中回答数据问题的界面截图
   - 说明：展示产品形态，而非系统细节。
   - 链接：https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools

2. 表：old architecture vs file system agent benchmark 对比
   - 说明：文章最关键的证据表，展示时间、token、step、success rate 的变化。
   - 链接：https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools

---

## 延伸检索：类似方案 / 思路（跨来源补充）

### 1) Cube：semantic layer / metrics layer 思路
- URL：https://cube.dev/
- 总结：Cube 把指标、维度、joins、预聚合等业务语义集中到统一层，天然适合作为 text-to-SQL 的 grounding 层。
- 与主文区别：主文强调“少工具 + 文件系统探索”；Cube 更强调“先把语义建模体系做好”。
- 优劣势与取舍：
  - 优势：更适合复杂指标治理、共享业务口径。
  - 劣势：建设成本更高，不是轻量 demo 级别。

### 2) dbt Semantic Layer / MetricFlow
- URL：https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-semantic-layer
- 总结：把指标、实体、维度与时间语义形式化，给 BI / AI / 分析系统提供统一定义。
- 与主文区别：dbt 更偏“严谨指标治理”；Vercel 这篇更偏“让 agent 读文件自助探索”。
- 优劣势与取舍：
  - 优势：适合中大型团队、可治理性强。
  - 劣势：上手和迁移成本更高，对现有数据建模成熟度有要求。

### 3) MotherDuck / Text-to-SQL 工程实践（广义）
- URL：https://motherduck.com/blog/ai-text-to-sql-accuracy/ 
- 总结：很多 text-to-SQL 实践都会把提升点归结到 schema grounding、query repair、eval，而不只是模型选择。
- 与主文区别：更偏“如何提高 SQL 准确率”的专项讨论；Vercel 更像 agent architecture 视角。
- 优劣势与取舍：
  - 优势：更接近 text-to-SQL 单问题优化。
  - 劣势：未必覆盖完整 agent loop 与 sandbox 设计。

### 4) Anthropic：Effective context engineering for AI agents
- URL：https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- 总结：把 prompt 问题升级为 context pipeline 问题，强调“给模型正确上下文”比堆复杂指令更关键。
- 与主文区别：Anthropic 更偏方法论；Vercel 给出了一个非常具体的 file-system agent 案例。
- 优劣势与取舍：
  - 优势：适合作为上位设计原则。
  - 劣势：缺少像 Vercel 这样具体的 text-to-SQL demo。

---

## 对你的启发（面向后续研究）

如果后续要系统研究 text-to-SQL / 数据分析 agent，我建议按下面顺序继续：

1. **先研究 semantic layer**：Cube、dbt Semantic Layer、LookML、MetricFlow
2. **再研究 agent 最小工具集设计**：bash / file access / SQL execute / repair loop
3. **最后补 eval 框架**：按问题类型（聚合、过滤、join、多跳、时间窗口、模糊问题）分层评测

也就是说，真正值得复用的不是“删掉 80% tools”，而是：

> **把数据语义变成模型能直接读取、搜索、验证的上下文资产。**

---

## 参考与证据
- 博客原文：https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools
- 开源仓库：https://github.com/vercel-labs/oss-data-analyst
- 仓库主页（研究时 HEAD）：https://github.com/vercel-labs/oss-data-analyst/tree/af11371c872d79b7ad3d3d2e794fa339dd94e160
