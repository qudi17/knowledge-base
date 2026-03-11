# 真实业务 text-to-SQL / Data Analyst Agent 测试标准（内部汇报版 v1）

> 面向公司内部沟通、立项、对齐与评审使用。
> 详细版见：[real-world-evaluation-standard-v1.md](./real-world-evaluation-standard-v1.md)

---

## 1. 为什么要先做测试标准

在真实业务里，text-to-SQL 系统最危险的问题不是“SQL 跑不起来”，而是：

- SQL 成功执行
- 回答看起来合理
- 但结果实际上是错的

典型高风险错误：
- join 错导致重复计数
- 指标口径错
- 时间字段错
- 模糊问题没澄清
- 权限越界

**结论：**
在公司内部落地前，必须先定义统一测试标准，再讨论模型、prompt、semantic layer 或 agent 架构。

---

## 2. 我们要评估的不是“会不会写 SQL”，而是“能不能进入业务场景”

建议统一用以下 4 层成功定义：

1. **SQL 可执行**
   - 语法正确
   - 字段/表引用正确

2. **结果正确**
   - 与 golden result 一致
   - 聚合 / 去重 / 排序 / 过滤正确

3. **语义正确**
   - 指标定义正确
   - 时间字段正确
   - join 路径正确

4. **回答可用**
   - 结论清晰
   - 说明假设与限制
   - 需要澄清时先澄清

---

## 3. 建议的测试框架

### 四层题库

#### L1. Foundation
基础题，验证链路没坏：
- 单表计数
- 单表聚合
- 简单过滤
- top N

#### L2. Business Common
高频业务题：
- 双表 join
- 多条件过滤
- 时间窗口分析
- 排名分析

#### L3. Analytical Hard
复杂分析题：
- 多跳 join
- 留存 / funnel / cohort
- 同比 / 环比
- 条件指标

#### L4. Risk & Governance
高风险题：
- 模糊问题
- 口径冲突
- 权限问题
- 空结果 / 异常结果

---

## 4. 建议的评分方式

不要只用“对 / 错”。
建议使用 **10 分制**：

| 维度 | 分值 |
|---|---:|
| SQL 可执行 | 1 |
| 结果正确 | 3 |
| 语义正确 | 3 |
| 澄清 / 风险处理 | 2 |
| narrative 可用 | 1 |

### 一票否决项
以下任一出现，应直接判失败：
- 权限越界
- 敏感数据暴露
- 模糊高风险问题未澄清直接回答
- 明显错误 join 导致业务结论错误

---

## 5. 组织分工建议

### 数据 / 指标 Owner
- 定义 golden truth
- 审核高风险题
- 确认合法业务口径

### 平台 / Agent Owner
- 维护 semantic layer / prompt / tool 配置
- 维护 benchmark 和回归流程
- 复盘失败原因

### 使用方代表（业务 / 分析）
- 提供真实问题样本
- 标注哪些问题应澄清
- 评审回答是否可用

### 安全 / 合规（如适用）
- 审核权限与敏感数据题

---

## 6. 建议的上线门槛（v1）

### 内部试用
- Execution Rate ≥ 95%
- Result Correctness ≥ 85%
- Semantic Accuracy ≥ 80%
- 越权回答率 = 0

### 灰度
- Execution Rate ≥ 97%
- Result Correctness ≥ 90%
- Semantic Accuracy ≥ 88%
- Clarification 正确率 ≥ 85%
- 越权回答率 = 0

### 正式上线
- Execution Rate ≥ 98%
- Result Correctness ≥ 93%
- Semantic Accuracy ≥ 90%
- 高风险题正确处理率 ≥ 95%
- Gold 集无一票否决项

---

## 7. 建议的落地步骤

### Phase 1：统一标准
- 确认成功定义
- 确认题型 taxonomy
- 确认评分规则与一票否决项

### Phase 2：建题库
- 先做 50 题
- 覆盖基础题、高频业务题和高风险题
- 每题指定 owner

### Phase 3：接自动评测
- 自动执行问题
- 自动收集 SQL / result / narrative / trace
- 自动输出分数与失败分类

### Phase 4：建回归流程
- 模型升级必须回归
- semantic layer 改动必须回归
- prompt / tool 改动必须回归

---

## 8. 推荐内部推进时的核心话术

可以直接用下面这句做内部对齐：

> 我们不是在验证“LLM 会不会写 SQL”，而是在验证“这个系统能不能在真实业务里稳定给出正确、可解释、可治理的答案”。

---

## 9. 现阶段建议

如果要快速启动，公司内 v1 建议先做：

- 50 题 benchmark
- 4 层题库
- 10 分制评分
- 一票否决项
- Bronze / Silver / Gold 三层数据集

这已经足够支撑第一轮内部验证与方案比较。
