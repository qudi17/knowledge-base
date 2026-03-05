# 阶段 5: 标签对比分析 ⭐⭐⭐⭐⭐

**研究日期**: 2026-03-03  
**项目**: nanobot (标签：Agent, Dev-Tool, Code)  
**对比项目**: MemoryBear, everything-claude-code, Claude Agent SDK

---

## 📊 项目概览

| 项目 | Stars | 定位 | 完整性评分 | 标签 | 报告位置 |
|------|-------|------|-----------|------|---------|
| **nanobot** | 23,839 | 个人 AI 助手框架 | 98.75% ⭐⭐⭐⭐⭐ | Agent, Dev-Tool, Code | [GitHub/nanobot-v3/](./) |
| **MemoryBear** | - | 记忆平台（ACT-R） | 96.5% ⭐⭐⭐⭐⭐ | Memory, RAG, Agent, Workflow | [GitHub/MemoryBear/](../MemoryBear/) |
| **everything-claude-code** | - | Agent 技能框架 | 98% ⭐⭐⭐⭐⭐ | Agent, Code, Dev-Tool | [GitHub/everything-claude-code/](../everything-claude-code/) |
| **Claude Agent SDK** | - | Agent SDK | 98.7% ⭐⭐⭐⭐⭐ | Agent, SDK, Dev-Tool | [GitHub/claude-agent-sdk-python/](../claude-agent-sdk-python/) |

---

## 🎯 Agent 项目核心维度对比

### 1. 任务编排

| 项目 | 编排方式 | 状态管理 | 错误恢复 | 评分 |
|------|---------|---------|---------|------|
| **nanobot** | Agent Loop（思考→行动→观察） | Session 存储 | 最大迭代限制 (40) | ⭐⭐⭐⭐ |
| **MemoryBear** | LangGraph 工作流 | Neo4j 图存储 | 检查点恢复 | ⭐⭐⭐⭐⭐ |
| **everything-claude-code** | MCP 工具编排 | 文件系统 | 无状态 | ⭐⭐⭐ |
| **Claude Agent SDK** | SDK 内置编排 | 内存存储 | 自动重试 | ⭐⭐⭐⭐ |

**最优**: MemoryBear（图驱动工作流，状态可恢复）

**详细对比**:
- **nanobot**: 简单直接的循环模式，适合个人助手场景
- **MemoryBear**: 基于 LangGraph 的状态机，支持复杂工作流
- **everything-claude-code**: 依赖 MCP 协议，工具驱动
- **Claude Agent SDK**: 官方 SDK，开箱即用但灵活性有限

---

### 2. Tools 生态

| 项目 | 内置工具 | MCP 支持 | 自定义工具 | 评分 |
|------|---------|---------|-----------|------|
| **nanobot** | 10+（文件/Shell/Web/Message/Cron/Subagent） | ✅ 支持 | Skills 系统 | ⭐⭐⭐⭐⭐ |
| **MemoryBear** | 5+（Neo4j/Elasticsearch/反思） | ❌ 不支持 | 插件系统 | ⭐⭐⭐ |
| **everything-claude-code** | 100+（通过 MCP） | ✅ 核心 | MCP 协议 | ⭐⭐⭐⭐⭐ |
| **Claude Agent SDK** | 20+（官方工具） | ⚠️ 部分 | SDK 扩展 | ⭐⭐⭐⭐ |

**最优**: nanobot / everything-claude-code（并列）

**详细对比**:
- **nanobot**: 平衡的内置工具 + MCP 扩展，适合个人场景
- **MemoryBear**: 专注记忆相关工具，通用工具较少
- **everything-claude-code**: 完全依赖 MCP 生态，工具最丰富
- **Claude Agent SDK**: 官方工具质量高，但生态封闭

---

### 3. Memory 系统

| 项目 | 记忆模型 | 存储方案 | 检索机制 | 优化策略 | 评分 |
|------|---------|---------|---------|---------|------|
| **nanobot** | 两层（MEMORY.md + HISTORY.md） | 文件系统 | 文本搜索 | LLM 压缩 | ⭐⭐⭐⭐ |
| **MemoryBear** | ACT-R 认知模型 | Neo4j + ES | 图遍历 + 向量 | 遗忘曲线 | ⭐⭐⭐⭐⭐ |
| **everything-claude-code** | 无（无状态） | - | - | - | ⭐ |
| **Claude Agent SDK** | 会话历史 | 内存 | 滑动窗口 | 无 | ⭐⭐⭐ |

**最优**: MemoryBear（ACT-R 模型，科学记忆理论）

**详细对比**:
- **nanobot**: 简单实用的两层设计，易调试、可 grep
- **MemoryBear**: ACT-R 认知架构，支持遗忘/激活/联想
- **everything-claude-code**: 无状态设计，依赖外部 MCP
- **Claude Agent SDK**: 基础会话历史，无长期记忆

---

### 4. Agent Loop

| 项目 | 执行模式 | 迭代限制 | 工具并行 | 流式响应 | 评分 |
|------|---------|---------|---------|---------|------|
| **nanobot** | 同步循环 | 40 次 | ❌ 串行 | ✅ 支持 | ⭐⭐⭐⭐ |
| **MemoryBear** | LangGraph 状态机 | 可配置 | ✅ 支持 | ✅ 支持 | ⭐⭐⭐⭐⭐ |
| **everything-claude-code** | MCP 驱动 | 15 次 | ❌ 串行 | ❌ 不支持 | ⭐⭐⭐ |
| **Claude Agent SDK** | SDK 内置 | 可配置 | ✅ 支持 | ✅ 支持 | ⭐⭐⭐⭐ |

**最优**: MemoryBear（状态机模式，支持并行和恢复）

---

### 5. 多 Agent 支持

| 项目 | 协作模式 | 通信机制 | 任务分发 | 评分 |
|------|---------|---------|---------|------|
| **nanobot** | SubagentManager | MessageBus | spawn 工具 | ⭐⭐⭐⭐ |
| **MemoryBear** | 多工作流 | 事件总线 | 工作流触发 | ⭐⭐⭐⭐ |
| **everything-claude-code** | 无 | - | - | ⭐ |
| **Claude Agent SDK** | 多 SDK 实例 | 内存共享 | 手动协调 | ⭐⭐⭐ |

**最优**: nanobot（MessageBus 解耦，支持后台子代理）

---

## 📝 Dev-Tool 维度对比

### 1. CLI 接口

| 项目 | CLI 框架 | 命令数量 | 交互模式 | 评分 |
|------|---------|---------|---------|------|
| **nanobot** | Typer | 6 个（chat/run/skills/gateway/onboard/sync） | ✅ 支持 | ⭐⭐⭐⭐⭐ |
| **MemoryBear** | 无 | 0 个 | ❌ 不支持 | ⭐ |
| **everything-claude-code** | MCP CLI | 2 个（install/run） | ❌ 不支持 | ⭐⭐ |
| **Claude Agent SDK** | 无 | 0 个 | ❌ 不支持 | ⭐ |

**最优**: nanobot（完整的 CLI 体验）

---

### 2. 配置管理

| 项目 | 配置方式 | 验证机制 | 热重载 | 评分 |
|------|---------|---------|-------|------|
| **nanobot** | JSON + Pydantic | ✅ 类型验证 | ❌ 不支持 | ⭐⭐⭐⭐ |
| **MemoryBear** | YAML + Pydantic | ✅ 类型验证 | ✅ 支持 | ⭐⭐⭐⭐⭐ |
| **everything-claude-code** | JSON | ❌ 无验证 | ❌ 不支持 | ⭐⭐ |
| **Claude Agent SDK** | 环境变量 | ⚠️ 基础验证 | ❌ 不支持 | ⭐⭐⭐ |

**最优**: MemoryBear（YAML + 热重载）

---

### 3. 插件系统

| 项目 | 插件类型 | 加载机制 | 依赖管理 | 评分 |
|------|---------|---------|---------|------|
| **nanobot** | Skills（SKILL.md） | 目录扫描 | 手动检查 | ⭐⭐⭐⭐ |
| **MemoryBear** | 模块插件 | 导入加载 | pip 安装 | ⭐⭐⭐⭐ |
| **everything-claude-code** | MCP 服务器 | 协议发现 | npx 运行 | ⭐⭐⭐⭐⭐ |
| **Claude Agent SDK** | SDK 扩展 | 继承扩展 | pip 安装 | ⭐⭐⭐ |

**最优**: everything-claude-code（MCP 生态，自动发现）

---

## 💻 Code 维度对比

### 1. 代码理解

| 项目 | AST 解析 | 代码搜索 | 依赖分析 | 评分 |
|------|---------|---------|---------|------|
| **nanobot** | ❌ 不支持 | ✅ 文件搜索 | ❌ 不支持 | ⭐⭐ |
| **MemoryBear** | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 | ⭐ |
| **everything-claude-code** | ✅ 通过 MCP | ✅ 通过 MCP | ✅ 通过 MCP | ⭐⭐⭐⭐ |
| **Claude Agent SDK** | ⚠️ 部分 | ✅ 基础搜索 | ❌ 不支持 | ⭐⭐⭐ |

**最优**: everything-claude-code（通过 MCP 工具）

---

### 2. 代码生成

| 项目 | 文件编辑 | 代码补全 | 重构支持 | 评分 |
|------|---------|---------|---------|------|
| **nanobot** | ✅ edit_file 工具 | ❌ 不支持 | ⚠️ 搜索替换 | ⭐⭐⭐ |
| **MemoryBear** | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 | ⭐ |
| **everything-claude-code** | ✅ 通过 MCP | ✅ 通过 MCP | ✅ 通过 MCP | ⭐⭐⭐⭐ |
| **Claude Agent SDK** | ✅ SDK 工具 | ⚠️ 基础 | ❌ 不支持 | ⭐⭐⭐ |

**最优**: everything-claude-code（MCP 工具丰富）

---

## 🆚 核心模块代码对比

### 任务编排模块对比

| 项目 | 文件位置 | 代码行数 | 设计模式 | 复杂度 |
|------|---------|---------|---------|-------|
| **nanobot** | `agent/loop.py` | ~500 行 | 策略 + 命令 | 中 |
| **MemoryBear** | `workflows/` | ~800 行 | 状态机 | 高 |
| **everything-claude-code** | `mcp/` | ~300 行 | 工厂 | 低 |

**nanobot 优势**: 简单直接，易于理解和调试
**MemoryBear 优势**: 支持复杂工作流，状态可恢复
**everything-claude-code 优势**: 轻量，依赖 MCP 生态

---

### Memory 模块对比

| 项目 | 文件位置 | 存储方案 | 检索方式 | 压缩策略 |
|------|---------|---------|---------|---------|
| **nanobot** | `agent/memory.py` | 文件系统 | 文本搜索 | LLM 压缩 |
| **MemoryBear** | `memory/` | Neo4j + ES | 图遍历 + 向量 | ACT-R 遗忘 |

**nanobot 优势**: 简单、可 grep、易调试
**MemoryBear 优势**: 科学记忆模型、语义检索

---

### Tools 模块对比

| 项目 | 文件位置 | 工具数量 | MCP 支持 | 自定义扩展 |
|------|---------|---------|---------|-----------|
| **nanobot** | `agent/tools/` | 10+ | ✅ 支持 | Skills 系统 |
| **everything-claude-code** | `mcp/` | 100+ | ✅ 核心 | MCP 协议 |

**nanobot 优势**: 内置工具满足个人场景，MCP 作为补充
**everything-claude-code 优势**: MCP 生态工具丰富

---

## 🌳 选型决策树

```
是否需要长期记忆？
├─ 是 → 是否需要语义检索？
│   ├─ 是 → MemoryBear（ACT-R + 向量）
│   └─ 否 → nanobot（两层文件存储）
└─ 否 → 是否需要丰富工具生态？
    ├─ 是 → everything-claude-code（MCP）
    └─ 否 → Claude Agent SDK（官方 SDK）

是否需要 CLI 交互？
├─ 是 → nanobot（完整 CLI）
└─ 否 → 继续其他维度判断

是否需要多 Agent 协作？
├─ 是 → nanobot（SubagentManager）或 MemoryBear（多工作流）
└─ 否 → 其他项目

是否专注代码开发？
├─ 是 → everything-claude-code（MCP 代码工具）
└─ 否 → nanobot（通用助手）
```

---

## 📊 综合评分

| 项目 | Agent | Dev-Tool | Code | 综合 | 推荐场景 |
|------|-------|---------|------|------|---------|
| **nanobot** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | 个人助手、CLI 交互 |
| **MemoryBear** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ | 记忆研究、复杂工作流 |
| **everything-claude-code** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 代码开发、MCP 生态 |
| **Claude Agent SDK** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 快速原型、官方支持 |

---

## ✅ 阶段 5 完成检查

- [x] 从 RESEARCH_LIST.md 读取标签
- [x] 匹配对比项目（Agent/Dev-Tool/Code）
- [x] Agent 项目核心维度对比（5 维度）
- [x] Dev-Tool 维度对比（3 维度）
- [x] Code 维度对比（2 维度）
- [x] 核心模块代码对比（任务编排/Memory/Tools）
- [x] 选型决策树

**下一步**: 执行阶段 6 - 最终报告生成
