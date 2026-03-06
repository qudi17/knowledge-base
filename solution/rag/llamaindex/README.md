# LlamaIndex 研究笔记

本目录整理了 LlamaIndex 框架的深度研究内容，涵盖架构分析、文档处理流程、分块策略等核心主题。

---

## 📚 文档列表

### 1. [LlamaIndex 架构分析与对比](./llamaindex-analysis.md)
**内容**：
- LlamaIndex 核心架构（Ingestion Pipeline/Indexes/Retrievers）
- 与典型自研方案（参考实现）的优劣势对比（示例）
- 借鉴建议（Transformation 链/Node 抽象/去重机制）

**核心结论**：
- 不直接使用 LlamaIndex（基础设施已定/中文优化/企业集成/成本控制）
- 借鉴优秀设计（Transformation 链/Node 抽象/去重机制/混合检索）
- 自研核心 + 借鉴设计 = 最适合企业场景的 RAG 系统

---

### 2. [LlamaIndex 文档处理流程详解](./llamaindex-document-pipeline.md)
**内容**：
- 完整流程：加载→解析→分块→Embedding→索引→检索
- PDF/Word/Excel 三种格式的处理方式
- 免费方案（PyMuPDF/python-docx/pandas）vs 商业方案（LlamaParse）
- 企业级示例代码（含异步/批量/缓存优化）
- 成本估算和中文支持说明

**核心洞察**：
- SimpleDirectoryReader 自动识别格式（推荐）
- 关键文档用 LlamaParse（表格/复杂布局）
- 中文分块优化：chunk_size=512, overlap=50
- Ingestion Pipeline 内置去重机制

---

### 3. [分块策略选择指南](./chunking-strategies.md)
**内容**：
- 10 种分块策略详解（Sentence/Token/Semantic/Hierarchical 等）
- 选择决策树和企业场景推荐配置
- 参数调优指南（chunk_size/overlap/中文优化）
- 常见陷阱和 A/B 测试方法
- SmartChunker 混合策略代码示例

**核心建议**：
1. 从简单开始 - SentenceSplitter(512, 50) 适合 80% 场景
2. 按类型选择 - 不同文档用不同策略
3. 测试驱动 - A/B 测试选最优
4. 分层检索 - 长文档用 Hierarchical
5. 中文优化 - 更大的 chunk_size 和 overlap

---

### 4. [分块策略源码解析与对比](./chunking-source-code-analysis.md)
**内容**：
- 基类 NodeParser 实现（抽象方法/Node 构建/关系管理）
- SentenceSplitter 源码（句子分割/合并算法/中文优化）
- TokenTextSplitter 源码（token 分割/tiktoken 集成）
- SemanticSplitter 源码（embedding 相似度/切分点算法/成本分析）
- HierarchicalNodeParser 源码（多层级分割/父子关系建立）
- MarkdownNodeParser 源码（标题识别/路径保留）
- 完整对比表（实现复杂度/功能/适用场景）

**核心洞察**：
- SentenceSplitter: 按句子/段落分割，贪心合并算法，保持语义完整
- TokenTextSplitter: 按 token 分割，滑动窗口算法，成本精确可控
- SemanticSplitter: 基于 embedding 余弦相似度，在语义边界切分，成本高
- HierarchicalNodeParser: 多层级分割，建立父子关系，支持递归检索
- MarkdownNodeParser: 正则识别标题，保留标题路径作为元数据

---

## 📊 快速对比表

| 文档 | 主题 | 核心内容 | 推荐场景 |
|------|------|---------|---------|
| [架构分析](./llamaindex-analysis.md) | 框架对比 | 核心组件/优劣势/借鉴建议 | 技术选型 |
| [文档处理流程](./llamaindex-document-pipeline.md) | 实践指南 | 格式解析/管道配置/成本估算 | 开发实施 |
| [分块策略选择](./chunking-strategies.md) | 策略指南 | 10 种策略/决策树/调优建议 | 参数配置 |
| [源码解析](./chunking-source-code-analysis.md) | 深度分析 | 源码实现/算法对比/优化建议 | 自研参考 |

---

## 🎯 阅读建议

### 新手入门路径
```
1. 架构分析 → 了解 LlamaIndex 是什么
2. 文档处理流程 → 学习如何使用
3. 分块策略选择 → 掌握核心配置
4. 源码解析 → 深入理解原理
```

### 技术选型路径
```
1. 架构分析 → 对比优劣势
2. 文档处理流程 → 评估成本
3. 分块策略选择 → 确定配置
→ 决策：使用 LlamaIndex 还是自研
```

### 自研参考路径
```
1. 架构分析 → 借鉴设计
2. 源码解析 → 学习实现
3. 文档处理流程 → 参考流程
→ 输出：自研 RAG 系统
```

---

## 💡 核心结论

### 为什么不完全使用 LlamaIndex？

| 原因 | 说明 |
|------|------|
| 基础设施已定 | 已有 PostgreSQL/ES/Neo4j/Redis |
| 中文优化需求 | LlamaIndex 对中文支持一般 |
| 企业集成需求 | 需要深度定制 Confluence/SharePoint |
| 成本控制 | LlamaParse 大规模使用成本高 |

### 借鉴什么？

| 设计 | 说明 |
|------|------|
| Transformation 链 | 优雅的可组合设计 |
| Node 抽象 | 统一中间表示 |
| 去重机制 | doc_id + hash |
| 混合检索策略 | RRF 融合算法 |

### 最终策略

```
自研核心 + 借鉴设计 = 最适合企业场景的 RAG 系统
```

---

## 📁 目录结构

```
llamaindex/
├── README.md                        # 本文件（索引）
├── llamaindex-analysis.md           # 架构分析与对比
├── llamaindex-document-pipeline.md  # 文档处理流程
├── chunking-strategies.md           # 分块策略选择
└── chunking-source-code-analysis.md # 分块策略源码
```

---

## 📝 更新记录

| 日期 | 内容 |
|------|------|
| 2026-03-05 | 初始整理，创建本目录 |

---

## 🔗 相关文档

- [RAG 方案总览](../README.md)
- [架构设计](../architecture.md)
- [实施指南](../implementation.md)
- [数据库设计](../sql-schema.md)
- [外部数据集成](../data-integration.md)
- [Parser 底层实现](../parser-implementation.md)
