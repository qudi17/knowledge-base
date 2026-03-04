# Agent 框架深度对比分析

**最后更新**: 2026-03-04  
**对比标签**: Agent  
**包含项目**: nanobot, MemoryBear, everything-claude-code, Claude Agent SDK, deepagents  
**研究总数**: 5

---

## 📊 项目概览

| 项目 | Stars | 许可证 | 主要语言 | 完成日期 | 完整性评分 | 一级标签 | 报告位置 |
|------|-------|--------|---------|---------|-----------|---------|---------|
| **nanobot** | 23,839 | MIT | Python | 2026-03-02 | 98.75% ⭐⭐⭐⭐⭐ | Agent, Dev-Tool, Code | [GitHub/nanobot/](../nanobot/) |
| **MemoryBear** | - | MIT | Python | 2026-03-02 | 96.5% ⭐⭐⭐⭐⭐ | Memory, RAG, Agent, Workflow | [GitHub/MemoryBear/](../MemoryBear/) |
| **everything-claude-code** | - | MIT | Python | 2026-03-02 | 98% ⭐⭐⭐⭐⭐ | Agent, Code, Dev-Tool | [GitHub/everything-claude-code/](../everything-claude-code/) |
| **Claude Agent SDK** | - | MIT | Python | 2026-03-03 | 98.7% ⭐⭐⭐⭐⭐ | Agent, SDK, Dev-Tool | [GitHub/claude-agent-sdk-python/](../claude-agent-sdk-python/) |
| **deepagents** | 参考 GitHub | MIT | Python | 2026-03-04 | 92% ⭐⭐⭐⭐⭐ | Agent, Workflow, Code | [GitHub/deepagents/](../deepagents/) |

---

## 🏗️ 架构对比矩阵

| 维度 | nanobot | MemoryBear | everything-claude-code | Claude Agent SDK | deepagents |
|------|---------|-----------|----------------------|-----------------|-----------|
| **架构类型** | CLI + SDK | 事件驱动平台 | MCP 技能框架 | SDK | LangGraph 原生 |
| **Agent Loop** | 自定义 Loop | 事件驱动 | MCP 协议 | 自定义 Loop | LangGraph 图 |
| **子代理** | ✅ 支持 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 | ✅ 递归调用 |
| **记忆系统** | ⚠️ 基础 | ✅ ACT-R 遗忘 | ❌ 无 | ⚠️ 基础 | ✅ 自动摘要 |
| **工具系统** | ✅ 丰富 | ✅ 技能系统 | ✅ MCP 工具 | ✅ 自定义 | ✅ 内置 6 工具 |
| **工作流** | ⚠️ 简单 | ✅ LangGraph | ❌ 无 | ⚠️ 简单 | ✅ LangGraph |
| **CLI** | ✅ TUI | ❌ 无 | ✅ MCP CLI | ❌ 无 | ✅ TUI |
| **后端抽象** | ❌ 无 | ✅ 多后端 | ❌ 无 | ❌ 无 | ✅ Protocol |

---

## 💡 技术选型对比

### Agent 运行时

| 组件 | nanobot | MemoryBear | everything-claude-code | Claude Agent SDK | deepagents |
|------|---------|-----------|----------------------|-----------------|-----------|
| **核心框架** | 自定义 | LangGraph | MCP | 自定义 | LangGraph |
| **状态管理** | 内存 | Redis + Neo4j | 内存 | 内存 | LangGraph State |
| **检查点** | ❌ 无 | ✅ Redis | ❌ 无 | ⚠️ 可选 | ✅ LangGraph |
| **持久化** | ⚠️ 会话存储 | ✅ 完整 | ❌ 无 | ⚠️ 可选 | ✅ Checkpointer |

### 工具系统

| 组件 | nanobot | MemoryBear | everything-claude-code | Claude Agent SDK | deepagents |
|------|---------|-----------|----------------------|-----------------|-----------|
| **内置工具** | 10+ | 技能系统 | MCP 工具 | 自定义 | 6 个（文件/Shell 等） |
| **工具注册** | 装饰器 | 技能文件 | MCP 协议 | 自定义 | Middleware |
| **工具调用** | 直接调用 | 事件触发 | MCP 调用 | 直接调用 | LangChain 工具 |

### 子代理系统

| 组件 | nanobot | MemoryBear | everything-claude-code | Claude Agent SDK | deepagents |
|------|---------|-----------|----------------------|-----------------|-----------|
| **子代理支持** | ✅ 支持 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 | ✅ 递归调用 |
| **上下文隔离** | ✅ 独立 | ✅ 独立 | - | - | ✅ 独立窗口 |
| **递归深度** | 有限 | 有限 | - | - | 1000 |
| **默认子代理** | ✅ 通用 | ✅ 反思引擎 | - | - | ✅ 通用 |

---

## 🎯 Agent 核心维度对比 ⭐

### 1. 任务编排

| 项目 | 编排方式 | 任务分解 | 进度跟踪 | 中断恢复 | 评分 |
|------|---------|---------|---------|---------|------|
| **nanobot** | 自定义 Loop | ✅ write_todos | ✅ 进度显示 | ⚠️ 会话恢复 | ⭐⭐⭐⭐ |
| **MemoryBear** | LangGraph + 事件 | ✅ 反思引擎 | ✅ 事件日志 | ✅ 检查点 | ⭐⭐⭐⭐⭐ |
| **everything-claude-code** | MCP 协议 | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 | ⭐⭐ |
| **Claude Agent SDK** | 自定义 Loop | ✅ 基础 | ⚠️ 基础 | ⚠️ 可选 | ⭐⭐⭐ |
| **deepagents** | LangGraph 图 | ✅ write_todos | ✅ 内置 | ✅ Checkpointer | ⭐⭐⭐⭐⭐ |

**最优**: MemoryBear / deepagents（LangGraph 原生）

---

### 2. Skills/工具数量

| 项目 | 内置工具 | 可扩展 | 技能来源 | 评分 |
|------|---------|-------|---------|------|
| **nanobot** | 10+ | ✅ 自定义 | 代码定义 | ⭐⭐⭐⭐ |
| **MemoryBear** | 技能系统 | ✅ 文件加载 | AGENTS.md | ⭐⭐⭐⭐⭐ |
| **everything-claude-code** | MCP 工具 | ✅ MCP 服务器 | MCP 协议 | ⭐⭐⭐⭐ |
| **Claude Agent SDK** | 自定义 | ✅ 自定义 | 代码定义 | ⭐⭐⭐ |
| **deepagents** | 6 个 | ✅ Middleware | 代码/Middleware | ⭐⭐⭐⭐ |

**最优**: MemoryBear（技能系统最灵活）

---

### 3. Memory 系统

| 项目 | 记忆类型 | 存储方案 | 检索优化 | 遗忘机制 | 评分 |
|------|---------|---------|---------|---------|------|
| **nanobot** | 会话记忆 | 内存/文件 | 简单检索 | ❌ 无 | ⭐⭐⭐ |
| **MemoryBear** | 短期 + 长期 | Neo4j + ES | 图 + 向量 | ✅ ACT-R | ⭐⭐⭐⭐⭐ |
| **everything-claude-code** | 无 | - | - | - | ⭐ |
| **Claude Agent SDK** | 会话记忆 | 内存 | 简单检索 | ❌ 无 | ⭐⭐⭐ |
| **deepagents** | 上下文摘要 | State/Store | 自动摘要 | ⚠️ 截断 | ⭐⭐⭐⭐ |

**最优**: MemoryBear（ACT-R 遗忘引擎）

---

### 4. 子代理系统

| 项目 | 调用方式 | 上下文隔离 | 递归支持 | 返回结果 | 评分 |
|------|---------|-----------|---------|---------|------|
| **nanobot** | 工具调用 | ✅ 独立 | ⚠️ 有限 | ✅ 返回 | ⭐⭐⭐⭐ |
| **MemoryBear** | 事件触发 | ✅ 独立 | ⚠️ 有限 | ✅ 事件 | ⭐⭐⭐⭐ |
| **everything-claude-code** | ❌ 不支持 | - | - | - | ⭐ |
| **Claude Agent SDK** | ❌ 不支持 | - | - | - | ⭐ |
| **deepagents** | task 工具 | ✅ 独立窗口 | ✅ 1000 深度 | ✅ ToolMessage | ⭐⭐⭐⭐⭐ |

**最优**: deepagents（递归支持最好）

---

### 5. CLI 体验

| 项目 | CLI 框架 | 交互模式 | TUI | 会话管理 | 评分 |
|------|---------|---------|-----|---------|------|
| **nanobot** | 自定义 | 交互式 | ✅ Textual | ✅ 会话恢复 | ⭐⭐⭐⭐⭐ |
| **MemoryBear** | ❌ 无 CLI | - | ❌ 无 | - | ⭐ |
| **everything-claude-code** | MCP CLI | 命令行 | ❌ 无 | ⚠️ 基础 | ⭐⭐⭐ |
| **Claude Agent SDK** | ❌ 无 CLI | - | ❌ 无 | - | ⭐ |
| **deepagents** | 自定义 | 交互式 | ✅ Textual | ✅ 会话恢复 | ⭐⭐⭐⭐⭐ |

**最优**: nanobot / deepagents（TUI 体验最佳）

---

## 🆚 新增项目对比

### 2026-03-04: deepagents 加入对比

**新项目**: deepagents (langchain-ai/deepagents)  
**一级标签**: Agent, Workflow, Code  
**完整性评分**: 92% ⭐⭐⭐⭐⭐

**与已有项目对比**:

#### vs nanobot

| 维度 | deepagents | nanobot | 胜出者 |
|------|-----------|---------|--------|
| **架构设计** | LangGraph 原生 | 自定义 Loop | deepagents（生态更好） |
| **子代理** | ✅ 递归 1000 深度 | ⚠️ 有限支持 | deepagents |
| **CLI 体验** | ✅ Textual TUI | ✅ Textual TUI | 平局 |
| **工具系统** | ✅ 6 内置 + Middleware | ✅ 10+ 工具 | nanobot（工具更多） |
| **记忆系统** | ✅ 自动摘要 | ⚠️ 基础会话 | deepagents |
| **文档完善度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | deepagents |

**关键差异**:
- deepagents 优势：LangGraph 生态、子代理递归、自动摘要、文档完善
- nanobot 优势：工具数量更多、CLI 功能丰富、代码质量高

**选型建议**:
- 选择 deepagents: 需要 LangGraph 集成、子代理架构、生产级可靠性
- 选择 nanobot: 需要轻量级 CLI、快速原型、工具多样性

---

#### vs MemoryBear

| 维度 | deepagents | MemoryBear | 胜出者 |
|------|-----------|-----------|--------|
| **架构设计** | LangGraph 原生 | 事件驱动 + LangGraph | MemoryBear（更灵活） |
| **记忆系统** | ⚠️ 自动摘要 | ✅ ACT-R 遗忘引擎 | MemoryBear（专业记忆） |
| **子代理** | ✅ 递归 1000 深度 | ⚠️ 有限支持 | deepagents |
| **工具系统** | ✅ 6 内置 | ✅ 技能文件 | 平局（不同风格） |
| **后端抽象** | ✅ Protocol | ✅ 多后端 | 平局 |

**关键差异**:
- deepagents 优势：子代理系统、LangChain 生态、开箱即用
- MemoryBear 优势：ACT-R 记忆系统、图数据库、事件驱动架构

**选型建议**:
- 选择 deepagents: 通用 Agent 任务、LangChain 生态、快速开始
- 选择 MemoryBear: 需要专业记忆系统、图数据库、长期记忆管理

---

#### vs Claude Agent SDK

| 维度 | deepagents | Claude Agent SDK | 胜出者 |
|------|-----------|-----------------|--------|
| **架构设计** | LangGraph 完整 | 轻量级封装 | deepagents（功能更全） |
| **内置功能** | ✅ 6 工具 + 子代理 | ⚠️ 基础 | deepagents |
| **CLI** | ✅ Textual TUI | ❌ 无 | deepagents |
| **灵活性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Claude Agent SDK（更轻量） |

**关键差异**:
- deepagents 优势：功能完整、内置工具、CLI、子代理
- Claude Agent SDK 优势：轻量级、易定制、代码简洁

**选型建议**:
- 选择 deepagents: 需要完整功能、开箱即用
- 选择 Claude Agent SDK: 需要轻量级 SDK、完全自定义

---

## 🌳 决策树

```
需要 Agent 框架？
│
├─ 需要专业记忆系统？
│  ├─ 是 → MemoryBear（ACT-R 遗忘引擎，图数据库）
│  └─ 否 → 继续
│
├─ 需要子代理递归调用？
│  ├─ 是 → deepagents（递归深度 1000，LangGraph 原生）
│  └─ 否 → 继续
│
├─ 需要 CLI 交互式使用？
│  ├─ 是 → nanobot 或 deepagents
│  │   ├─ 需要更多工具 → nanobot（10+ 工具）
│  │   └─ 需要 LangGraph 生态 → deepagents
│  └─ 否 → 继续
│
├─ 需要 MCP 协议集成？
│  ├─ 是 → everything-claude-code（MCP 技能框架）
│  └─ 否 → 继续
│
├─ 需要轻量级 SDK？
│  ├─ 是 → Claude Agent SDK（轻量封装）
│  └─ 否 → deepagents（功能最完整）
```

---

## 📝 历史更新记录

| 日期 | 更新内容 | 包含项目数 |
|------|---------|-----------|
| 2026-03-04 | deepagents 加入对比 | 5 |
| 2026-03-03 | Claude Agent SDK 加入对比 | 4 |
| 2026-03-02 | everything-claude-code 加入对比 | 3 |
| 2026-03-02 | MemoryBear 加入对比 | 2 |
| 2026-03-02 | 创建对比文件（nanobot） | 1 |

---

**最后更新**: 2026-03-04  
**维护者**: github-researcher-plus  
**下次更新**: 新增 Agent 项目时自动更新
