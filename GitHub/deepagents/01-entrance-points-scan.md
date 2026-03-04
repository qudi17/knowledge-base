# deepagents 入口点普查报告

**扫描日期**: 2026-03-04  
**扫描工具**: grep/find 手动扫描  
**项目版本**: 0.4.5

---

## 📊 扫描概览

| 入口点类型 | 数量 | 位置 | 状态 |
|-----------|------|------|------|
| **CLI 入口** | 2 | `libs/cli/` | ✅ 活跃 |
| **ACP 入口** | 1 | `libs/acp/` | ✅ 活跃 |
| **API 入口** | 0 | - | ❌ 无 Web API |
| **工具定义** | 6+ | `middleware/` | ✅ 活跃 |
| **子代理入口** | 1 | `middleware/subagents.py` | ✅ 活跃 |
| **Cron/定时** | 0 | - | ❌ 无 |
| **事件触发器** | 0 | - | ❌ 无 |
| **Webhook** | 0 | - | ❌ 无 |
| **消息队列** | 0 | - | ❌ 无 |

---

## 🔍 详细扫描结果

### 1. CLI 入口点

#### 1.1 deepagents-cli（主 CLI）

**位置**: `libs/cli/deepagents_cli/`

**入口文件**:
- `__main__.py` - Python 模块入口 (`python -m deepagents_cli`)
- `main.py` - CLI 主程序

**核心功能**:
```
libs/cli/deepagents_cli/
├── __main__.py          # python -m deepagents_cli 入口
├── main.py              # CLI 主程序
├── agent.py             # Agent 运行逻辑
├── chat_input.py        # 交互式聊天输入
├── config.py            # 配置管理
├── sessions.py          # 会话管理
├── ui.py                # TUI 界面 (Textual)
├── textual_adapter.py   # Textual 适配器
├── skills.py            # 技能加载
├── memory.py            # 记忆管理
├── tools/               # CLI 工具
│   ├── compact.py       # 上下文压缩工具
│   ├── fetch_url.py     # URL 获取工具
│   └── ...
└── ...
```

**使用方式**:
```bash
uv tool install deepagents-cli
deepagents
```

**CLI 特性**:
- ✅ 交互式对话 (TUI based on Textual)
- ✅ 会话恢复 (resume conversations)
- ✅ Web 搜索集成
- ✅ 远程沙箱支持 (Modal, Runloop, Daytona)
- ✅ 持久化记忆
- ✅ 自定义技能
- ✅ 无头模式 (headless)
- ✅ 人工审批 (human-in-the-loop)

---

#### 1.2 ACP (Agent Control Protocol)

**位置**: `libs/acp/deepagents_acp/`

**入口文件**:
- `__main__.py` - ACP 协议入口

**用途**: Agent 控制协议实现，用于 Agent 间的通信和协调

---

### 2. 核心库入口点

#### 2.1 deepagents 主库

**位置**: `libs/deepagents/deepagents/`

**入口文件**:
- `__init__.py` - 包入口
- `graph.py` - 核心 Agent 图构建 (`create_deep_agent`)
- `_version.py` - 版本信息

**核心模块**:
```
libs/deepagents/deepagents/
├── __init__.py           # 包入口，导出 create_deep_agent
├── _version.py           # 版本号
├── graph.py              # 核心：create_deep_agent 函数
├── base_prompt.md        # 基础系统提示词模板
├── backends/             # 后端实现
│   ├── __init__.py
│   ├── protocol.py       # 后端协议定义
│   ├── composite.py      # 复合后端
│   ├── filesystem.py     # 文件系统后端
│   ├── local_shell.py    # 本地 Shell 后端
│   ├── sandbox.py        # 沙箱后端
│   ├── state.py          # 状态后端
│   ├── store.py          # 存储后端
│   ├── utils.py          # 工具函数
│   └── state.py          # 状态管理
└── middleware/           # 中间件
    ├── __init__.py
    ├── filesystem.py     # 文件系统中间件
    ├── subagents.py      # 子代理中间件
    ├── skills.py         # 技能中间件
    ├── memory.py         # 记忆中间件
    ├── summarization.py  # 摘要中间件
    ├── patch_tool_calls.py  # 工具调用补丁
    └── _utils.py         # 工具函数
```

---

### 3. 工具定义入口点

#### 3.1 内置工具（通过 Middleware 实现）

| 工具名 | 位置 | 说明 |
|--------|------|------|
| `write_todos` | `langchain.agents.middleware.TodoListMiddleware` | 任务分解和进度跟踪 |
| `read_file` | `middleware/filesystem.py` | 读取文件 |
| `write_file` | `middleware/filesystem.py` | 写入文件 |
| `edit_file` | `middleware/filesystem.py` | 编辑文件 |
| `ls` | `middleware/filesystem.py` | 列出目录 |
| `glob` | `middleware/filesystem.py` | 通配符匹配文件 |
| `grep` | `middleware/filesystem.py` | 文件内容搜索 |
| `execute` | `backends/local_shell.py` | 执行 Shell 命令 |
| `task` | `middleware/subagents.py` | 调用子代理 |

#### 3.2 工具注册方式

工具通过 **LangChain Middleware** 模式注册，而非传统的 `@tool` 装饰器：

```python
# graph.py:120-135
deepagent_middleware: list[AgentMiddleware] = [
    TodoListMiddleware(),              # write_todos 工具
    FilesystemMiddleware(backend=backend),  # 文件系统工具
    SubAgentMiddleware(...),           # task 工具
    create_summarization_middleware(...),   # 自动摘要
    AnthropicPromptCachingMiddleware(...),  # Anthropic 缓存
    PatchToolCallsMiddleware(),        # 工具调用补丁
]
```

---

### 4. 子代理入口点

#### 4.1 通用子代理（General-Purpose Subagent）

**位置**: `middleware/subagents.py`

**定义**:
```python
# middleware/subagents.py:17-24
GENERAL_PURPOSE_SUBAGENT = {
    "name": "task",
    "description": "Delegate a task to a specialized sub-agent...",
    "system_prompt": "...",
}
```

**调用方式**:
```python
# 主 Agent 通过 `task` 工具调用子代理
result = agent.invoke({"messages": [{"role": "user", "content": "Research X"}]})
# 子代理通过 task 工具创建
```

**子代理特性**:
- ✅ 独立上下文窗口
- ✅ 可自定义工具集
- ✅ 可自定义模型
- ✅ 可自定义中间件栈
- ✅ 支持递归调用（recursion_limit: 1000）

---

### 5. Harbor 模块（合作伙伴集成）

**位置**: `libs/harbor/`

**用途**: 提供与合作伙伴的集成接口

```
libs/harbor/deepagents_harbor/
├── __init__.py
└── ... (合作伙伴特定集成)
```

---

### 6. 合作伙伴模块

**位置**: `libs/partners/`

**用途**: 第三方合作伙伴集成

---

## 📦 项目结构总览

```
deepagents/
├── libs/
│   ├── deepagents/          # 核心库 (PyPI: deepagents)
│   │   └── deepagents/
│   │       ├── graph.py     # 核心：create_deep_agent
│   │       ├── backends/    # 后端实现
│   │       └── middleware/  # 中间件系统
│   │
│   ├── cli/                 # CLI 工具 (PyPI: deepagents-cli)
│   │   └── deepagents_cli/
│   │       └── main.py      # CLI 入口
│   │
│   ├── acp/                 # ACP 协议 (PyPI: deepagents-acp)
│   │   └── deepagents_acp/
│   │       └── __main__.py
│   │
│   ├── harbor/              # 合作伙伴集成
│   │   └── deepagents_harbor/
│   │
│   └── partners/            # 第三方合作伙伴
│
├── examples/                # 示例项目
│   ├── content-builder-agent/
│   ├── deep_research/
│   ├── downloading_agents/
│   ├── ralph_mode/
│   └── text-to-sql-agent/
│
├── .github/                 # GitHub 配置
├── .vscode/                 # VSCode 配置
├── AGENTS.md                # Agent 使用指南
├── README.md                # 项目说明
├── Makefile                 # 构建脚本
└── release-please-config.json  # 发布配置
```

---

## 🔧 技术栈识别

### 核心依赖

| 类别 | 技术 | 版本 |
|------|------|------|
| **AI 框架** | LangChain | >=1.2.10,<2.0.0 |
| **Agent 运行时** | LangGraph | (通过 LangChain 引入) |
| **LLM 提供商** | Anthropic Claude | langchain-anthropic>=1.3.3 |
| **LLM 提供商** | Google Gemini | langchain-google-genai>=4.2.0 |
| **文件匹配** | wcmatch | - |
| **CLI 框架** | Textual | (用于 TUI) |
| **Python 版本** | Python | >=3.11,<4.0 |

### 可选依赖（evals）

- langchain-xai
- langchain-mistralai
- langchain-deepseek
- langchain-groq
- langchain-ollama

---

## 🎯 核心入口点总结

### 主要入口点（按重要性排序）

1. **`create_deep_agent()`** (`libs/deepagents/deepagents/graph.py:100`)
   - **类型**: Python API 入口
   - **用途**: 创建深度 Agent 实例
   - **重要性**: ⭐⭐⭐⭐⭐

2. **`deepagents` CLI** (`libs/cli/deepagents_cli/main.py`)
   - **类型**: 命令行入口
   - **用途**: 终端交互式 Agent
   - **重要性**: ⭐⭐⭐⭐⭐

3. **`task` 工具** (`libs/deepagents/deepagents/middleware/subagents.py`)
   - **类型**: 子代理调用入口
   - **用途**: 委托任务给子代理
   - **重要性**: ⭐⭐⭐⭐

4. **文件系统工具** (`libs/deepagents/deepagents/middleware/filesystem.py`)
   - **类型**: 工具集入口
   - **用途**: 文件读写操作
   - **重要性**: ⭐⭐⭐⭐

5. **后端协议** (`libs/deepagents/deepagents/backends/protocol.py`)
   - **类型**: 抽象接口
   - **用途**: 定义后端实现规范
   - **重要性**: ⭐⭐⭐

---

## 📝 入口点特征分析

### 架构模式

- **Middleware 模式**: 工具通过中间件注册，而非直接装饰器
- **后端抽象**: 通过 `BackendProtocol` 抽象不同后端实现
- **子代理模式**: 支持递归子代理调用（recursion_limit: 1000）
- **LangGraph 原生**: `create_deep_agent` 返回 `CompiledStateGraph`

### 无 Web API

项目**没有**传统的 Web API 入口点（如 FastAPI/Flask routes），主要通过：
- Python API (`create_deep_agent()`)
- CLI (`deepagents` 命令)
- LangGraph 运行时集成

### 无异步任务队列

项目**没有**使用 Celery/Cron 等异步任务队列，所有任务通过：
- LangGraph 图执行
- 子代理递归调用
- 同步/异步工具调用

---

## ✅ 扫描结论

### 活跃入口点

- ✅ CLI 入口（2 个：main.py, __main__.py）
- ✅ ACP 入口（1 个：__main__.py）
- ✅ 工具定义（6+ 内置工具）
- ✅ 子代理入口（task 工具）

### 不存在的入口点

- ❌ Web API（无 FastAPI/Flask routes）
- ❌ Cron 定时任务
- ❌ 事件触发器
- ❌ Webhook
- ❌ 消息队列

### 架构特点

1. **简洁的入口设计**: 主要通过 Python API 和 CLI
2. **Middleware 驱动**: 工具通过中间件系统注册
3. **LangGraph 深度集成**: 利用 LangGraph 的状态图和检查点
4. **后端可插拔**: 支持多种后端实现（本地/沙箱/远程）

---

**下一步**: 进入阶段 4 - 模块化分析
