# 阶段 0: 项目准备 + 标签定义

**研究日期**: 2026-03-03  
**研究版本**: v3.0 重构流程  
**目标**: 使用 v3.0 流程重新研究 nanobot 项目

---

## ✅ 标签确认

根据 RESEARCH_LIST.md 中 nanobot 项目的标签定义：

| 项目 | 标签 | 状态 |
|------|------|------|
| **nanobot** | Agent, Dev-Tool, Code | ✅ 已完成（v1 研究）|

### 标签验证

- **一级标签（应用场景）**: `Agent`, `Dev-Tool`, `Code`
- **二级标签（技术架构）**: `Async`, `Multi-Modal`（支持多消息平台）
- **三级标签（应用方向）**: `Personal`, `Dev-Tool`, `Production`

### 标签匹配项目（用于阶段 5 对比）

根据 RESEARCH_LIST.md 中的已完成项目：

| 标签 | 匹配项目 |
|------|---------|
| **Agent** | MemoryBear, everything-claude-code, Claude Agent SDK |
| **Dev-Tool** | LlamaIndex, MarkItDown, everything-claude-code, Claude Agent SDK |
| **Code** | everything-claude-code |

---

## 📁 研究目录结构

```
knowledge-base/GitHub/nanobot-v3/
├── 00-phase0-preparation.md       # 阶段 0: 项目准备（本文档）
├── 01-entrance-points-scan.md     # 阶段 1: 入口点普查
├── 02-agent-core-modules.md       # 阶段 2: Agent 核心模块分析
├── 03-call-chains.md              # 阶段 3: 调用链追踪
├── 04-architecture-analysis.md    # 阶段 4: 架构师视角分析
├── comparisons/                   # 阶段 5: 标签对比分析
│   ├── Agent-comparison.md
│   ├── Dev-Tool-comparison.md
│   └── Code-comparison.md
└── final-report-v3.md             # 阶段 6: 最终报告
```

---

## 📊 项目概览

| 指标 | 数值 |
|------|------|
| **仓库** | HKUDS/nanobot |
| **Stars** | 23,839 |
| **定位** | 个人 AI 助手框架 |
| **核心技术栈** | Python + Typer(CLI) + 多平台消息 SDK |
| **总代码文件** | 72 个 Python 文件 |
| **核心模块** | agent, cli, channels, skills, config, bus, cron |

---

## 🎯 v3.0 研究重点

相比 v1 研究，v3.0 流程强调：

1. **14 种入口点强制性扫描**（完整性检查）
2. **核心模块代码片段规范**（80-150 行完整类定义）
3. **3 波次调用链追踪**（CLI/API/Agent Loop）
4. **架构师视角深度分析**（≥5 种设计模式）
5. **标签对比分析**（与 MemoryBear、everything-claude-code 等对比）

---

## ✅ 阶段 0 完成检查

- [x] 确认 nanobot 标签：Agent, Dev-Tool, Code
- [x] 验证 RESEARCH_LIST.md 已填写标签
- [x] 创建研究目录结构
- [x] 确认对比项目列表

---

**下一步**: 执行阶段 1 - 14 种入口点普查
