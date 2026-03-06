# Effective context engineering for AI agents（研究报告）

- 来源：https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

## 元信息
- 作者：未在页面显式展示（如后续需要可再补）
- 文章发布日期：2025-09-29
- 报告生成日期：2026-03-06
- Domain（自动生成）：context-engineering
- 关键词：context engineering, prompt engineering, context window, context rot, attention budget, agentic search, RAG

---

## TL;DR（结论优先）
1. **“上下文工程”比“提示词工程”更像一套运行时系统设计**：核心是每一轮推理时决定把哪些 token 放进上下文、以什么结构放。
2. 上下文是有限资源且有**边际递减**：越长不一定越好，存在类似“context rot”的退化现象，因此必须做选择、压缩、检索与结构化。
3. 对 Agent 来说，上下文不只是对话历史，还包括：系统指令、工具、MCP、外部数据、记忆与检索结果等，且需要**循环精炼**。
4. 推荐把问题从“写更好的 prompt”升级为“构建一个**可控的上下文管道（context pipeline）**”，通过检索/摘要/裁剪/排序提升稳定性。
5. 对你关心的 LLM 工程化而言，这篇文章更像一份**方法论基线**：用于指导后续从各 source 挑选“有工程结构/可操作步骤”的文章。

---

## 文章解决的问题（Problem）

文章试图回答：
- 当我们从一次性任务（one-shot）走向多轮、长时程（long-horizon）的 AI Agent 时，**如何管理不断增长的上下文**，让模型稳定地产生期望行为？

关键前提：
- LLM 的上下文窗口有限；并且上下文变长会带来注意力稀释与信息提取能力下降（文中称“context rot”）。

---

## 方案拆解（Approach）

### 1) 概念升级：Context engineering vs Prompt engineering
- Prompt engineering：侧重“写/组织指令”（尤其 system prompt）。
- Context engineering：侧重“推理时刻的上下文配置”，包含 prompt 之外的所有信息与结构化方式。

### 2) 关键动机：上下文是有限且会退化的资源
- 文章强调：上下文越长，模型对其中信息的有效利用可能下降。
- 因此需要把上下文当作“注意力预算（attention budget）”来管理：每新增 token 都有机会成本。

### 3) 面向 Agent 的上下文组成（文章给出的方向性清单）
在 Agent loop 中，潜在上下文来源不断增长，至少包括：
- system instructions（系统指令）
- tools（工具说明/接口）
- MCP（Model Context Protocol）相关上下文
- external data（外部数据：检索、数据库、文件等）
- message history（消息历史）

重点不在“全塞进去”，而在“每轮推理前做一次再构建/再精选”。

### 4) Context retrieval & agentic search
文章明确提出：通过检索与 agentic search，把“需要的证据”动态注入上下文，而不是靠长对话历史硬扛。

---

## 关键细节（参数/流程/边界条件）

- 本文更偏方法论与心智模型，**没有给出可直接照抄的具体参数表**（例如 chunk size / overlap / top-k 等）。
- 但给出的工程启发是：
  - 把“上下文构建”当作 pipeline：包含检索、过滤、压缩（摘要/结构化）、排序、裁剪等步骤。
  - 关注长时程任务：上下文在循环中需要持续精炼，而不是只累加。

---

## 优势（对你场景的价值）
- 很适合作为你要的“LLM 工程化/技巧”的**纲领性文章**：把关注点从 prompt 文案转到系统化的上下文管理。
- 与你后续做 RAG/Agent 研究高度耦合：context pipeline 本质上是 RAG/记忆/工具调用的组合工程。
- 可以直接转化为你的“选文偏好”：
  - 偏好有 pipeline / harness / eval / sandbox 等工程结构的文章
  - 偏好讨论 trade-off 与可控性的文章

---

## 劣势 / 限制
- 偏方法论，**落地细节较少**：缺少明确可复现的实验设置与参数建议。
- 没有提供对比实验数据来量化“context engineering 策略带来的收益”。

---

## 适用场景
- 构建多轮、长时程的 agent（coding agent、research agent、ops agent）。
- 已经发现“上下文越塞越不稳定/越跑越偏”的系统。
- 需要把 RAG、工具调用、记忆、权限/安全等组件组合成稳定产品的团队。

---

## 风险与成本
- 如果把“上下文工程”理解成“再堆更多上下文”，会适得其反（更严重的 context rot）。
- 真正落地需要额外工程：检索/摘要/缓存/去重/权限过滤/可观测性，复杂度上升。

---

## 可复用清单（我们能直接抄的点）

1. **把上下文当预算**：每个 token 都要能解释“为什么在这里”。
2. **把上下文构建做成 pipeline**：可插拔、可评测、可回归。
3. **优先检索与动态注入**：不要迷信长对话历史。
4. **用于选文/筛选的关键词与主题**（已在 `research/INTEREST_PROFILE.md` 中沉淀）：
   - Context engineering / context retrieval / agentic search / evals / harness / sandboxing

---

## 原文要点摘录与中文释义（短引用对照）

> 说明：为便于你不回看原文，我按“要点”做了短引用对照（每条引用尽量控制在 90 字符以内），并给出中文释义。

1) 原文："Context is a critical but finite resource for AI agents."
   - 中文释义：上下文对 AI Agent 至关重要，但它是有限资源（需要预算与取舍）。

2) 原文："Context refers to the set of tokens included when sampling..."
   - 中文释义：上下文本质是推理时喂给模型的 token 集合；工程问题是如何让这些 token 的信息密度最大化。

3) 原文："Prompt engineering... Context engineering..."
   - 中文释义：提示词工程关注“写指令”；上下文工程关注“运行时如何构造上下文”，包含工具、外部数据、历史等。

4) 原文："...we need strategies for managing the entire context state..."
   - 中文释义：长时程 agent 必须管理完整上下文状态（系统指令、工具、MCP、外部数据、历史），而不是只优化 system prompt。

5) 原文："...context rot..."
   - 中文释义：上下文过长会导致信息检索/回忆能力下降（类似“上下文腐烂/退化”），因此越长不一定越好。

6) 原文："Context... must be treated as a finite resource..."
   - 中文释义：把上下文当作注意力预算：每新增 token 都有边际成本，需要持续精炼与筛选。

7) 原文："We recommend organizing prompts into distinct sections..."
   - 中文释义：建议把 prompt 分区（背景、指令、工具指导、输出格式等），用结构化标记（XML/Markdown）提升可控性。

---

## 图/非文本内容（保持顺序）

1) 图：Prompt engineering vs. context engineering
   - 位置：对应“Context engineering vs. prompt engineering”章节附近
   - alt：Prompt engineering vs. context engineering
   - 链接：https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2Ffaa261102e46c7f090a2402a49000ffae18c5dd6-2292x1290.png&w=3840&q=75

2) 图：Calibrating the system prompt in the process of context engineering.
   - 位置：对应“The anatomy of effective context”章节附近
   - alt：Calibrating the system prompt in the process of context engineering.
   - 链接：https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F0442fe138158e84ffce92bed1624dd09f37ac46f-2292x1288.png&w=3840&q=75

---

## 延伸检索：类似方案/思路（跨来源补充）

> 目标：围绕“context engineering / 长时程 agent / 上下文检索与裁剪”等主题，补齐方案空间，让你通过这一篇文章拿到更多可选思路。

1) Elastic Search Labs：Context engineering（agentic AI 的上下文管理）
- https://www.elastic.co/search-labs/blog/context-engineering-llm-evolution-agentic-ai

2) Elastic Search Labs：The impact of relevance in context engineering for AI agents（强调相关性、混合检索、agentic search 等）
- https://www.elastic.co/search-labs/blog/context-engineering-relevance-ai-agents-elasticsearch

3) Google Developers Blog：Architecting efficient context-aware multi-agent framework for production（生产级多代理与上下文压缩/过滤/缓存等）
- https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/

4) arXiv：Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models（把上下文当作可演化的 playbook/记忆体）
- https://arxiv.org/abs/2510.04618

5) Weaviate：Context Engineering（面向 memory/retrieval 的 agent 组织方式与工具链）
- https://weaviate.io/blog/context-engineering

---

## 参考与证据
- 原文：https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

> 代码引用：本文未直接包含可引用的源码片段（因此无“源文件+行号”链接）。
