# Text-to-SQL / Data Analyst Agent 方法论

本目录沉淀面向真实业务场景的 text-to-SQL / data analyst agent 方法论，重点关注：

- semantic layer / schema grounding
- tool 最小化设计
- eval 与测试标准
- 从 demo 到生产的演进路线

> 目标：不是做“能跑 demo 的自然语言查数”，而是做**结果可验证、口径可追踪、风险可控**的分析代理。

---

## 当前内容

### 研究 / 方法论
- [真实业务 text-to-SQL agent 测试标准（v1）](./real-world-evaluation-standard-v1.md)
- [内部汇报版 v1](./internal-brief-v1.md)
- [Benchmark 数据格式模板（v1）](./benchmark-schema-v1.md)
- [面向产品的 Text-to-SQL 测试框架（v2）](./product-test-framework-v2.md)
- [产品测试框架最小 Python Skeleton](./product-test-framework-skeleton/README.md)
- [text-to-SQL / Data Analyst Agent 横向方案地图](./landscape.md)
- [semantic layer 横向对比：Cube vs dbt Semantic Layer / MetricFlow vs LookML vs lightweight YAML](./semantic-layer-comparison.md)

---

## 核心共识

### 1. 先定义“成功”，再设计 agent
如果没有统一测试标准，团队很容易把：
- SQL 能执行
- 回答看起来像对的
- benchmark case 漂亮

误当成“系统真的可用”。

### 2. 业务场景里，最危险的是“看起来成功但答案错了”
高风险错误通常不是语法失败，而是：
- join 错导致重复计数
- 指标口径错
- 时间字段错
- 模糊问题没澄清
- 权限越界

### 3. 验证体系应该优先于复杂架构
推荐建设顺序：
1. 测试标准 / benchmark taxonomy
2. semantic layer
3. 最小 agent toolchain
4. 评测自动化 / 回归体系

---

## 后续建议

如果继续扩展本目录，建议优先补：
- benchmark 样例格式（JSON schema）
- failure taxonomy（失败类型分层）
- clarification policy（何时必须澄清）
- gold / silver / bronze 测试集分级
