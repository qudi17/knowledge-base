# nanobot 设计模式识别报告

## 📊 设计模式总览

| 模式类型 | 模式名称 | 使用位置 | 重要性 |
|---------|---------|---------|--------|
| **创建型** | 工厂模式 | providers/_make_provider() | ⭐⭐⭐ |
| **创建型** | 单例模式 | MessageBus | ⭐⭐ |
| **结构型** | 策略模式 | LLM Providers | ⭐⭐⭐⭐⭐ |
| **结构型** | 适配器模式 | Channels | ⭐⭐⭐⭐ |
| **结构型** | 装饰器模式 | Tool wrappers | ⭐⭐ |
| **行为型** | 观察者模式 | MessageBus | ⭐⭐⭐⭐⭐ |
| **行为型** | 命令模式 | Tools | ⭐⭐⭐⭐ |
| **行为型** | 迭代器模式 | AgentLoop | ⭐⭐⭐ |
| **行为型** | 状态模式 | Session | ⭐⭐ |

---

## 🏗️ 创建型模式

### 1. 工厂模式 (Factory Pattern)

**位置**: `cli/commands.py:_make_provider()`

**用途**: 根据配置创建不同的 LLM 提供者实例

**代码片段** (`cli/commands.py:180-215`, 36 行):
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

    # Custom: direct OpenAI-compatible endpoint, bypasses LiteLLM
    if provider_name == "custom":
        return CustomProvider(
            api_key=p.api_key if p else "no-key",
            api_base=config.get_api_base(model) or "http://localhost:8000/v1",
            default_model=model,
        )

    from nanobot.providers.registry import find_by_name
    spec = find_by_name(provider_name)
    if not model.startswith("bedrock/") and not (p and p.api_key) and not (spec and spec.is_oauth):
        console.print("[red]Error: No API key configured.[/red]")
        raise typer.Exit(1)

    return LiteLLMProvider(
        api_key=p.api_key if p else None,
        api_base=config.get_api_base(model),
        default_model=model,
        extra_headers=p.extra_headers if p else None,
        provider_name=provider_name,
    )
```

**关键特性**:
1. **条件分支**: 根据 provider_name 选择不同实现
2. **参数配置**: 从 config 提取参数
3. **错误处理**: API key 验证
4. **依赖注入**: 传入配置参数

**设计决策理由**:
- ✅ 解耦客户端和具体实现
- ✅ 易于添加新提供者
- ✅ 集中管理创建逻辑

**权衡分析**:
- 优点：灵活性高，符合开闭原则
- 缺点：工厂函数可能变得复杂

---

### 2. 单例模式 (Singleton Pattern)

**位置**: `bus/queue.py:MessageBus`

**用途**: 全局唯一的消息总线实例

**代码片段** (`bus/queue.py:1-45`, 45 行):
```python
class MessageBus:
    """
    Async message bus that decouples chat channels from the agent core.

    Channels push messages to the inbound queue, and the agent processes
    them and pushes responses to the outbound queue.
    """

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

    @property
    def inbound_size(self) -> int:
        """Number of pending inbound messages."""
        return self.inbound.qsize()

    @property
    def outbound_size(self) -> int:
        """Number of pending outbound messages."""
        return self.outbound.qsize()
```

**关键特性**:
1. **全局共享**: 在 gateway 中创建一次，传递给所有组件
2. **线程安全**: asyncio.Queue 天然异步安全
3. **简单实现**: 通过依赖注入实现单例，而非强制单例

**设计决策理由**:
- ✅ 解耦生产者和消费者
- ✅ 异步非阻塞
- ✅ 背压支持

---

## 🏛️ 结构型模式

### 3. 策略模式 (Strategy Pattern) ⭐⭐⭐⭐⭐

**位置**: `providers/` 目录

**用途**: 封装不同的 LLM 提供者算法

**类层次**:
```
LLMProvider (基类)
    ├→ LiteLLMProvider
    ├→ CustomProvider
    └→ OpenAICodexProvider
```

**基类代码** (`providers/base.py:1-80`, 80 行):
```python
class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    def __init__(self, default_model: str, api_base: str | None = None):
        self.default_model = default_model
        self.api_base = api_base
    
    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        reasoning_effort: str | None = None,
    ) -> LLMResponse:
        """Call the LLM and return response."""
        pass
    
    def get_default_model(self) -> str:
        """Get the default model name."""
        return self.default_model


@dataclass
class LLMResponse:
    """Response from LLM."""
    content: str | None
    reasoning_content: str | None = None
    thinking_blocks: list[dict] | None = None
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    
    @property
    def has_tool_calls(self) -> bool:
        """Check if response contains tool calls."""
        return bool(self.tool_calls)
```

**实现示例** (`providers/litellm_provider.py:1-120`, 120 行):
```python
class LiteLLMProvider(LLMProvider):
    """LLM provider using LiteLLM library."""
    
    def __init__(
        self,
        api_key: str | None,
        api_base: str | None,
        default_model: str,
        extra_headers: dict | None,
        provider_name: str,
    ):
        super().__init__(default_model, api_base)
        self.api_key = api_key
        self.extra_headers = extra_headers
        self.provider_name = provider_name
        
        # Set LiteLLM environment
        if api_key:
            os.environ[f"{provider_name.upper()}_API_KEY"] = api_key
        if api_base:
            os.environ[f"{provider_name.upper()}_API_BASE"] = api_base
    
    async def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        reasoning_effort: str | None = None,
    ) -> LLMResponse:
        """Call LLM via LiteLLM."""
        import litellm
        
        model = model or self.default_model
        
        # Configure for specific provider
        litellm.drop_params = True
        litellm.set_verbose = False
        
        # Add provider-specific overrides
        kwargs = self._get_model_overrides(model)
        
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
            extra_headers=self.extra_headers,
            **kwargs,
        )
        
        # Parse response
        content = response.choices[0].message.content
        tool_calls = self._parse_tool_calls(response.choices[0].message.tool_calls)
        
        return LLMResponse(
            content=content,
            tool_calls=tool_calls,
            finish_reason=response.choices[0].finish_reason,
        )
```

**关键特性**:
1. **统一接口**: 所有提供者实现相同的 `chat()` 方法
2. **运行时切换**: 通过配置切换提供者
3. **封装变化**: 每个提供者的实现细节被封装

**设计决策理由**:
- ✅ 符合开闭原则（对扩展开放，对修改关闭）
- ✅ 消除大量条件语句
- ✅ 每个提供者独立测试

**权衡分析**:
- 优点：高度灵活，易于添加新提供者
- 缺点：需要维护多个实现类

---

### 4. 适配器模式 (Adapter Pattern)

**位置**: `channels/` 目录

**用途**: 将不同聊天平台适配到统一接口

**类层次**:
```
BaseChannel (抽象接口)
    ├→ TelegramChannel
    ├→ DiscordChannel
    ├→ FeishuChannel
    ├→ DingTalkChannel
    ├→ WhatsAppChannel
    ├→ SlackChannel
    ├→ MatrixChannel
    ├→ MoChatChannel
    ├→ QQChannel
    ├→ EmailChannel
    └→ TelegramChannel
```

**适配器接口** (`channels/base.py:1-90`, 90 行):
```python
class BaseChannel(ABC):
    """
    Abstract base class for chat channel implementations.

    Each channel (Telegram, Discord, etc.) should implement this interface
    to integrate with the nanobot message bus.
    """

    name: str = "base"

    def __init__(self, config: Any, bus: MessageBus):
        self.config = config
        self.bus = bus
        self._running = False

    @abstractmethod
    async def start(self) -> None:
        """
        Start the channel and begin listening for messages.

        This should be a long-running async task that:
        1. Connects to the chat platform
        2. Listens for incoming messages
        3. Forwards messages to the bus via _handle_message()
        """
        pass

    @abstractmethod
    async def stop(self) -> None:
        """Stop the channel and clean up resources."""
        pass

    @abstractmethod
    async def send(self, msg: OutboundMessage) -> None:
        """
        Send a message through this channel.

        Args:
            msg: The message to send.
        """
        pass

    def is_allowed(self, sender_id: str) -> bool:
        """Check if sender_id is permitted."""
        allow_list = getattr(self.config, "allow_from", [])
        if not allow_list:
            logger.warning("{}: allow_from is empty — all access denied", self.name)
            return False
        if "*" in allow_list:
            return True
        return str(sender_id) in allow_list

    async def _handle_message(
        self,
        sender_id: str,
        chat_id: str,
        content: str,
        media: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Handle incoming message from chat platform."""
        if not self.is_allowed(sender_id):
            logger.warning("Access denied for sender {} on channel {}", sender_id, self.name)
            return
        
        await self.bus.publish_inbound(InboundMessage(
            sender_id=sender_id,
            chat_id=chat_id,
            content=content,
            media=media,
            metadata=metadata,
        ))
```

**具体适配器** (`channels/discord.py:1-100`, 100 行):
```python
class DiscordChannel(BaseChannel):
    """Discord channel using Discord Gateway websocket."""
    
    name = "discord"
    
    def __init__(self, config: DiscordConfig, bus: MessageBus):
        super().__init__(config, bus)
        self.token = config.token
        self.gateway_url = config.gateway_url
        self.intents = config.intents
        self._ws: websockets.WebSocketClientProtocol | None = None
    
    async def start(self) -> None:
        """Start Discord Gateway connection."""
        import websockets
        
        self._running = True
        
        async with websockets.connect(self.gateway_url) as ws:
            self._ws = ws
            
            # Send IDENTIFY payload
            await ws.send(json.dumps({
                "op": 2,  # IDENTIFY
                "d": {
                    "token": self.token,
                    "intents": self.intents,
                }
            }))
            
            # Listen for events
            async for message in ws:
                event = json.loads(message)
                await self._handle_event(event)
    
    async def stop(self) -> None:
        """Stop Discord connection."""
        self._running = False
        if self._ws:
            await self._ws.close()
    
    async def send(self, msg: OutboundMessage) -> None:
        """Send message to Discord."""
        # Discord API call to send message
        ...
    
    async def _handle_event(self, event: dict) -> None:
        """Handle Discord Gateway event."""
        if event.get("t") == "MESSAGE_CREATE":
            data = event["d"]
            await self._handle_message(
                sender_id=str(data["author"]["id"]),
                chat_id=str(data["channel_id"]),
                content=data["content"],
                metadata={"discord": data},
            )
```

**关键特性**:
1. **统一接口**: 所有频道实现 start/stop/send
2. **协议转换**: 将各平台协议转换为统一 InboundMessage
3. **复用逻辑**: is_allowed() 和 _handle_message() 在基类实现

**设计决策理由**:
- ✅ 解耦核心逻辑和平台细节
- ✅ 易于添加新频道
- ✅ 统一权限检查

---

### 5. 装饰器模式 (Decorator Pattern)

**位置**: `agent/tools/mcp.py:MCPToolWrapper`

**用途**: 包装 MCP 工具为 nanobot 工具

**代码片段** (`agent/tools/mcp.py:1-80`, 80 行):
```python
class MCPToolWrapper(Tool):
    """Wraps a single MCP server tool as a nanobot Tool."""
    
    def __init__(self, server_name: str, tool_def: Any, session: Any):
        self._server_name = server_name
        self._name = f"mcp_{server_name}_{tool_def.name}"
        self._description = tool_def.description
        self._input_schema = tool_def.inputSchema
        self._session = session
        self._tool_timeout = 60  # seconds
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def description(self) -> str:
        return self._description
    
    def get_definition(self) -> dict:
        """Get tool definition for LLM."""
        return {
            "name": self._name,
            "description": self._description,
            "parameters": self._input_schema,
        }
    
    async def execute(self, **kwargs) -> str:
        """Execute the MCP tool."""
        import asyncio
        from mcp import types
        
        try:
            result = await asyncio.wait_for(
                self._session.call_tool(self._name, kwargs),
                timeout=self._tool_timeout,
            )
            return self._format_result(result)
        except asyncio.TimeoutError:
            logger.warning("MCP tool '{}' timed out after {}s", self._name, self._tool_timeout)
            return f"(MCP tool call timed out after {self._tool_timeout}s)"
        except Exception as e:
            logger.exception("MCP tool execution failed: {}", e)
            return f"Error: {e}"
    
    def _format_result(self, result: Any) -> str:
        """Format MCP tool result as string."""
        if isinstance(result, types.ToolResult):
            return "\n".join(str(content) for content in result.content)
        return str(result)
```

**关键特性**:
1. **接口兼容**: 继承 Tool 基类
2. **功能增强**: 添加超时控制、错误处理
3. **透明包装**: 调用方不知道是 MCP 工具

---

## 🎯 行为型模式

### 6. 观察者模式 (Observer Pattern) ⭐⭐⭐⭐⭐

**位置**: `bus/queue.py:MessageBus`

**用途**: 解耦消息生产者和消费者

**实现**:
```python
# 生产者（频道）
await bus.publish_inbound(msg)

# 消费者（代理）
msg = await bus.consume_inbound()
```

**关键特性**:
1. **松耦合**: 生产者不知道消费者
2. **异步通知**: asyncio.Queue 自动阻塞/唤醒
3. **背压支持**: 队列满时自动阻塞

**设计决策理由**:
- ✅ 解耦频道和代理
- ✅ 支持多个消费者
- ✅ 内置背压机制

---

### 7. 命令模式 (Command Pattern) ⭐⭐⭐⭐

**位置**: `agent/tools/` 目录

**用途**: 将工具调用封装为命令对象

**基类** (`agent/tools/base.py:1-80`, 80 行):
```python
class Tool(ABC):
    """Base class for all tools."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Tool name."""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Tool description."""
        pass
    
    @abstractmethod
    def get_definition(self) -> dict:
        """Get tool definition for LLM."""
        pass
    
    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """Execute the tool."""
        pass


class ReadFileTool(Tool):
    """Tool to read files from the filesystem."""
    
    def __init__(self, workspace: Path, allowed_dir: Path | None = None):
        self.workspace = workspace
        self.allowed_dir = allowed_dir
    
    @property
    def name(self) -> str:
        return "read_file"
    
    @property
    def description(self) -> str:
        return "Read the contents of a file"
    
    def get_definition(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to the file to read"
                    }
                },
                "required": ["path"]
            }
        }
    
    async def execute(self, path: str) -> str:
        """Read a file and return its contents."""
        # Security check
        if self.allowed_dir:
            full_path = self.allowed_dir / path
            if not str(full_path.resolve()).startswith(str(self.allowed_dir)):
                return "Error: Access denied"
        
        try:
            return full_path.read_text()
        except Exception as e:
            return f"Error reading file: {e}"
```

**关键特性**:
1. **封装请求**: 每个工具是一个命令
2. **统一接口**: execute() 方法
3. **可撤销**: 未来可扩展 undo()

**设计决策理由**:
- ✅ 解耦调用者和接收者
- ✅ 支持组合命令
- ✅ 易于添加新工具

---

### 8. 迭代器模式 (Iterator Pattern)

**位置**: `agent/loop.py:AgentLoop._run_agent_loop()`

**用途**: 迭代执行代理循环

**代码片段** (`agent/loop.py:180-250`, 70 行):
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
        )

        if response.has_tool_calls:
            # Execute tool calls
            for tool_call in response.tool_calls:
                tools_used.append(tool_call.name)
                result = await self.tools.execute(tool_call.name, tool_call.arguments)
                messages = self.context.add_tool_result(
                    messages, tool_call.id, tool_call.name, result
                )
        else:
            final_content = self._strip_think(response.content)
            break

    return (final_content, tools_used, messages)
```

**关键特性**:
1. **迭代执行**: 循环直到达到终止条件
2. **状态维护**: messages 在迭代中更新
3. **终止条件**: max_iterations 或 无 tool_calls

---

### 9. 状态模式 (State Pattern)

**位置**: `session/manager.py:Session`

**用途**: 管理会话状态

**代码片段**:
```python
class Session:
    """Represents a conversation session."""
    
    def __init__(self, session_key: str):
        self.session_key = session_key
        self.messages: list[dict] = []
        self.created_at = time.time()
        self.updated_at = time.time()
    
    def add_message(self, role: str, content: str) -> None:
        """Add a message to the session."""
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": time.time(),
        })
        self.updated_at = time.time()
    
    def to_dict(self) -> dict:
        """Convert to dictionary for persistence."""
        return {
            "session_key": self.session_key,
            "messages": self.messages,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
```

**关键特性**:
1. **状态封装**: 消息历史、时间戳
2. **状态转换**: add_message() 更新状态
3. **持久化**: to_dict() 用于保存

---

## 📊 模式使用统计

| 模式类型 | 使用次数 | 占比 |
|---------|---------|------|
| 创建型 | 2 | 22% |
| 结构型 | 3 | 33% |
| 行为型 | 4 | 44% |

**最常用模式**:
1. 策略模式 (Providers)
2. 观察者模式 (MessageBus)
3. 适配器模式 (Channels)
4. 命令模式 (Tools)

---

## 🎯 架构原则遵循

### SOLID 原则

| 原则 | 遵循情况 | 示例 |
|------|---------|------|
| **SRP** (单一职责) | ✅ 优秀 | 每个工具一个职责 |
| **OCP** (开闭原则) | ✅ 优秀 | 策略模式支持扩展 |
| **LSP** (里氏替换) | ✅ 优秀 | 所有 Provider 可互换 |
| **ISP** (接口隔离) | ✅ 良好 | BaseChannel 接口精简 |
| **DIP** (依赖倒置) | ✅ 优秀 | 依赖抽象而非具体 |

### 其他原则

| 原则 | 遵循情况 | 示例 |
|------|---------|------|
| **DRY** (不要重复) | ✅ 良好 | 基类复用逻辑 |
| **KISS** (保持简单) | ✅ 优秀 | JSON 文件存储 |
| **YAGNI** (不需要就不做) | ✅ 优秀 | 无过度设计 |

---

## 🚀 性能优化模式

### 1. 懒加载 (Lazy Loading)

**位置**: `agent/loop.py:AgentLoop._connect_mcp()`

```python
async def _connect_mcp(self) -> None:
    """Connect to configured MCP servers (one-time, lazy)."""
    if self._mcp_connected or self._mcp_connecting or not self._mcp_servers:
        return
    
    self._mcp_connecting = True
    try:
        # Connect on first use
        await connect_mcp_servers(...)
        self._mcp_connected = True
    finally:
        self._mcp_connecting = False
```

**优势**: 避免不必要的连接

### 2. 对象池 (Object Pool)

**位置**: `agent/subagent.py:SubagentManager`

```python
class SubagentManager:
    """Manages subagent lifecycle."""
    
    def __init__(self, ...):
        self.subagents: dict[str, AgentLoop] = {}
    
    async def spawn(self, task: str) -> str:
        """Spawn a subagent."""
        sub_agent = AgentLoop(...)
        self.subagents[sub_session_key] = sub_agent
        return sub_session_key
```

**优势**: 复用子代理实例

### 3. 异步并发 (Async Concurrency)

**位置**: 全局使用 asyncio

```python
# 并发启动所有频道
async def start_all(self) -> None:
    tasks = [channel.start() for channel in self.channels.values()]
    await asyncio.gather(*tasks)
```

**优势**: 高吞吐，低延迟

---

## 📝 结论

nanobot 项目展示了优秀的设计模式应用：

1. **策略模式** 实现提供者多路复用
2. **适配器模式** 统一 11 个聊天频道
3. **观察者模式** 解耦消息流
4. **命令模式** 封装工具执行

这些模式共同构建了一个灵活、可扩展、易维护的轻量级 AI 助手架构。

---

*生成时间：2026-03-02*
