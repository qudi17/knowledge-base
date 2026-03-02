# nanobot 调用链追踪报告

## 📊 追踪概览

- **追踪时间**: 2026-03-02
- **追踪方法**: GSD 波次执行（3 波次）
- **入口点**: CLI 启动、消息处理、工具执行

---

## 🌊 波次 1: CLI 启动流程

### 1.1 启动入口

**文件**: `__main__.py`

```python
# __main__.py:1-7 (7 行)
"""Entry point for running nanobot as a module: python -m nanobot"""

from nanobot.cli.commands import app

if __name__ == "__main__":
    app()
```

**调用链**:
```
python -m nanobot
    ↓
__main__.py:app()
    ↓
cli/commands.py:app() (Typer CLI)
```

---

### 1.2 Gateway 启动流程

**命令**: `nanobot gateway`

**调用链**:
```
cli/commands.py:gateway()
    ↓
1. load_config() → 加载配置
2. MessageBus() → 创建消息总线
3. _make_provider() → 创建 LLM 提供者
4. SessionManager() → 创建会话管理器
5. CronService() → 创建 Cron 服务
6. AgentLoop(...) → 创建代理循环
7. ChannelManager(...) → 创建频道管理器
8. agent.start() → 启动代理
9. manager.start_all() → 启动所有频道
10. dispatch_outbound_messages() → 启动消息分发
```

**关键代码** (`cli/commands.py:230-280`):
```python
@app.command()
def gateway(
    port: int = typer.Option(18790, "--port", "-p", help="Gateway port"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
):
    """Start the nanobot gateway."""
    from nanobot.agent.loop import AgentLoop
    from nanobot.bus.queue import MessageBus
    from nanobot.channels.manager import ChannelManager
    from nanobot.config.loader import get_data_dir, load_config
    from nanobot.cron.service import CronService
    from nanobot.cron.types import CronJob
    from nanobot.heartbeat.service import HeartbeatService
    from nanobot.session.manager import SessionManager

    config = load_config()
    sync_workspace_templates(config.workspace_path)
    bus = MessageBus()
    provider = _make_provider(config)
    session_manager = SessionManager(config.workspace_path)

    # Create cron service first (callback set after agent creation)
    cron_store_path = get_data_dir() / "cron" / "jobs.json"
    cron = CronService(cron_store_path)

    # Create agent with cron service
    agent = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        model=config.agents.defaults.model,
        temperature=config.agents.defaults.temperature,
        max_tokens=config.agents.defaults.max_tokens,
        max_iterations=config.agents.defaults.max_tool_iterations,
        memory_window=config.agents.defaults.memory_window,
        reasoning_effort=config.agents.defaults.reasoning_effort,
        brave_api_key=config.tools.web.search.api_key or None,
        web_proxy=config.tools.web.proxy or None,
        exec_config=config.tools.exec,
        cron_service=cron,
        restrict_to_workspace=config.tools.restrict_to_workspace,
        session_manager=session_manager,
        mcp_servers=config.tools.mcp_servers,
        channels_config=config.channels,
    )

    # Set cron callback (needs agent)
    async def on_cron_job(job: CronJob) -> str | None:
        """Execute a cron job through the agent."""
        # ... cron job execution logic

    # Create channel manager
    manager = ChannelManager(config, bus)

    # Start agent and channels
    await agent.start()
    await manager.start_all()

    # Start outbound message dispatcher
    await dispatch_outbound_messages(bus, manager)
```

---

### 1.3 提供者创建流程

**函数**: `_make_provider()`

**调用链**:
```
_make_provider(config)
    ↓
判断 provider_name:
    ├→ openai_codex → OpenAICodexProvider()
    ├→ custom → CustomProvider()
    └→ 其他 → LiteLLMProvider()
```

**关键代码** (`cli/commands.py:180-210`):
```python
def _make_provider(config: Config):
    """Create the appropriate LLM provider from config."""
    from nanobot.providers.custom_provider import CustomProvider
    from nanobot.providers.litellm_provider import LiteLLMProvider
    from nanobot.providers.openai_codex_provider import OpenAICodexProvider

    model = config.agents.defaults.model
    provider_name = config.get_provider_name(model)
    p = config.get_provider(model)

    # OpenAI Codex (OAuth)
    if provider_name == "openai_codex" or model.startswith("openai-codex/"):
        return OpenAICodexProvider(default_model=model)

    # Custom: direct OpenAI-compatible endpoint
    if provider_name == "custom":
        return CustomProvider(
            api_key=p.api_key if p else "no-key",
            api_base=config.get_api_base(model) or "http://localhost:8000/v1",
            default_model=model,
        )

    # LiteLLM provider (default)
    return LiteLLMProvider(
        api_key=p.api_key if p else None,
        api_base=config.get_api_base(model),
        default_model=model,
        extra_headers=p.extra_headers if p else None,
        provider_name=provider_name,
    )
```

---

## 🌊 波次 2: 消息处理流程

### 2.1 频道接收消息

**入口**: 任意频道（以 Discord 为例）

**调用链**:
```
Discord Gateway WebSocket
    ↓
discord.py:_handle_event()
    ↓
channels/base.py:_handle_message()
    ↓
bus/queue.py:publish_inbound()
    ↓
agent/loop.py:process_message()
```

**Discord 频道实现** (`channels/discord.py` 片段):
```python
class DiscordChannel(BaseChannel):
    """Discord channel using Gateway websocket."""
    
    async def start(self) -> None:
        """Start Discord Gateway connection."""
        import websockets
        self._running = True
        
        async with websockets.connect(self.config.gateway_url) as ws:
            # Send IDENTIFY payload
            await ws.send(json.dumps({
                "op": 2,  # IDENTIFY
                "d": {
                    "token": self.config.token,
                    "intents": self.config.intents,
                }
            }))
            
            # Listen for events
            async for message in ws:
                event = json.loads(message)
                await self._handle_event(event)
    
    async def _handle_event(self, event: dict) -> None:
        """Handle Discord Gateway event."""
        if event.get("t") == "MESSAGE_CREATE":
            data = event["d"]
            # Parse message and forward to bus
            await self._handle_message(
                sender_id=str(data["author"]["id"]),
                chat_id=str(data["channel_id"]),
                content=data["content"],
                metadata={"discord": data},
            )
```

---

### 2.2 消息总线传递

**文件**: `bus/queue.py`

**调用链**:
```
BaseChannel._handle_message()
    ↓
MessageBus.publish_inbound(msg)
    ↓
asyncio.Queue.put(msg)
    ↓
AgentLoop.process_message() (consumer)
```

**消息总线实现** (`bus/queue.py:1-35`):
```python
class MessageBus:
    """Async message bus that decouples chat channels from the agent core."""

    def __init__(self):
        self.inbound: asyncio.Queue[InboundMessage] = asyncio.Queue()
        self.outbound: asyncio.Queue[OutboundMessage] = asyncio.Queue()

    async def publish_inbound(self, msg: InboundMessage) -> None:
        """Publish a message from a channel to the agent."""
        await self.inbound.put(msg)

    async def consume_inbound(self) -> InboundMessage:
        """Consume the next inbound message (blocks until available)."""
        return await self.inbound.get()

    async def publish_outbound(self, msg: OutboundMessage) -> None:
        """Publish a response from the agent to channels."""
        await self.outbound.put(msg)

    async def consume_outbound(self) -> OutboundMessage:
        """Consume the next outbound message (blocks until available)."""
        return await self.outbound.get()
```

---

### 2.3 代理处理消息

**文件**: `agent/loop.py`

**调用链**:
```
AgentLoop.process_message()
    ↓
1. _connect_mcp() (lazy connect)
2. _set_tool_context() (设置工具上下文)
3. sessions.get_or_create() (获取/创建会话)
4. context.build_context() (构建上下文)
5. provider.chat() (调用 LLM)
6. 判断是否有 tool_calls:
   ├→ 有：执行工具 → 添加结果 → 继续循环
   └→ 无：返回最终响应
7. context.add_assistant_message() (添加到历史)
8. memory.add() (添加到记忆)
9. bus.publish_outbound() (发送响应)
```

**核心循环** (`agent/loop.py:180-250`):
```python
async def _run_agent_loop(
    self,
    initial_messages: list[dict],
    on_progress: Callable[..., Awaitable[None]] | None = None,
) -> tuple[str | None, list[str], list[dict]]:
    """Run the agent iteration loop."""
    messages = initial_messages
    iteration = 0
    final_content = None
    tools_used: list[str] = []

    while iteration < self.max_iterations:
        iteration += 1

        # Call LLM
        response = await self.provider.chat(
            messages=messages,
            tools=self.tools.get_definitions(),
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            reasoning_effort=self.reasoning_effort,
        )

        if response.has_tool_calls:
            # Report progress
            if on_progress:
                clean = self._strip_think(response.content)
                if clean:
                    await on_progress(clean)
                await on_progress(self._tool_hint(response.tool_calls), tool_hint=True)

            # Add assistant message with tool calls
            tool_call_dicts = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments, ensure_ascii=False)
                    }
                }
                for tc in response.tool_calls
            ]
            messages = self.context.add_assistant_message(
                messages, response.content, tool_call_dicts,
                reasoning_content=response.reasoning_content,
            )

            # Execute tool calls
            for tool_call in response.tool_calls:
                tools_used.append(tool_call.name)
                result = await self.tools.execute(tool_call.name, tool_call.arguments)
                messages = self.context.add_tool_result(
                    messages, tool_call.id, tool_call.name, result
                )
        else:
            # Final response
            clean = self._strip_think(response.content)
            if response.finish_reason == "error":
                logger.error("LLM returned error: {}", (clean or "")[:200])
                final_content = clean or "Sorry, I encountered an error."
                break
            messages = self.context.add_assistant_message(messages, clean)
            final_content = clean
            break

    return (final_content, tools_used, messages)
```

---

### 2.4 上下文构建

**文件**: `agent/context.py`

**调用链**:
```
ContextBuilder.build_context()
    ↓
1. 加载系统提示
2. 加载会话历史
3. 加载记忆（memory_window 条）
4. 加载技能（如有）
5. 合并为完整上下文
```

---

## 🌊 波次 3: 工具执行流程

### 3.1 工具注册

**文件**: `agent/loop.py` / `agent/tools/registry.py`

**调用链**:
```
AgentLoop.__init__()
    ↓
_register_default_tools()
    ↓
注册工具:
    ├→ ReadFileTool
    ├→ WriteFileTool
    ├→ EditFileTool
    ├→ ListDirTool
    ├→ ExecTool
    ├→ WebSearchTool
    ├→ WebFetchTool
    ├→ MessageTool
    ├→ SpawnTool
    └→ CronTool (如有 cron_service)
```

**工具注册** (`agent/loop.py:75-95`):
```python
def _register_default_tools(self) -> None:
    """Register the default set of tools."""
    allowed_dir = self.workspace if self.restrict_to_workspace else None
    
    # File system tools
    for cls in (ReadFileTool, WriteFileTool, EditFileTool, ListDirTool):
        self.tools.register(cls(workspace=self.workspace, allowed_dir=allowed_dir))
    
    # Shell tool
    self.tools.register(ExecTool(
        working_dir=str(self.workspace),
        timeout=self.exec_config.timeout,
        restrict_to_workspace=self.restrict_to_workspace,
        path_append=self.exec_config.path_append,
    ))
    
    # Web tools
    self.tools.register(WebSearchTool(api_key=self.brave_api_key, proxy=self.web_proxy))
    self.tools.register(WebFetchTool(proxy=self.web_proxy))
    
    # Message tool
    self.tools.register(MessageTool(send_callback=self.bus.publish_outbound))
    
    # Spawn tool
    self.tools.register(SpawnTool(manager=self.subagents))
    
    # Cron tool
    if self.cron_service:
        self.tools.register(CronTool(self.cron_service))
```

---

### 3.2 工具执行

**文件**: `agent/tools/registry.py`

**调用链**:
```
AgentLoop._run_agent_loop()
    ↓
tools.execute(tool_name, arguments)
    ↓
ToolRegistry.execute()
    ↓
找到对应 Tool 实例
    ↓
tool.execute(arguments)
    ↓
返回结果
```

**工具注册表** (`agent/tools/registry.py` 片段):
```python
class ToolRegistry:
    """Registry for agent tools."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool."""
        self._tools[tool.name] = tool

    async def execute(self, name: str, arguments: dict) -> str:
        """Execute a tool by name."""
        if name not in self._tools:
            return f"Error: Unknown tool '{name}'"
        
        tool = self._tools[name]
        try:
            result = await tool.execute(**arguments)
            return str(result)
        except Exception as e:
            logger.exception("Tool execution failed: {}", e)
            return f"Error executing {name}: {e}"

    def get_definitions(self) -> list[dict]:
        """Get all tool definitions for LLM."""
        return [tool.get_definition() for tool in self._tools.values()]
```

---

### 3.3 MCP 工具集成

**文件**: `agent/tools/mcp.py`

**调用链**:
```
AgentLoop._connect_mcp() (lazy)
    ↓
connect_mcp_servers()
    ↓
for each MCP server:
    ├→ 创建 MCP 客户端 (stdio 或 HTTP)
    ├→ 连接服务器
    ├→ 获取工具列表
    └→ 注册为 nanobot 工具
```

**MCP 连接** (`agent/tools/mcp.py` 片段):
```python
async def connect_mcp_servers(
    mcp_servers: dict, registry: ToolRegistry, stack: AsyncExitStack
) -> None:
    """Connect to configured MCP servers and register their tools."""
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    for name, cfg in mcp_servers.items():
        if cfg.url:
            # HTTP transport
            from mcp.client.streamable_http import streamable_http_client
            # ... HTTP connection logic
        elif cfg.command:
            # Stdio transport
            server_params = StdioServerParameters(
                command=cfg.command,
                args=cfg.args or [],
                env={**os.environ, **(cfg.env or {})},
            )
            stdio_transport = await stack.enter_async_context(stdio_client(server_params))
            session = await stack.enter_async_context(ClientSession(*stdio_transport))
            await session.initialize()
            
            # List tools and register
            response = await session.list_tools()
            for tool_def in response.tools:
                wrapper = MCPToolWrapper(name, tool_def, session)
                registry.register(wrapper)
```

---

## 📊 完整调用链总结

### 启动链

```
用户执行
    ↓
python -m nanobot
    ↓
__main__.py:app()
    ↓
cli/commands.py:gateway()
    ↓
1. load_config()
2. MessageBus()
3. _make_provider() → LiteLLMProvider/CustomProvider/OpenAICodexProvider
4. SessionManager()
5. CronService()
6. AgentLoop(...)
   ├→ _register_default_tools()
   └→ SubagentManager(...)
7. ChannelManager(...)
   ├→ TelegramChannel
   ├→ DiscordChannel
   ├→ FeishuChannel
   └→ ... (11 个频道)
8. agent.start()
9. manager.start_all()
10. dispatch_outbound_messages()
```

### 消息处理链

```
外部平台消息
    ↓
Channel.start() (WebSocket/API polling)
    ↓
BaseChannel._handle_message()
    ↓
MessageBus.publish_inbound()
    ↓
AgentLoop.process_message()
    ↓
1. _connect_mcp() (lazy)
2. _set_tool_context()
3. sessions.get_or_create()
4. context.build_context()
   ├→ 系统提示
   ├→ 会话历史
   ├→ 记忆 (memory_window 条)
   └→ 技能 (如有)
5. provider.chat()
6. 判断 tool_calls:
   ├→ 有：tools.execute() → 添加结果 → 继续循环
   └→ 无：返回响应
7. context.add_assistant_message()
8. memory.add()
9. bus.publish_outbound()
    ↓
ChannelManager.dispatch()
    ↓
Channel.send()
    ↓
外部平台响应
```

### 工具执行链

```
LLM 返回 tool_calls
    ↓
AgentLoop._run_agent_loop()
    ↓
tools.execute(tool_name, arguments)
    ↓
ToolRegistry.execute()
    ↓
Tool.execute(**arguments)
    ↓
具体工具实现:
    ├→ ReadFileTool: 读取文件
    ├→ WriteFileTool: 写入文件
    ├→ ExecTool: 执行 shell 命令
    ├→ WebSearchTool: 搜索网络
    ├→ WebFetchTool: 抓取网页
    ├→ MessageTool: 发送消息
    ├→ SpawnTool: 生成子代理
    └→ CronTool: 管理定时任务
    ↓
返回结果 → context.add_tool_result()
```

---

## 🔍 关键设计模式

### 1. 异步消息队列模式

```python
# 生产者（频道）
await bus.publish_inbound(msg)

# 消费者（代理）
msg = await bus.consume_inbound()
```

**优势**:
- 解耦生产者和消费者
- 异步非阻塞
- 背压支持（队列满时阻塞）

### 2. 策略模式（提供者）

```python
def _make_provider(config):
    if provider_name == "openai_codex":
        return OpenAICodexProvider()
    elif provider_name == "custom":
        return CustomProvider()
    else:
        return LiteLLMProvider()
```

**优势**:
- 运行时切换提供者
- 统一接口
- 易于扩展

### 3. 注册表模式（工具）

```python
registry.register(tool)
result = await registry.execute(name, args)
```

**优势**:
- 集中管理
- 动态发现
- 统一错误处理

### 4. 懒加载模式（MCP）

```python
async def _connect_mcp(self):
    if self._mcp_connected or self._mcp_connecting:
        return
    # 首次调用时才连接
```

**优势**:
- 延迟初始化
- 避免不必要的连接
- 失败自动重试

---

## 📈 性能指标

### 延迟分析

| 阶段 | 预估延迟 | 备注 |
|------|---------|------|
| 频道接收 | <10ms | WebSocket 实时 |
| 消息入队 | <1ms | asyncio.Queue |
| 上下文构建 | 10-50ms | 取决于记忆窗口 |
| LLM 调用 | 500-5000ms | 网络 + 模型推理 |
| 工具执行 | 10-1000ms | 取决于工具类型 |
| 消息出队 | <1ms | asyncio.Queue |
| 频道发送 | 10-100ms | API 调用 |

**总延迟**: 主要取决于 LLM 响应时间

---

## 🎯 异常处理

### 1. LLM 错误

```python
if response.finish_reason == "error":
    logger.error("LLM returned error: {}", (clean or "")[:200])
    final_content = "Sorry, I encountered an error."
    break  # 不添加到历史，避免上下文污染
```

### 2. 工具执行错误

```python
try:
    result = await tool.execute(**arguments)
except Exception as e:
    logger.exception("Tool execution failed: {}", e)
    return f"Error executing {name}: {e}"
```

### 3. MCP 连接失败

```python
try:
    await connect_mcp_servers(...)
    self._mcp_connected = True
except Exception as e:
    logger.error("Failed to connect MCP servers: {}", e)
    # 下次消息时重试
```

---

*生成时间：2026-03-02*
