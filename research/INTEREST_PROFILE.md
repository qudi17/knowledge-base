# 兴趣画像（Blog/Article 选题偏好）

本文件用于沉淀“你更感兴趣的技术博客主题画像”，用于后续在多来源抓取/筛选文章时做加权排序。

> 背景：根据 Anthropic Engineering 的文章风格与主题，总结出更贴近你需求的方向（LLM 工程化、方案技巧、Agent 工程实践）。

---

## 0. 总体目标

优先抓取与分析：**LLM 工程化 / Agent 工程实践 / RAG 与检索增强 / Evals 与评测 / Tool use 与安全隔离** 相关内容。

---

## 1. 主题 Taxonomy（用于分类与检索）

### T1. Agent 工程化（构建与落地）
- 关键词（英文/中文）：agentic, agents, workflow, orchestration, long-running agents, harness, 工具调用, 代理流程, 多代理
- 典型关注点：
  - 端到端工作流设计（规划/执行/反思）
  - 长任务可靠性（超时、重试、断点续跑、状态机）
  - 多代理协作与分工

### T2. Context Engineering（上下文工程）
- 关键词：context engineering, prompt engineering, context retrieval, memory, context window, grounding, 上下文, 提示词, 记忆
- 典型关注点：
  - “上下文工程 vs 提示词工程”的方法论
  - 上下文组成：指令/工具/示例/记忆/外部知识
  - 检索与动态构建上下文（RAG/agentic search）

### T3. Tool Use / MCP / Code Execution（工具与执行）
- 关键词：tool use, function calling, MCP, code execution, sandbox, extensions, 工具调用, 执行环境
- 典型关注点：
  - 工具接口设计（schema、错误处理、幂等）
  - 工具链与平台化（插件/扩展）
  - 代码执行/外部动作的安全边界

### T4. 安全与隔离（安全工程化）
- 关键词：sandboxing, security, permissions, isolation, policy, adversarial, AI-resistant, 安全, 沙箱, 权限
- 典型关注点：
  - 从“权限提示”到“强隔离”的设计
  - 风险建模与默认安全策略

### T5. Evals / Benchmarking（评测体系）
- 关键词：evals, evaluation, benchmark, SWE-bench, reliability, measurement noise, regression, 评测, 基准, 回归
- 典型关注点：
  - 评测结构（任务集、评分器、判定标准）
  - 工程噪声/环境波动对结论的影响
  - 评测驱动迭代（从 0 到 1 的 eval roadmap）

### T6. RAG / Retrieval / Reranking（检索增强与信息注入）
- 关键词：RAG, retrieval, reranking, contextual retrieval, embeddings, hybrid search, reranker, 检索, 重排
- 典型关注点：
  - 解决大知识库场景下的准确性/可控性
  - 引入“上下文检索 + 重排”提升效果

### T7. 工程实践的“可操作技巧”
- 关键词：best practices, tips, playbook, postmortem, practical guide, 经验总结, 复盘
- 典型关注点：
  - 可直接迁移的工程技巧与反模式
  - 故障复盘、可靠性工程

---

## 2. 选文加权规则（简版）

用于从各 source 的文章列表中排序：

- AI 权重：取 `SOURCES.md` 里的 high/medium/low 作为基础权重
- 主题命中：
  - 命中 T1~T6 任一主题：+2
  - 命中 T2/T3/T5（更贴近 Anthropic 风格与 LLM 工程化）：额外 +1
  - 仅泛 AI 新闻/市场解读，无工程细节：-2
- 证据密度：标题/摘要出现 `how we built`, `best practices`, `postmortem`, `evaluation`, `benchmark` 等：+1

---

## 3. 从 Anthropic Engineering 反推的“你可能最爱读”的文章类型

- 讲清楚 **方法论 + 可执行步骤**（不是纯观点）
- 有 **工程结构**（harness / sandbox / eval framework / pipeline）
- 有 **明确 trade-off**（优势/劣势/成本/风险）

参考（示例页面）：
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://www.anthropic.com/engineering/contextual-retrieval
- https://www.anthropic.com/engineering/claude-code-sandboxing
