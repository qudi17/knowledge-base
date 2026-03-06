# Knowledge Base Style Guide

本文件定义知识库的写作与归档规范，目标是让研究产出在不同 session / 不同时间依然保持一致、可对比、可追溯。

> 核心原则：结论优先、证据可追溯、结构可复用。

---

## 0. 必读文件（启动时检查）

为保证跨 session 行为一致，每次开始知识库相关工作前，先检查/遵循以下文件：

1. `workspace-github-researcher/MEMORY.md`（你的边界与偏好）
2. `knowledge-base/README.md`（全库索引：Projects + Research 表格）
3. `knowledge-base/STYLEGUIDE.md`（本文件：写作/归档/引用规范）
4. `knowledge-base/research/README.md`（博客研究方法与报告模板）
5. `knowledge-base/solution/rag/README.md`（RAG 领域方法论；仅方法论，不维护项目索引）

---

## 1. 目录组织

### 1.1 领域（solution）研究

- 领域方法论：`solution/<domain>/README.md`
- 项目研究：`solution/<domain>/<project>/`
  - 项目索引（必须）：`README.md`
  - 专题文档：`<topic>.md`

> 说明：项目索引总表在知识库根目录 `README.md` 维护；各 domain 的方法论 README 不维护项目索引（除非你明确要求）。

### 1.2 博客/文章研究（research）

- 路径：`research/<domain>/<blog-name>.md`
- 每新增一篇报告：必须在根目录 `README.md` 的 Research 表格新增一行。

---

## 2. 根目录索引维护

- 根目录 `README.md` 必须包含：
  - `Projects`（Markdown 表格，含可跳转链接）
  - `Research`（Markdown 表格，含可跳转链接）
- 状态枚举固定为：`active` / `paused` / `done`

---

## 3. 单个项目（project）最小产出集（RAG 领域）

RAG 项目默认至少覆盖以下 5 个专题（可合并/拆分，但内容维度必须覆盖）：

1. `analysis.md`（或同义文件名）：架构、模块、关键设计取舍
2. `document-pipeline.md`：加载/解析/清洗/去重/元数据/管道
3. `chunking.md`：分块策略、参数、中文优化、源码要点
4. `retrieval.md`：召回/融合/过滤/权限/重排（如有）
5. `evaluation.md`：指标体系、数据集、自动化评测流程、验收口径

> 决策声明：文档只给建议（优势/劣势/适用场景/风险/证据），不写“用/不用”的最终决策。

---

## 4. Prompts 规范（如涉及提示词）

- 必须新增：`solution/<domain>/<project>/prompts.md`
- `prompts.md` 用于：
  - 罗列所有提示词
  - 标注用途、变量、版本、注意事项
  - 如来自代码/仓库：必须附源链接（见 5）

---

## 5. 代码片段引用规范（强制）

只要文档中出现代码片段（无论来自哪个 repo），必须提供**源文件+行号**链接，且建议使用 GitHub permalink（带 commit hash）：

- `https://github.com/<owner>/<repo>/blob/<commit>/<path>#L10-L42`

在代码块上方或下方追加一行：

- `Source: <url>#Lx-Ly`

> 目标：一键跳回原始上下文，避免二次搜索或断章取义。

---

## 6. 每篇文档建议结构（结论优先）

- TL;DR（3~7 条要点）
- 背景 / 要解决的问题
- 关键设计与实现（流程/接口/数据结构）
- 优势
- 劣势/限制
- 适用场景
- 风险与成本
- 参考与证据（链接）
