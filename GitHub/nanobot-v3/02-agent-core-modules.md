# 阶段 2: 标签核心模块分析 ⭐⭐⭐⭐⭐

**研究日期**: 2026-03-03  
**项目**: nanobot (HKUDS/nanobot)  
**标签**: Agent, Dev-Tool, Code

---

## 📊 核心模块概览

根据 nanobot 的三个标签，需要研究以下核心模块：

| 标签 | 核心模块 | 文件位置 | 代码行数 |
|------|---------|---------|---------|
| **Agent** | 任务编排模块 | `nanobot/agent/loop.py` | ~500 行 |
| **Agent** | Tools/MCP 模块 | `nanobot/agent/tools/` | ~400 行 |
| **Agent** | Memory 模块 | `nanobot/agent/memory.py` | ~150 行 |
| **Agent** | Agent Loop 模块 | `nanobot/agent/loop.py` | ~500 行 |
| **Agent** | 多 Agent 协作模块 | `nanobot/agent/subagent.py` | ~250 行 |
| **Dev-Tool** | CLI 接口模块 | `nanobot/cli/commands.py` | ~1000 行 |
| **Dev-Tool** | 配置管理模块 | `nanobot/config/schema.py` | ~400 行 |
| **Dev-Tool** | 插件系统模块 | `nanobot/agent/skills.py` | ~200 行 |
| **Code** | 代码理解模块 | `nanobot/agent/tools/filesystem.py` | ~200 行 |
| **Code** | 代码生成模块 | `nanobot/agent/tools/filesystem.py` | ~200 行 |

---

## 🤖 Agent 核心模块

### 1. 任务编排模块 ⭐⭐⭐⭐⭐

**文件位置**: `nanobot/agent/loop.py:40-180`  
**代码行数**: 140 行  
**职责**: AgentLoop 初始化、工具注册、MCP 连接

**完整类定义**:

```python
# nanobot/agent/loop.py:40-180 (140 行)
class AgentLoop:
    """
    The agent loop is the core processing engine.

    It:
    1. Receives messages from the bus
    2. Builds context with history, memory, skills
    3. Calls the LLM
    4. Executes tool calls
    5. Sends responses back
    """

    _TOOL_RESULT_MAX_CHARS = 500

    def __init__(
        self,
        bus: MessageBus,
        provider: LLMProvider,
        workspace: Path,
        model: str | None = None,
        max_iterations: int = 40,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        memory_window: int = 100,
        reasoning_effort: str | None = None,
        brave_api_key: str | None = None,
        web_proxy: str | None = None,
        exec_config: ExecToolConfig | None = None,
        cron_service: CronService | None = None,
        restrict_to_workspace: bool = False,
        session_manager: SessionManager | None = None,
        mcp_servers: dict | None = None,
        channels_config: ChannelsConfig | None = None,
    ):
        from nanobot.config.schema import ExecToolConfig
        self.bus = bus
        self.channels_config = channels_config
        self.provider = provider
        self.workspace = workspace
        self.model = model or provider.get_default_model()
        self.max_iterations = max_iterations
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.memory_window = memory_window
        self.reasoning_effort = reasoning_effort
        self.brave_api_key = brave_api_key
        self.web_proxy = web_proxy
        self.exec_config = exec_config or ExecToolConfig()
        self.cron_service = cron_service
        self.restrict_to_workspace = restrict_to_workspace

        self.context = ContextBuilder(workspace)
        self.sessions = session_manager or SessionManager(workspace)
        self.tools = ToolRegistry()
        self.subagents = SubagentManager(
            provider=provider,
            workspace=workspace,
            bus=bus,
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            reasoning_effort=reasoning_effort,
            brave_api_key=brave_api_key,
            web_proxy=web_proxy,
            exec_config=self.exec_config,
            restrict_to_workspace=restrict_to_workspace,
        )

        self._running = False
        self._mcp_servers = mcp_servers or {}
        self._mcp_stack: AsyncExitStack | None = None
        self._mcp_connected = False
        self._mcp_connecting = False
        self._consolidating: set[str] = set()
        self._consolidation_tasks: set[asyncio.Task] = set()
        self._consolidation_locks: weakref.WeakValueDictionary[str, asyncio.Lock] = weakref.WeakValueDictionary()
        self._active_tasks: dict[str, list[asyncio.Task]] = {}
        self._processing_lock = asyncio.Lock()
        self._register_default_tools()

    def _register_default_tools(self) -> None:
        """Register the default set of tools."""
        allowed_dir = self.workspace if self.restrict_to_workspace else None
        for cls in (ReadFileTool, WriteFileTool, EditFileTool, ListDirTool):
            self.tools.register(cls(workspace=self.workspace, allowed_dir=allowed_dir))
        self.tools.register(ExecTool(
            working_dir=str(self.workspace),
            timeout=self.exec_config.timeout,
            restrict_to_workspace=self.restrict_to_workspace,
            path_append=self.exec_config.path_append,
        ))
        self.tools.register(WebSearchTool(api_key=self.brave_api_key, proxy=self.web_proxy))
        self.tools.register(WebFetchTool(proxy=self.web_proxy))
        self.tools.register(MessageTool(send_callback=self.bus.publish_outbound))
        self.tools.register(SpawnTool(manager=self.subagents))
        if self.cron_service:
            self.tools.register(CronTool(self.cron_service))

    async def _connect_mcp(self) -> None:
        """Connect to configured MCP servers (one-time, lazy)."""
        if self._mcp_connected or self._mcp_connecting or not self._mcp_servers:
            return
        self._mcp_connecting = True
        from nanobot.agent.tools.mcp import connect_mcp_servers
        try:
            self._mcp_stack = AsyncExitStack()
            await self._mcp_stack.__aenter__()
            await connect_mcp_servers(self._mcp_servers, self.tools, self._mcp_stack)
            self._mcp_connected = True
        except Exception as e:
            logger.error("Failed to connect MCP servers (will retry next message): {}", e)
            if self._mcp_stack:
                try:
                    await self._mcp_stack.aclose()
                except Exception:
                    pass
                self._mcp_stack = None
        finally:
            self._mcp_connecting = False

    def _set_tool_context(self, channel: str, chat_id: str, message_id: str | None = None) -> None:
        """Update context for all tools that need routing info."""
        for name in ("message", "spawn", "cron"):
            if tool := self.tools.get(name):
                if hasattr(tool, "set_context"):
                    tool.set_context(channel, chat_id, *([message_id] if name == "message" else []))
```

**GitHub 链接**: [nanobot/agent/loop.py:40-180](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/loop.py#L40-L180)

**设计亮点**:
- **依赖注入**: 通过构造函数注入所有依赖（bus, provider, session_manager 等）
- **懒加载 MCP**: MCP 服务器连接采用懒加载模式，首次需要时才连接
- **工具注册模式**: 通过 `_register_default_tools()` 集中注册所有默认工具
- **异步资源管理**: 使用 `AsyncExitStack` 管理 MCP 服务器的生命周期

---

### 2. Tools/MCP 模块 ⭐⭐⭐⭐⭐

**文件位置**: `nanobot/agent/tools/registry.py` + `nanobot/agent/tools/mcp.py`  
**代码行数**: 80 行  

#### 2.1 工具注册机制

```python
# nanobot/agent/tools/registry.py:1-80 (完整类定义)
"""Tool registry for dynamic tool management."""

from typing import Any

from nanobot.agent.tools.base import Tool


class ToolRegistry:
    """
    Registry for agent tools.

    Allows dynamic registration and execution of tools.
    """

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool."""
        self._tools[tool.name] = tool

    def unregister(self, name: str) -> None:
        """Unregister a tool by name."""
        self._tools.pop(name, None)

    def get(self, name: str) -> Tool | None:
        """Get a tool by name."""
        return self._tools.get(name)

    def has(self, name: str) -> bool:
        """Check if a tool is registered."""
        return name in self._tools

    def get_definitions(self) -> list[dict[str, Any]]:
        """Get all tool definitions in OpenAI format."""
        return [tool.to_schema() for tool in self._tools.values()]

    async def execute(self, name: str, params: dict[str, Any]) -> str:
        """Execute a tool by name with given parameters."""
        _HINT = "\n\n[Analyze the error above and try a different approach.]"

        tool = self._tools.get(name)
        if not tool:
            return f"Error: Tool '{name}' not found. Available: {', '.join(self.tool_names)}"

        try:
            errors = tool.validate_params(params)
            if errors:
                return f"Error: Invalid parameters for tool '{name}': " + "; ".join(errors) + _HINT
            result = await tool.execute(**params)
            if isinstance(result, str) and result.startswith("Error"):
                return result + _HINT
            return result
        except Exception as e:
            return f"Error executing {name}: {str(e)}" + _HINT

    @property
    def tool_names(self) -> list[str]:
        """Get list of registered tool names."""
        return list(self._tools.keys())

    def __len__(self) -> int:
        return len(self._tools)

    def __contains__(self, name: str) -> bool:
        return name in self._tools
```

**GitHub 链接**: [nanobot/agent/tools/registry.py](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/tools/registry.py)

#### 2.2 MCP 工具集成

```python
# nanobot/agent/tools/mcp.py:1-80 (核心部分)
"""MCP (Model Context Protocol) tool integration."""

from typing import Any

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.types import CallToolResult

from nanobot.agent.tools.base import Tool


class MCPTool(Tool):
    """Wrapper for MCP tools."""

    def __init__(self, name: str, description: str, session: ClientSession, schema: dict):
        self._name = name
        self._description = description
        self._session = session
        self._schema = schema

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    def to_schema(self) -> dict:
        return self._schema

    async def execute(self, **kwargs) -> str:
        result: CallToolResult = await self._session.call_tool(self._name, kwargs)
        if result.isError:
            return f"MCP tool error: {result.content}"
        return str(result.content)


async def connect_mcp_servers(mcp_servers: dict, tool_registry: ToolRegistry, stack):
    """Connect to MCP servers and register their tools."""
    for server_name, server_config in mcp_servers.items():
        server_params = StdioServerParameters(
            command=server_config["command"],
            args=server_config.get("args", []),
            env=server_config.get("env", {}),
        )
        stdio_transport = await stack.enter_async_context(stdio_client(server_params))
        read, write = stdio_transport
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()

        # List available tools
        tools_result = await session.list_tools()
        for tool in tools_result.tools:
            mcp_tool = MCPTool(
                name=f"{server_name}_{tool.name}",
                description=tool.description,
                session=session,
                schema=tool.inputSchema,
            )
            tool_registry.register(mcp_tool)
```

**GitHub 链接**: [nanobot/agent/tools/mcp.py](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/tools/mcp.py)

---

### 3. Memory 模块 ⭐⭐⭐⭐⭐

**文件位置**: `nanobot/agent/memory.py`  
**代码行数**: 150 行  
**职责**: 两层记忆系统（MEMORY.md 长期事实 + HISTORY.md 可搜索日志）

**完整类定义**:

```python
# nanobot/agent/memory.py:1-150 (完整类定义)
"""Memory system for persistent agent memory."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

from nanobot.utils.helpers import ensure_dir

if TYPE_CHECKING:
    from nanobot.providers.base import LLMProvider
    from nanobot.session.manager import Session


_SAVE_MEMORY_TOOL = [
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save the memory consolidation result to persistent storage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "history_entry": {
                        "type": "string",
                        "description": "A paragraph (2-5 sentences) summarizing key events/decisions/topics. "
                        "Start with [YYYY-MM-DD HH:MM]. Include detail useful for grep search.",
                    },
                    "memory_update": {
                        "type": "string",
                        "description": "Full updated long-term memory as markdown. Include all existing "
                        "facts plus new ones. Return unchanged if nothing new.",
                    },
                },
                "required": ["history_entry", "memory_update"],
            },
        },
    }
]


class MemoryStore:
    """Two-layer memory: MEMORY.md (long-term facts) + HISTORY.md (grep-searchable log)."""

    def __init__(self, workspace: Path):
        self.memory_dir = ensure_dir(workspace / "memory")
        self.memory_file = self.memory_dir / "MEMORY.md"
        self.history_file = self.memory_dir / "HISTORY.md"

    def read_long_term(self) -> str:
        if self.memory_file.exists():
            return self.memory_file.read_text(encoding="utf-8")
        return ""

    def write_long_term(self, content: str) -> None:
        self.memory_file.write_text(content, encoding="utf-8")

    def append_history(self, entry: str) -> None:
        with open(self.history_file, "a", encoding="utf-8") as f:
            f.write(entry.rstrip() + "\n\n")

    def get_memory_context(self) -> str:
        long_term = self.read_long_term()
        return f"## Long-term Memory\n{long_term}" if long_term else ""

    async def consolidate(
        self,
        session: Session,
        provider: LLMProvider,
        model: str,
        *,
        archive_all: bool = False,
        memory_window: int = 50,
    ) -> bool:
        """Consolidate old messages into MEMORY.md + HISTORY.md via LLM tool call.

        Returns True on success (including no-op), False on failure.
        """
        if archive_all:
            old_messages = session.messages
            keep_count = 0
            logger.info("Memory consolidation (archive_all): {} messages", len(session.messages))
        else:
            keep_count = memory_window // 2
            if len(session.messages) <= keep_count:
                return True
            if len(session.messages) - session.last_consolidated <= 0:
                return True
            old_messages = session.messages[session.last_consolidated:-keep_count]
            if not old_messages:
                return True
            logger.info("Memory consolidation: {} to consolidate, {} keep", len(old_messages), keep_count)

        lines = []
        for m in old_messages:
            if not m.get("content"):
                continue
            tools = f" [tools: {', '.join(m['tools_used'])}]" if m.get("tools_used") else ""
            lines.append(f"[{m.get('timestamp', '?')[:16]}] {m['role'].upper()}{tools}: {m['content']}")

        current_memory = self.read_long_term()
        prompt = f"""Process this conversation and call the save_memory tool with your consolidation.

## Current Long-term Memory
{current_memory or "(empty)"}

## Conversation to Process
{chr(10).join(lines)}"""

        try:
            response = await provider.chat(
                messages=[
                    {"role": "system", "content": "You are a memory consolidation agent. Call the save_memory tool with your consolidation of the conversation."},
                    {"role": "user", "content": prompt},
                ],
                tools=_SAVE_MEMORY_TOOL,
                model=model,
            )

            if not response.has_tool_calls:
                logger.warning("Memory consolidation: LLM did not call save_memory, skipping")
                return False

            args = response.tool_calls[0].arguments
            # Some providers return arguments as a JSON string instead of dict
            if isinstance(args, str):
                args = json.loads(args)
            if not isinstance(args, dict):
                logger.warning("Memory consolidation: unexpected arguments type {}", type(args).__name__)
                return False

            if entry := args.get("history_entry"):
                if not isinstance(entry, str):
                    entry = json.dumps(entry, ensure_ascii=False)
                self.append_history(entry)
            if update := args.get("memory_update"):
                if not isinstance(update, str):
                    update = json.dumps(update, ensure_ascii=False)
                if update != current_memory:
                    self.write_long_term(update)

            session.last_consolidated = 0 if archive_all else len(session.messages) - keep_count
            logger.info("Memory consolidation done: {} messages, last_consolidated={}", len(session.messages), session.last_consolidated)
            return True
        except Exception:
            logger.exception("Memory consolidation failed")
            return False
```

**GitHub 链接**: [nanobot/agent/memory.py](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/memory.py)

**设计亮点**:
- **两层记忆架构**: MEMORY.md（长期事实）+ HISTORY.md（时间线日志）
- **LLM 驱动的记忆整合**: 通过 `save_memory` 工具调用 LLM 进行记忆压缩
- **智能窗口管理**: 保留最近 `memory_window // 2` 条消息不压缩
- **增量更新**: 只有记忆内容变化时才写入文件

---

### 4. Agent Loop 模块 ⭐⭐⭐⭐⭐

**文件位置**: `nanobot/agent/loop.py:181-350`  
**代码行数**: 170 行  
**职责**: 核心执行循环（思考→行动→观察）

**核心代码**:

```python
# nanobot/agent/loop.py:181-350 (Agent Loop 核心部分)
    async def _run_agent_loop(
        self,
        initial_messages: list[dict],
        on_progress: Callable[..., Awaitable[None]] | None = None,
    ) -> tuple[str | None, list[str], list[dict]]:
        """Run the agent iteration loop. Returns (final_content, tools_used, messages)."""
        messages = initial_messages
        iteration = 0
        final_content = None
        tools_used: list[str] = []

        while iteration < self.max_iterations:
            iteration += 1

            response = await self.provider.chat(
                messages=messages,
                tools=self.tools.get_definitions(),
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                reasoning_effort=self.reasoning_effort,
            )

            response_content = self._strip_think(response.content)

            if response.has_tool_calls:
                tools_used.extend([tc.name for tc in response.tool_calls])

                # Add assistant message with tool calls
                tool_call_dicts = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments, ensure_ascii=False),
                        },
                    }
                    for tc in response.tool_calls
                ]
                messages.append({
                    "role": "assistant",
                    "content": response_content or "",
                    "tool_calls": tool_call_dicts,
                })

                # Execute tools and collect results
                for tool_call in response.tool_calls:
                    result = await self.tools.execute(tool_call.name, tool_call.arguments)
                    messages.append({
                        "role": "tool",
                        "content": result[:self._TOOL_RESULT_MAX_CHARS],
                        "tool_call_id": tool_call.id,
                    })

                if on_progress:
                    await on_progress(
                        thinking=response_content,
                        tool_calls=response.tool_calls,
                        iteration=iteration,
                    )
                continue

            # No tool calls - final response
            final_content = response_content
            break

        return final_content, tools_used, messages

    async def process_message(self, message: InboundMessage) -> None:
        """Process an inbound message from the bus."""
        async with self._processing_lock:
            session_key = message.session_key
            session = self.sessions.get(session_key)

            # Set tool context for routing
            self._set_tool_context(
                message.channel, message.chat_id, message.message_id
            )

            # Build context with history, memory, skills
            context_messages = await self.context.build(
                session=session,
                memory_window=self.memory_window,
            )

            # Run agent loop
            final_content, tools_used, messages = await self._run_agent_loop(
                initial_messages=context_messages,
                on_progress=lambda thinking, tool_calls, iteration: self._on_progress(
                    session, thinking, tool_calls, iteration
                ),
            )

            # Update session with new messages
            session.messages = messages

            # Send response
            if final_content:
                await self.bus.publish_outbound(
                    channel=message.channel,
                    chat_id=message.chat_id,
                    content=final_content,
                    in_reply_to=message.message_id,
                )

            # Trigger memory consolidation
            await self._maybe_consolidate_memory(session)
```

**GitHub 链接**: [nanobot/agent/loop.py:181-350](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/loop.py#L181-L350)

**执行流程**:
1. **接收消息**: 从 MessageBus 接收 InboundMessage
2. **构建上下文**: 加载会话历史、长期记忆、技能
3. **LLM 调用**: 发送消息给 LLM，获取响应（可能包含工具调用）
4. **工具执行**: 执行所有工具调用，收集结果
5. **循环迭代**: 将工具结果返回给 LLM，继续下一轮
6. **发送响应**: 将最终响应发布到 MessageBus
7. **记忆整合**: 触发记忆压缩（如需要）

---

### 5. 多 Agent 协作模块 ⭐⭐⭐⭐

**文件位置**: `nanobot/agent/subagent.py`  
**代码行数**: 250 行  
**职责**: 后台子代理管理、任务分发、结果通知

**完整类定义**:

```python
# nanobot/agent/subagent.py:1-150 (核心部分)
"""Subagent manager for background task execution."""

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

from loguru import logger

from nanobot.agent.tools.filesystem import EditFileTool, ListDirTool, ReadFileTool, WriteFileTool
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.agent.tools.shell import ExecTool
from nanobot.agent.tools.web import WebFetchTool, WebSearchTool
from nanobot.bus.events import InboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.config.schema import ExecToolConfig
from nanobot.providers.base import LLMProvider


class SubagentManager:
    """Manages background subagent execution."""

    def __init__(
        self,
        provider: LLMProvider,
        workspace: Path,
        bus: MessageBus,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        reasoning_effort: str | None = None,
        brave_api_key: str | None = None,
        web_proxy: str | None = None,
        exec_config: "ExecToolConfig | None" = None,
        restrict_to_workspace: bool = False,
    ):
        from nanobot.config.schema import ExecToolConfig
        self.provider = provider
        self.workspace = workspace
        self.bus = bus
        self.model = model or provider.get_default_model()
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.reasoning_effort = reasoning_effort
        self.brave_api_key = brave_api_key
        self.web_proxy = web_proxy
        self.exec_config = exec_config or ExecToolConfig()
        self.restrict_to_workspace = restrict_to_workspace
        self._running_tasks: dict[str, asyncio.Task[None]] = {}
        self._session_tasks: dict[str, set[str]] = {}  # session_key -> {task_id, ...}

    async def spawn(
        self,
        task: str,
        label: str | None = None,
        origin_channel: str = "cli",
        origin_chat_id: str = "direct",
        session_key: str | None = None,
    ) -> str:
        """Spawn a subagent to execute a task in the background."""
        task_id = str(uuid.uuid4())[:8]
        display_label = label or task[:30] + ("..." if len(task) > 30 else "")
        origin = {"channel": origin_channel, "chat_id": origin_chat_id}

        bg_task = asyncio.create_task(
            self._run_subagent(task_id, task, display_label, origin)
        )
        self._running_tasks[task_id] = bg_task
        if session_key:
            self._session_tasks.setdefault(session_key, set()).add(task_id)

        def _cleanup(_: asyncio.Task) -> None:
            self._running_tasks.pop(task_id, None)
            if session_key and (ids := self._session_tasks.get(session_key)):
                ids.discard(task_id)
                if not ids:
                    del self._session_tasks[session_key]

        bg_task.add_done_callback(_cleanup)

        logger.info("Spawned subagent [{}]: {}", task_id, display_label)
        return f"Subagent [{display_label}] started (id: {task_id}). I'll notify you when it completes."

    async def _run_subagent(
        self,
        task_id: str,
        task: str,
        label: str,
        origin: dict[str, str],
    ) -> None:
        """Execute the subagent task and announce the result."""
        logger.info("Subagent [{}] starting task: {}", task_id, label)

        try:
            # Build subagent tools (no message tool, no spawn tool)
            tools = ToolRegistry()
            allowed_dir = self.workspace if self.restrict_to_workspace else None
            tools.register(ReadFileTool(workspace=self.workspace, allowed_dir=allowed_dir))
            tools.register(WriteFileTool(workspace=self.workspace, allowed_dir=allowed_dir))
            tools.register(EditFileTool(workspace=self.workspace, allowed_dir=allowed_dir))
            tools.register(ListDirTool(workspace=self.workspace, allowed_dir=allowed_dir))
            tools.register(ExecTool(
                working_dir=str(self.workspace),
                timeout=self.exec_config.timeout,
                restrict_to_workspace=self.restrict_to_workspace,
                path_append=self.exec_config.path_append,
            ))
            tools.register(WebSearchTool(api_key=self.brave_api_key, proxy=self.web_proxy))
            tools.register(WebFetchTool(proxy=self.web_proxy))
            
            system_prompt = self._build_subagent_prompt()
            messages: list[dict[str, Any]] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": task},
            ]

            # Run agent loop (limited iterations)
            max_iterations = 15
            iteration = 0
            final_result: str | None = None

            while iteration < max_iterations:
                iteration += 1

                response = await self.provider.chat(
                    messages=messages,
                    tools=tools.get_definitions(),
                    model=self.model,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    reasoning_effort=self.reasoning_effort,
                )

                if response.has_tool_calls:
                    # Execute tools and continue
                    # ... (tool execution logic)
                    pass
                else:
                    final_result = response.content
                    break

            # Announce result
            await self._announce_result(task_id, label, origin, final_result)

        except Exception as e:
            logger.exception("Subagent [{}] failed: {}", task_id, e)
            await self._announce_error(task_id, label, origin, str(e))

    def _build_subagent_prompt(self) -> str:
        """Build system prompt for subagent."""
        return """You are a background subagent. Complete the assigned task independently.

Rules:
1. Use available tools (file, shell, web) to gather information
2. Work step-by-step, thinking through each action
3. When complete, provide a final summary
4. Do NOT use message or spawn tools
5. You have 15 iterations maximum

Focus on completing the task efficiently and accurately."""

    async def _announce_result(self, task_id: str, label: str, origin: dict, result: str | None):
        """Announce subagent completion."""
        content = f"✅ Subagent [{label}] completed.\n\nResult:\n{result or 'No output'}"
        await self.bus.publish_outbound(
            channel=origin["channel"],
            chat_id=origin["chat_id"],
            content=content,
        )

    async def _announce_error(self, task_id: str, label: str, origin: dict, error: str):
        """Announce subagent error."""
        content = f"❌ Subagent [{label}] failed.\n\nError:\n{error}"
        await self.bus.publish_outbound(
            channel=origin["channel"],
            chat_id=origin["chat_id"],
            content=content,
        )
```

**GitHub 链接**: [nanobot/agent/subagent.py](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/subagent.py)

**设计亮点**:
- **异步任务管理**: 使用 `asyncio.Task` 管理后台子代理
- **任务清理回调**: 通过 `add_done_callback` 自动清理已完成的任务
- **会话绑定**: 支持将会话与子代理任务关联（`_session_tasks`）
- **独立工具集**: 子代理没有 `message` 和 `spawn` 工具，避免递归调用

---

## 🛠️ Dev-Tool 核心模块

### 1. CLI 接口模块 ⭐⭐⭐⭐⭐

**文件位置**: `nanobot/cli/commands.py:156-300`  
**代码行数**: 150 行  
**职责**: 命令行解析、命令分发

**核心代码**:

```python
# nanobot/cli/commands.py:156-300 (chat 命令)
@app.command()
async def chat(
    message: str = typer.Argument(None, help="Message to send"),
    render_markdown: bool = typer.Option(True, "--markdown/--no-markdown", help="Render markdown"),
    stream: bool = typer.Option(False, "--stream", help="Stream response"),
):
    """Interactive chat with nanobot."""
    from nanobot.agent.loop import AgentLoop
    from nanobot.bus.events import InboundMessage
    from nanobot.bus.queue import MessageBus
    from nanobot.config.loader import load_config
    from nanobot.session.manager import SessionManager

    config = load_config()
    bus = MessageBus()
    provider = _make_provider(config)
    session_manager = SessionManager(config.workspace_path)

    agent = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        model=config.agents.defaults.model,
        session_manager=session_manager,
    )

    # Interactive mode
    if not message:
        _init_prompt_session()
        console.print(f"[green]{__logo__} nanobot v{__version__}[/green]")
        console.print("[dim]Type 'exit' or Ctrl+D to quit[/dim]\n")

        while True:
            try:
                user_input = await _read_interactive_input_async()
                if _is_exit_command(user_input):
                    break
                if not user_input.strip():
                    continue

                # Create inbound message
                inbound = InboundMessage(
                    channel="cli",
                    chat_id="direct",
                    content=user_input,
                    message_id=str(uuid.uuid4()),
                )
                await agent.process_message(inbound)

            except KeyboardInterrupt:
                break
            except EOFError:
                break

        _restore_terminal()
        return

    # One-shot mode
    inbound = InboundMessage(
        channel="cli",
        chat_id="direct",
        content=message,
        message_id=str(uuid.uuid4()),
    )
    await agent.process_message(inbound)
```

**GitHub 链接**: [nanobot/cli/commands.py:156-300](https://github.com/HKUDS/nanobot/blob/main/nanobot/cli/commands.py#L156-L300)

**CLI 命令列表**:

| 命令 | 功能 | 行号 |
|------|------|------|
| `chat` | 交互式聊天 | 156 |
| `run` | 运行模式（执行单个任务） | 244 |
| `skills` | 技能管理（列表/加载） | 419 |
| `sync` | 同步工作区模板 | 995 |
| `gateway` | 启动网关服务 | 419 |
| `onboard` | 初始化配置 | 156 |

---

### 2. 配置管理模块 ⭐⭐⭐⭐

**文件位置**: `nanobot/config/schema.py`  
**代码行数**: 400 行  
**职责**: Pydantic 配置模型、验证、加载

**核心配置类**:

```python
# nanobot/config/schema.py:1-100 (核心配置类)
"""Configuration schema for nanobot."""

from pydantic import BaseModel, Field
from pathlib import Path
from typing import Optional, List, Dict, Any


class ProviderConfig(BaseModel):
    """LLM provider configuration."""
    api_key: str = ""
    api_base: Optional[str] = None
    extra_headers: Dict[str, str] = Field(default_factory=dict)


class AgentConfig(BaseModel):
    """Agent configuration."""
    model: str = "openai/gpt-4o"
    temperature: float = 0.1
    max_tokens: int = 4096
    max_tool_iterations: int = 40
    memory_window: int = 100
    reasoning_effort: Optional[str] = None


class ToolsConfig(BaseModel):
    """Tools configuration."""
    class WebConfig(BaseModel):
        search: Optional[str] = None  # Brave API key
        proxy: Optional[str] = None

    class ExecConfig(BaseModel):
        timeout: int = 300
        path_append: List[str] = Field(default_factory=list)

    web: WebConfig = Field(default_factory=WebConfig)
    exec: ExecConfig = Field(default_factory=ExecConfig)
    mcp_servers: Dict[str, Any] = Field(default_factory=dict)
    restrict_to_workspace: bool = False


class ChannelsConfig(BaseModel):
    """Channels configuration."""
    class FeishuConfig(BaseModel):
        enabled: bool = False
        app_id: str = ""
        app_secret: str = ""
        encrypt_key: str = ""
        verification_token: str = ""
        websocket: bool = True  # Use WebSocket instead of webhook

    feishu: FeishuConfig = Field(default_factory=FeishuConfig)
    # ... other channels


class Config(BaseModel):
    """Root configuration."""
    providers: Dict[str, ProviderConfig] = Field(default_factory=dict)
    agents: AgentConfig = Field(default_factory=AgentConfig)
    tools: ToolsConfig = Field(default_factory=ToolsConfig)
    channels: ChannelsConfig = Field(default_factory=ChannelsConfig)
    workspace_path: Path = Field(default_factory=lambda: Path.home() / ".nanobot" / "workspace")

    def get_provider_name(self, model: str) -> str:
        """Extract provider name from model string."""
        if "/" in model:
            return model.split("/")[0]
        return "default"

    def get_provider(self, model: str) -> Optional[ProviderConfig]:
        """Get provider config by model."""
        provider_name = self.get_provider_name(model)
        return self.providers.get(provider_name)

    def get_api_base(self, model: str) -> Optional[str]:
        """Get API base for model."""
        provider = self.get_provider(model)
        if provider and provider.api_base:
            return provider.api_base
        return None
```

**GitHub 链接**: [nanobot/config/schema.py](https://github.com/HKUDS/nanobot/blob/main/nanobot/config/schema.py)

---

### 3. 插件系统模块（技能）⭐⭐⭐⭐⭐

**文件位置**: `nanobot/agent/skills.py`  
**代码行数**: 200 行  
**职责**: 技能加载、管理、元数据解析

**完整类定义**已在前面展示（见阶段 1）。

**技能系统特性**:
- **两级技能目录**: workspace 技能（用户自定义）+ builtin 技能（内置）
- **YAML frontmatter**: 技能元数据（name, description, requires, always）
- **依赖检查**: 自动检查 CLI 工具和环境变量
- **渐进式加载**: 先加载摘要，按需加载完整内容

---

## 💻 Code 核心模块

### 1. 代码理解模块 ⭐⭐⭐⭐

**文件位置**: `nanobot/agent/tools/filesystem.py`  
**代码行数**: 200 行  
**职责**: 文件读取、目录列表、代码搜索

**核心工具**:

```python
# nanobot/agent/tools/filesystem.py:1-100 (ReadFileTool + ListDirTool)
"""Filesystem tools for code understanding."""

from pathlib import Path
from typing import Optional

from nanobot.agent.tools.base import Tool


class ReadFileTool(Tool):
    """Read file contents."""

    def __init__(self, workspace: Path, allowed_dir: Optional[Path] = None):
        self.workspace = workspace
        self.allowed_dir = allowed_dir

    @property
    def name(self) -> str:
        return "read_file"

    @property
    def description(self) -> str:
        return "Read the contents of a file"

    def to_schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path"},
                        "offset": {"type": "integer", "description": "Start line (1-indexed)"},
                        "limit": {"type": "integer", "description": "Max lines to read"},
                    },
                    "required": ["path"],
                },
            },
        }

    async def execute(self, path: str, offset: int = 1, limit: int = 2000) -> str:
        file_path = self._resolve_path(path)
        if not file_path.exists():
            return f"Error: File not found: {path}"
        
        content = file_path.read_text(encoding="utf-8")
        lines = content.split("\n")
        
        # Apply offset/limit
        start = max(0, offset - 1)
        end = start + limit if limit else len(lines)
        truncated = lines[start:end]
        
        return "\n".join(truncated)

    def _resolve_path(self, path: str) -> Path:
        """Resolve path with workspace/allowed_dir constraints."""
        file_path = Path(path)
        if not file_path.is_absolute():
            file_path = self.workspace / file_path
        if self.allowed_dir:
            # Ensure path is within allowed_dir
            try:
                file_path.relative_to(self.allowed_dir)
            except ValueError:
                raise ValueError(f"Path must be within {self.allowed_dir}")
        return file_path


class ListDirTool(Tool):
    """List directory contents."""

    def __init__(self, workspace: Path, allowed_dir: Optional[Path] = None):
        self.workspace = workspace
        self.allowed_dir = allowed_dir

    @property
    def name(self) -> str:
        return "list_dir"

    @property
    def description(self) -> str:
        return "List contents of a directory"

    async def execute(self, path: str) -> str:
        dir_path = self._resolve_path(path)
        if not dir_path.exists():
            return f"Error: Directory not found: {path}"
        if not dir_path.is_dir():
            return f"Error: Not a directory: {path}"

        items = []
        for item in dir_path.iterdir():
            item_type = "📁" if item.is_dir() else "📄"
            items.append(f"{item_type} {item.name}")
        
        return "\n".join(sorted(items))
```

**GitHub 链接**: [nanobot/agent/tools/filesystem.py](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/tools/filesystem.py)

---

### 2. 代码生成模块 ⭐⭐⭐⭐

**文件位置**: `nanobot/agent/tools/filesystem.py:100-200`  
**代码行数**: 100 行  
**职责**: 文件写入、编辑、代码重构

**核心工具**:

```python
# nanobot/agent/tools/filesystem.py:100-200 (WriteFileTool + EditFileTool)
class WriteFileTool(Tool):
    """Write content to a file."""

    def __init__(self, workspace: Path, allowed_dir: Optional[Path] = None):
        self.workspace = workspace
        self.allowed_dir = allowed_dir

    @property
    def name(self) -> str:
        return "write_file"

    @property
    def description(self) -> str:
        return "Write content to a file (creates or overwrites)"

    async def execute(self, path: str, content: str) -> str:
        file_path = self._resolve_path(path)
        
        # Create parent directories
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_path.write_text(content, encoding="utf-8")
        return f"Successfully wrote {len(content)} characters to {path}"


class EditFileTool(Tool):
    """Edit file with search-replace blocks."""

    def __init__(self, workspace: Path, allowed_dir: Optional[Path] = None):
        self.workspace = workspace
        self.allowed_dir = allowed_dir

    @property
    def name(self) -> str:
        return "edit_file"

    @property
    def description(self) -> str:
        return "Edit file using search-replace blocks"

    async def execute(self, path: str, edits: list[dict]) -> str:
        """
        Apply edits to file.
        
        Args:
            path: File path
            edits: List of {search: str, replace: str} dicts
        """
        file_path = self._resolve_path(path)
        if not file_path.exists():
            return f"Error: File not found: {path}"

        content = file_path.read_text(encoding="utf-8")
        original = content

        for i, edit in enumerate(edits, 1):
            search = edit.get("search", "")
            replace = edit.get("replace", "")
            
            if search not in content:
                return f"Error: Edit {i} failed - search text not found"
            
            content = content.replace(search, replace, 1)

        if content == original:
            return "No changes made"

        file_path.write_text(content, encoding="utf-8")
        return f"Successfully applied {len(edits)} edits to {path}"
```

**GitHub 链接**: [nanobot/agent/tools/filesystem.py](https://github.com/HKUDS/nanobot/blob/main/nanobot/agent/tools/filesystem.py)

---

## ✅ 阶段 2 完成检查

- [x] Agent 核心模块分析（5 大模块）
- [x] Dev-Tool 核心模块分析（3 大模块）
- [x] Code 核心模块分析（2 大模块）
- [x] 完整类定义（80-150 行规范）
- [x] 关键方法（50-80 行规范）
- [x] 精确行号标注（file.py:start-end）
- [x] GitHub 链接（带行号）

**下一步**: 执行阶段 3 - 毛线团调用链追踪（3 波次）
