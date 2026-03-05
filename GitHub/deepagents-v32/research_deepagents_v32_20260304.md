# 研究报告：langchain-ai/deepagents

**研究日期**: 2026-03-04  
**研究版本**: github-deep-research v3.2  
**项目 URL**: https://github.com/langchain-ai/deepagents  
**研究深度**: Level 5  

---

## 项目元数据

- **名称**: deepagents
- **描述**: Deep Agents is an agent harness built on langchain and langgraph. Deep Agents are equipped with a planning tool, a filesystem backend, and the ability to spawn subagents - making them well-equipped to handle complex agentic tasks.
- **Stars**: 9,849
- **Forks**: 1,572
- **语言**: Python (98.5%)
- **许可证**: MIT
- **创建时间**: 2025-07-27
- **最新Release**: deepagents==0.4.5 (2026-03-03)
- **贡献者**: 69

---

## 标签分析

### Level 1: 应用场景
- **Agent** - 核心 Agent 框架
- **Framework** - 提供完整的 Agent 构建框架
- **Code** - 支持代码执行和文件操作

### Level 2: 产品形态
- **Framework** - 基于 LangGraph 的 Agent 框架
- **SDK/Library** - Python 包形式提供
- **CLI** - 提供 deepagents-cli 终端接口

### Level 3: 技术特性
- **LangGraph** - 底层图执行引擎
- **LangChain** - 基于 LangChain 生态系统
- **MCP** - 支持 Model Context Protocol
- **Python** - 纯 Python 实现

---

## 执行摘要

Deep Agents 是 LangChain 团队推出的意见化 (opinionated) Agent 框架，基于 LangGraph 构建。它提供了开箱即用的完整 Agent 解决方案，包括任务规划、文件系统访问、子 Agent 派生、上下文管理等核心功能。项目采用 monorepo 结构，包含核心 SDK、CLI 工具、ACP 协议集成以及多个沙箱后端适配。

---

## 核心模块分析
