# nanobot 架构层次分析报告

## 📊 5 层架构覆盖

---

## 1️⃣ 表现层（Presentation Layer）

**职责**: 用户交互接口

### 1.1 CLI 接口

**文件**: `cli/commands.py` (38,627 字节)

**功能**:
- `nanobot start` - 启动网关
- `nanobot gateway` - 网关模式
- `nanobot status` - 状态查看
- `nanobot config` - 配置管理
- `nanobot cron` - 定时任务管理
- `nanobot clean` - 清理缓存

**代码片段** (`cli/commands.py:20-35`):
```python
app = typer.Typer(
    name="nanobot",
    help=f"{__logo__} nanobot - Personal AI Assistant",
    no_args_is_help=True,
)

console = Console()
EXIT_COMMANDS = {"exit", "quit", "/exit", "/quit", ":q"}

# prompt_toolkit for interactive REPL
def _init_prompt_session() -> None:
    """Create the prompt_toolkit session with persistent file history."""
    history_file = Path.home() / ".nanobot" / "history" / "cli_history"
    history_file.parent.mkdir(parents=True, exist_ok=True)
    
    _PROMPT_SESSION = PromptSession(
        history=FileHistory(str(history_file)),
        enable_open_in_editor=False,
        multiline=False,
    )
```

### 1.2 聊天频道接口（11 个）

| 频道 | 协议 | 文件大小 | 关键特性 |
|------|------|---------|---------|
| Telegram | Bot API | 19,537 字节 | 长轮询、代理支持 |
| Discord | Gateway WS | 11,002 字节 | WebSocket、 intents |
| Feishu | WebSocket | 29,329 字节 | 长连接、加密 |
| DingTalk | Stream SDK | 16,959 字节 | 钉钉流式 API |
| WhatsApp | WS Bridge | 5,676 字节 | Node.js 桥接 |
| Slack | Events API | 10,543 字节 | 事件订阅 |
| Matrix | Client-Server | 29,449 字节 | E2EE 加密 |
| Email | IMAP/SMTP | 14,558 字节 | 邮件协议 |
| QQ | QQ 协议 | 4,323 字节 | 轻量实现 |
| MoChat | 企业微信 | 36,264 字节 | 最完整实现 |

**统一接口** (`channels/base.py`):
```python
class BaseChannel(ABC):
    """Abstract base class for chat channel implementations."""
    
    @abstractmethod
    async def start(self) -> None:
        """Start the channel and begin listening for messages."""
        pass
    
    @abstractmethod
    async def stop(self) -> None:
        """Stop the channel and clean up resources."""
        pass
    
    @abstractmethod
    async def send(self, msg: OutboundMessage) -> None:
        """Send a message through this channel."""
        pass
    
    def is_allowed(self, sender_id: str) -> bool:
        """Check if sender_id is permitted."""
        allow_list = getattr(self.config, "allow_from", [])
        if not allow_list:
            return False
        if "*" in allow_list:
            return True
        return str(sender_id) in allow_list
```

### 1.3 上传接口

**实现**: 集成在各频道中

**示例** (`channels/matrix.py`):
```python
class MatrixChannel(BaseChannel):
    """Matrix channel with E2EE support."""
    
    async def _upload_media(self, data: bytes, mime_type: str) -> str:
        """Upload media to Matrix server."""
        limit = await self._resolve_server_upload_limit_bytes()
        if limit and len(data) > limit:
            raise UploadError(f"File too large: {len(data)} > {limit}")
        
        response = await self.client.upload(data, content_type=mime_type)
        return response.content_uri
```

---

## 2️⃣ 服务层（Service Layer）

**职责**: 业务逻辑编排

### 2.1 频道管理器

**文件**: `channels/manager.py` (9,305 字节)

**功能**:
- 频道初始化
- 频道启动/停止
- 消息路由

**代码片段** (`channels/manager.py:25-60`):
```python
class ChannelManager:
    """Manages chat channels and coordinates message routing."""
    
    def __init__(self, config: Config, bus: MessageBus):
        self.config = config
        self.bus = bus
        self.channels: dict[str, BaseChannel] = {}
        self._dispatch_task: asyncio.Task | None = None
        self._init_channels()
    
    def _init_channels(self) -> None:
        """Initialize channels based on config."""
        if self.config.channels.telegram.enabled:
            from nanobot.channels.telegram import TelegramChannel
            self.channels["telegram"] = TelegramChannel(...)
        
        if self.config.channels.discord.enabled:
            from nanobot.channels.discord import DiscordChannel
            self.channels["discord"] = DiscordChannel(...)
        
        # ... 其他频道
    
    async def start_all(self) -> None:
        """Start all enabled channels."""
        tasks = [channel.start() for channel in self.channels.values()]
        await asyncio.gather(*tasks)
        
        # Start outbound dispatcher
        self._dispatch_task = asyncio.create_task(
            self._dispatch_outbound_messages()
        )
```

### 2.2 会话管理器

**文件**: `session/manager.py` (7,400 字节)

**功能**:
- 会话创建/加载
- 会话持久化
- 会话隔离

**代码片段**:
```python
class SessionManager:
    """Manages session persistence."""
    
    def __init__(self, workspace: Path):
        self.sessions_dir = workspace / ".sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
    
    def get_or_create(self, session_key: str) -> Session:
        """Get or create a session."""
        path = self.sessions_dir / f"{session_key}.json"
        if path.exists():
            data = json.loads(path.read_text())
            return Session(**data)
        else:
            session = Session(session_key=session_key)
            self.save(session)
            return session
    
    def save(self, session: Session) -> None:
        """Save session to disk."""
        path = self.sessions_dir / f"{session.session_key}.json"
        path.write_text(json.dumps(session.to_dict(), indent=2))
```

### 2.3 子代理管理器

**文件**: `agent/subagent.py` (9,713 字节)

**功能**:
- 子代理生成
- 子代理监控
- 结果聚合

**代码片段**:
```python
class SubagentManager:
    """Manages subagent lifecycle."""
    
    def __init__(
        self,
        provider: LLMProvider,
        workspace: Path,
        bus: MessageBus,
        model: str,
        temperature: float,
        max_tokens: int,
    ):
        self.provider = provider
        self.workspace = workspace
        self.bus = bus
        self.model = model
        self.subagents: dict[str, AgentLoop] = {}
    
    async def spawn(self, task: str, parent_session_key: str) -> str:
        """Spawn a subagent for a task."""
        sub_session_key = f"subagent:{uuid.uuid4()}"
        
        sub_agent = AgentLoop(
            bus=self.bus,
            provider=self.provider,
            workspace=self.workspace,
            model=self.model,
            session_manager=self.session_manager,
            ...
        )
        
        self.subagents[sub_session_key] = sub_agent
        asyncio.create_task(sub_agent.run())
        
        return sub_session_key
```

---

## 3️⃣ 核心层（Core Layer）

**职责**: 核心引擎/算法

### 3.1 代理循环

**文件**: `agent/loop.py` (22,532 字节)

**功能**:
- 消息处理
- LLM 调用
- 工具执行
- 响应生成

**核心算法** (`agent/loop.py:180-250`):
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
                result = await self.tools.execute(
                    tool_call.name, 
                    tool_call.arguments
                )
                messages = self.context.add_tool_result(
                    messages, tool_call.id, tool_call.name, result
                )
        else:
            final_content = self._strip_think(response.content)
            break

    return (final_content, tools_used, messages)
```

### 3.2 上下文构建器

**文件**: `agent/context.py` (6,466 字节)

**功能**:
- 系统提示加载
- 会话历史合并
- 记忆注入
- 技能集成

**代码片段**:
```python
class ContextBuilder:
    """Builds context for LLM calls."""
    
    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.system_prompt = self._load_system_prompt()
    
    def build_context(
        self,
        session_messages: list[dict],
        memory_store: MemoryStore,
        memory_window: int = 100,
        skill_names: list[str] = None,
    ) -> list[dict]:
        """Build context for LLM."""
        context = [{"role": "system", "content": self.system_prompt}]
        
        # Recent messages (sliding window)
        context.extend(session_messages[-memory_window:])
        
        # Consolidated memories
        memories = memory_store.get_recent(limit=10)
        if memories:
            context.append({
                "role": "system",
                "content": "## Memories\n\n" + "\n".join(memories)
            })
        
        # Skills
        if skill_names:
            skills_content = skills_loader.load_skills_for_context(skill_names)
            if skills_content:
                context.append({
                    "role": "system",
                    "content": "## Skills\n\n" + skills_content
                })
        
        return context
```

### 3.3 工具注册表

**文件**: `agent/tools/registry.py` (2,079 字节)

**功能**:
- 工具注册
- 工具执行
- 定义导出

**代码片段**:
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

## 4️⃣ 后台层（Background Layer）

**职责**: 异步任务处理

### 4.1 Cron 服务

**文件**: `cron/service.py` (13,134 字节)

**功能**:
- 定时任务调度
- 任务持久化
- 任务执行

**调度类型**:
- `every`: 周期性（毫秒）
- `cron`: Cron 表达式
- `at`: 一次性（时间戳）

**代码片段** (`cron/service.py:50-100`):
```python
class CronService:
    """Manages scheduled jobs."""
    
    def __init__(self, store_path: Path):
        self.store_path = store_path
        self.jobs: dict[str, CronJob] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False
        self._load_jobs()
    
    def add_job(
        self,
        name: str,
        schedule: CronSchedule,
        prompt: str,
        channel: str,
        chat_id: str,
    ) -> CronJob:
        """Add a scheduled job."""
        job = CronJob(
            id=f"job_{uuid.uuid4().hex[:8]}",
            name=name,
            schedule=schedule,
            prompt=prompt,
            channel=channel,
            chat_id=chat_id,
            enabled=True,
        )
        self.jobs[job.id] = job
        self._save_jobs()
        self._schedule_job(job)
        return job
    
    def _schedule_job(self, job: CronJob) -> None:
        """Schedule a job for execution."""
        next_run = self._calculate_next_run(job.schedule)
        delay = (next_run - datetime.now()).total_seconds()
        
        async def run_job():
            await asyncio.sleep(delay)
            if job.enabled:
                await self._execute_job(job)
            self._schedule_job(job)  # Reschedule
        
        self._tasks[job.id] = asyncio.create_task(run_job())
```

### 4.2 心跳服务

**文件**: `heartbeat/service.py` (5,779 字节)

**功能**:
- 周期性健康检查
- 主动任务执行
- 状态报告

**代码片段**:
```python
class HeartbeatService:
    """Periodic heartbeat and proactive tasks."""
    
    def __init__(
        self,
        interval_seconds: int = 1800,  # 30 minutes
    ):
        self.interval = interval_seconds
        self._running = False
        self._tasks: list[asyncio.Task] = []
    
    async def start(self) -> None:
        """Start the heartbeat service."""
        self._running = True
        
        while self._running:
            try:
                await self._run_heartbeat()
                await asyncio.sleep(self.interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Heartbeat failed: {}", e)
                await asyncio.sleep(60)  # Retry in 1 minute
    
    async def _run_heartbeat(self) -> None:
        """Run a single heartbeat cycle."""
        # Check emails
        # Check calendar
        # Check notifications
        # Consolidate memories
        pass
```

### 4.3 消息总线

**文件**: `bus/queue.py` (1,499 字节)

**功能**:
- 异步消息队列
- 解耦生产者和消费者

**代码片段**:
```python
class MessageBus:
    """Async message bus that decouples channels from agent core."""
    
    def __init__(self):
        self.inbound: asyncio.Queue[InboundMessage] = asyncio.Queue()
        self.outbound: asyncio.Queue[OutboundMessage] = asyncio.Queue()
    
    async def publish_inbound(self, msg: InboundMessage) -> None:
        """Publish a message from a channel to the agent."""
        await self.inbound.put(msg)
    
    async def consume_inbound(self) -> InboundMessage:
        """Consume the next inbound message."""
        return await self.inbound.get()
    
    async def publish_outbound(self, msg: OutboundMessage) -> None:
        """Publish a response from the agent to channels."""
        await self.outbound.put(msg)
```

---

## 5️⃣ 数据层（Data Layer）

**职责**: 数据存储和访问

### 5.1 会话存储

**格式**: JSON 文件

**位置**: `~/.nanobot/sessions/<session_key>.json`

**Schema**:
```json
{
  "session_key": "discord:123456789",
  "messages": [...],
  "created_at": 1709366400000,
  "updated_at": 1709366401000
}
```

### 5.2 记忆存储

**格式**: JSON 文件

**位置**: `~/.nanobot/memory/<session_key>/memory.json`

### 5.3 定时任务存储

**格式**: JSON 文件

**位置**: `~/.nanobot/cron/jobs.json`

### 5.4 配置存储

**格式**: JSON 文件

**位置**: `~/.nanobot/config.json`

**Schema**:
```json
{
  "agents": {
    "defaults": {
      "model": "claude-3-5-sonnet",
      "temperature": 0.1,
      "max_tokens": 4096
    }
  },
  "providers": {
    "anthropic": {
      "api_key": "sk-..."
    }
  },
  "channels": {
    "discord": {
      "enabled": true,
      "token": "...",
      "allow_from": ["*"]
    }
  },
  "tools": {
    "web": {
      "search": {
        "api_key": "..."
      }
    }
  }
}
```

### 5.5 提供者注册表

**文件**: `providers/registry.py` (16,331 字节)

**功能**:
- 提供者元数据
- 自动前缀
- 网关检测

**代码片段** (`providers/registry.py:20-60`):
```python
@dataclass(frozen=True)
class ProviderSpec:
    """One LLM provider's metadata."""
    
    # Identity
    name: str
    keywords: tuple[str, ...]
    env_key: str
    display_name: str = ""
    
    # Model prefixing
    litellm_prefix: str = ""
    skip_prefixes: tuple[str, ...] = ()
    
    # Gateway detection
    is_gateway: bool = False
    is_local: bool = False
    detect_by_key_prefix: str = ""
    detect_by_base_keyword: str = ""
    
    # OAuth support
    is_oauth: bool = False
    
    # Direct provider (bypass LiteLLM)
    is_direct: bool = False
    
    # Prompt caching
    supports_prompt_caching: bool = False
```

---

## 📊 架构指标

| 层次 | 文件数 | 代码行数 | 占比 |
|------|--------|---------|------|
| 表现层 | 14 | ~5,500 | 53% |
| 服务层 | 5 | ~1,500 | 14% |
| 核心层 | 10 | ~2,000 | 19% |
| 后台层 | 6 | ~1,000 | 10% |
| 数据层 | 5 | ~400 | 4% |
| **总计** | **40** | **~10,400** | **100%** |

---

## 🎯 架构决策

### 1. 事件驱动架构

**决策**: 使用消息总线解耦组件

**理由**:
- 组件独立演化
- 异步非阻塞
- 易于测试

### 2. 插件化频道

**决策**: 抽象基类 + 具体实现

**理由**:
- 统一接口
- 易于添加新频道
- 权限检查统一

### 3. 轻量级存储

**决策**: JSON 文件而非数据库

**理由**:
- 零依赖
- 人类可读
- 易于备份

### 4. 懒加载 MCP

**决策**: 首次调用时才连接

**理由**:
- 避免不必要的连接
- 失败自动重试
- 降低启动时间

---

## 🔐 安全架构

### 1. 访问控制

- 频道级 `allow_from` 白名单
- 工作空间限制选项
- Shell 工具安全模式

### 2. 会话隔离

- 独立会话文件
- 频道级会话键
- Thread-scoped 会话

### 3. 凭据管理

- 配置文件权限 600
- API key 不记录日志
- OAuth 支持

---

*生成时间：2026-03-02*
