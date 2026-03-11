# text-to-SQL / Data Analyst Agent 横向方案地图

本文件用于从横向视角梳理 text-to-SQL / data analyst agent 的主流技术路线，帮助在进入真实公司场景前，先建立一张“方案地图”。

目标不是直接选型，而是回答：

- 现在有哪些主流路线？
- 每条路线真正解决什么问题？
- 它依赖什么前提？
- 它最容易在哪些地方失败？
- 应该如何与评测标准对应起来？

---

## TL;DR
1. 目前 text-to-SQL / data analyst agent 可以粗分为 4 条主线：**semantic layer 路线、agent 架构路线、eval 路线、安全治理路线**。
2. 真正决定上限的，通常不是 prompt，而是 **语义层质量 + 验证体系 + 风险控制**。
3. 不同路线不是互斥关系，而是常常叠加：
   - semantic layer 负责“让模型少猜”
   - agent 架构负责“让模型怎么查、怎么试、怎么收尾”
   - eval 负责“判断到底行不行”
   - safety / governance 负责“保证不出事故”
4. 如果一个公司要落地真实业务场景，推荐顺序通常是：
   - **先定测试标准**
   - 再看 semantic layer 能力
   - 再选 agent 最小闭环
   - 最后补安全治理和生产化能力
5. 横向比较方案时，不要先问“哪个最先进”，而要先问：
   - 我们的数据语义是否已经被治理？
   - 我们的核心风险到底是什么？
   - 我们更缺 grounding，还是更缺 orchestration，还是更缺 eval？

---

## 一、总览：四条主线

### 1. semantic layer 路线
核心目标：
- 让模型理解业务实体、指标、维度、时间字段、join 关系
- 把“需要猜”的部分转成“可以查”的部分

典型代表：
- Cube
- dbt Semantic Layer / MetricFlow
- LookML
- Vercel `oss-data-analyst` 这种 lightweight YAML semantic layer

### 2. agent 架构路线
核心目标：
- 决定模型如何搜索 schema
- 决定 SQL 如何生成、执行、修复
- 决定什么时候需要澄清、什么时候应该收尾

典型代表：
- file-system agent
- retrieval + SQL generation
- planner / executor 两阶段架构
- clarification-first 流程

### 3. eval 路线
核心目标：
- 不只看 SQL 能不能跑，而是看结果、语义、澄清和风控是否正确
- 为模型升级、prompt 调整、semantic layer 修改提供统一回归基线

典型代表：
- 学术 benchmark（Spider、BIRD 等）
- 工程化内部 benchmark
- business-semantics eval
- clarification / safety eval

### 4. safety / governance 路线
核心目标：
- 控制权限、审计、敏感数据访问和错误传播风险
- 让系统能进入真实业务流程，而不只是 demo

典型能力：
- read-only SQL guardrail
- query timeout / row limit
- permission boundary
- audit log / trace
- 失败复盘 taxonomy

---

## 二、主线 1：semantic layer 路线

## 2.1 为什么 semantic layer 是第一优先级

text-to-SQL 的核心难点，不是 SQL 语法，而是：

- schema linking
- metric semantics
- join path
- time semantics
- enum grounding

如果这些问题没有被结构化整理，模型就只能猜。

所以 semantic layer 路线的本质是：

> **把业务语义从“散落在数据库和人脑中”变成“模型可以读取和检索的显式资产”。**

---

## 2.2 主要分支

### A. heavyweight semantic layer
代表：
- Cube
- dbt Semantic Layer / MetricFlow
- LookML

特点：
- 有完整指标建模体系
- 可承载复杂口径治理
- 通常支持 BI / metrics / analytics 生态复用

优势：
- 指标治理能力强
- 适合中大型组织
- 与业务分析流程结合更深

限制：
- 建设成本高
- 上手门槛高
- 需要数据团队长期维护

适用前提：
- 已有较成熟数据平台
- 指标定义复杂且必须统一
- 多团队共享指标口径

### B. lightweight semantic layer
代表：
- Vercel `oss-data-analyst` 风格的 YAML / catalog 方案
- 自定义 schema docs + entity specs

特点：
- 轻量、可快速启动
- 更偏 agent grounding，而不是完整 metrics 平台

优势：
- 成本低
- 适合试点
- 对 agent 友好

限制：
- 难以支撑复杂治理
- 容易缺少版本化、权限、同义词、血缘等机制

适用前提：
- 想先验证 agent 能力
- 数据域还不算特别复杂
- 允许先小范围试点

---

## 2.3 这一主线最常见的失败点

- 只有字段字典，没有业务定义
- join 关系不完整
- 时间字段没有被区分语义
- sample values / enum 语义缺失
- 指标定义散落在 SQL 和人脑里

### 对应评测重点
应该重点看：
- Semantic Accuracy
- Time Semantics
- Join Correctness
- Clarification 需求是否下降

---

## 三、主线 2：agent 架构路线

## 3.1 这条路线真正解决什么

即使 semantic layer 很好，agent 仍然要解决：

- 先看什么信息
- 怎么收敛到正确 schema
- SQL 出错后怎么修
- 遇到歧义时是否澄清
- 最终如何输出结果

所以 agent 架构路线解决的是：

> **推理流程与执行闭环。**

---

## 3.2 主要分支

### A. file-system agent
代表：
- Vercel d0 / `oss-data-analyst`

特点：
- 给模型文件浏览能力
- 用 `cat` / `grep` / `ls` 直接探索 semantic files
- 工具数很少

优势：
- 信息损失小
- 调试路径可解释
- 适合 schema 变化频繁的场景

限制：
- 强依赖文件组织质量
- 大 schema 下搜索成本可能上升
- 没有结构化检索时可能盲搜

适用前提：
- semantic layer 清晰
- 目录结构良好
- 想要最小工具闭环

### B. retrieval + SQL generation
特点：
- 先通过 retriever 找相关 schema / 文档
- 再把结果送入 SQL 生成器

优势：
- 在大 schema 上更可控
- 能减少盲目搜索

限制：
- retriever 如果选错上下文，后面都会错
- 有“中介层失真”风险

适用前提：
- schema 很大
- 已有较好的检索基础设施
- 想控制 token 和探索范围

### C. planner / executor 两阶段
特点：
- 先做任务规划或 query plan
- 再由执行模块生成/运行 SQL

优势：
- 复杂任务更容易显式拆解
- 适合多步分析和高复杂 query

限制：
- 流程更重
- 维护成本更高
- 规划层如果错，会带偏执行层

适用前提：
- 问题复杂度高
- 希望有明确中间推理结构

### D. clarification-first agent
特点：
- 对高风险模糊问题优先澄清
- 把“乱答”风险控制放在第一位

优势：
- 风险更低
- 特别适合业务口径复杂场景

限制：
- 用户体验可能更慢
- 需要定义清晰的澄清策略

适用前提：
- 高风险词很多（收入、活跃、留存、客户价值）
- 业务概念歧义大
- 公司更重视正确性而非首答速度

---

## 3.3 这一主线最常见的失败点

- 工具太多，导致链路脆弱
- tool schema 与 prompt 描述脱节
- SQL error recovery 策略混乱
- clarification policy 不清晰
- 收尾阶段没有结构化输出

### 对应评测重点
应该重点看：
- Execution Rate
- Retry 行为
- Clarification Quality
- Efficiency（latency / token / steps）

---

## 四、主线 3：eval 路线

## 4.1 为什么 eval 是单独一条主线

没有 eval，所有方案对比都容易失真。

一个系统可能：
- SQL 执行率很高
- narrative 很像样
- demo 问题答得不错

但在真实业务里仍然经常：
- join 错
- 指标口径错
- 该澄清不澄清
- 高风险问题乱答

所以 eval 不是“收尾工作”，而是：

> **决定整个系统是否可进入业务流程的硬基线。**

---

## 4.2 主要分支

### A. 学术 benchmark 路线
代表：
- Spider
- BIRD
- 其他 text-to-SQL 数据集

优势：
- 有公共可比性
- 适合做模型能力基线对比

限制：
- 很难覆盖真实公司内部语义、权限和口径问题
- 对澄清、风险控制、narrative 评估有限

### B. 工程化内部 benchmark 路线
特点：
- 用公司自己的问题、口径和风险场景建题库
- 可用于版本回归

优势：
- 最贴近真实业务
- 真正支撑上线决策

限制：
- 维护成本高
- 需要 owner 持续更新

### C. 风险专项 eval 路线
特点：
- 单独测模糊问题、权限问题、敏感信息、异常结果

优势：
- 能防止“整体分数不错，但关键事故仍会发生”

限制：
- 需要额外设计 rubric

---

## 4.3 这一主线最常见的失败点

- 只测 SQL execution，不测业务正确性
- 题库太小，只覆盖漂亮 case
- benchmark 不版本化
- 缺少 high-risk / clarification / permission 类题目

### 对应评测重点
应该重点看：
- Result Correctness
- Semantic Accuracy
- Failure Taxonomy 覆盖度
- Gold 集表现

---

## 五、主线 4：safety / governance 路线

## 5.1 为什么这条路线不能后补

很多团队做 demo 时会把安全放到最后，但到了真实公司场景，安全和治理往往决定系统能否上线。

因为实际业务里很常见：
- 用户会问模糊问题
- 可能会问敏感用户信息
- 可能会要求导出名单或联系方式
- 不同角色看到的数据权限不同

所以 safety / governance 路线本质上解决的是：

> **即使模型“会答”，也不代表它“应该答”。**

---

## 5.2 主要能力点

### A. query guardrails
- 只读 SQL
- 禁止 DDL / DML
- timeout / row limit
- 危险关键字限制

### B. permission boundary
- 按角色限制数据访问范围
- 敏感字段脱敏或拒答
- 某些题必须通过审批流程

### C. audit / trace
- 保留问题、SQL、结果、tool trace、最终 narrative
- 便于追责与复盘

### D. failure governance
- 失败类型归类
- 一票否决项
- 上线门槛和变更回归要求

---

## 5.3 这一主线最常见的失败点

- 把“只读”写在 prompt 里，但没有真限制执行层
- 没有权限题 benchmark
- 没有 trace，出错后无法复盘
- 没有上线门槛，靠主观印象做决策

### 对应评测重点
应该重点看：
- 越权回答率
- 敏感数据暴露率
- Gold 集风险题表现
- Audit 完整性

---

## 六、怎么把四条路线放到一起看

## 6.1 它们不是替代关系，而是分工关系

可以用一句话概括：

- **semantic layer**：让模型少猜
- **agent architecture**：让模型知道怎么查、怎么试、怎么收尾
- **eval**：判断模型到底行不行
- **safety / governance**：保证系统不会出事故

---

## 6.2 常见公司场景与优先级建议

### 场景 A：数据定义很乱，但业务方已经很想用
优先级：
1. 测试标准
2. semantic layer
3. clarification policy
4. 最小 agent

因为这时最大问题是“语义缺失”，不是 agent 不够聪明。

### 场景 B：语义层已经比较成熟，但 agent 不稳定
优先级：
1. 测试标准
2. agent 架构优化
3. error recovery / clarification
4. 效率优化

### 场景 C：demo 效果不错，但上线风险高
优先级：
1. safety / governance
2. Gold 集评测
3. trace / audit
4. 权限体系接入

### 场景 D：想比较多条技术路线
优先级：
1. 统一 eval 基线
2. 用同一题库比较 semantic layer + agent 组合
3. 再看效率与维护成本

---

## 七、建议的比较框架

如果后续要拿不同方案做横向对比，建议统一按下表看：

| 维度 | 关键问题 |
|---|---|
| 语义建模能力 | 能否表达实体、指标、时间、join、同义词、口径 |
| grounding 方式 | 模型是直接读文件、走检索，还是走 tool 摘要 |
| agent 闭环 | 如何搜索、生成 SQL、修复、澄清、收尾 |
| 评测可用性 | 是否能接公司内部 benchmark |
| 风险控制 | 是否支持只读、权限、审计、拒答 |
| 工程成本 | 搭建、维护、扩展、版本管理成本 |
| 适用组织阶段 | 试点 / 增长中 / 成熟数据团队 |

---

## 八、当前阶段最推荐的研究顺序

基于你现在的目标，我建议横向扩展按这个顺序继续：

### Step 1：semantic layer 方案对比
优先对比：
- Cube
- dbt Semantic Layer / MetricFlow
- LookML
- lightweight YAML semantic layer

这是最重要的一步，因为它决定“模型到底靠什么理解业务”。

### Step 2：agent 架构对比
重点看：
- file-system agent
- retrieval + generation
- clarification-first

### Step 3：eval / benchmark 对比
重点看：
- 学术 benchmark 能借鉴什么
- 企业内部 benchmark 应怎么改造

### Step 4：safety / governance 对比
重点看：
- 生产环境必须补哪些防线

---

## 九、结论

如果要用一句话总结这张横向方案地图：

> **text-to-SQL / data analyst agent 不是单点技术问题，而是“语义层 + agent 闭环 + 评测体系 + 风险治理”的组合工程。**

所以真正好的方案，不一定是某一维最强，而是：

- 能适配你们当前数据治理成熟度
- 能接上你们内部的测试标准
- 能在风险可控前提下逐步上线

这才是现实世界里最重要的判断标准。
