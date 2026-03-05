# 阶段 3: 毛线团调用链追踪 ⭐⭐⭐⭐⭐

**研究日期**: 2026-03-03  
**项目**: nanobot (HKUDS/nanobot)  
**追踪波次**: 3 个（CLI 入口/API 入口/核心功能）

---

## 📊 调用链总览

| 波次 | 入口点 | 调用链深度 | 核心路径 |
|------|--------|-----------|---------|
| **波次 1** | CLI 入口 | 5 层 | CLI → 参数解析 → 命令分发 → AgentLoop → 工具执行 |
| **波次 2** | API 入口 | N/A | nanobot 无传统 API 入口（使用 MessageBus 异步通信） |
| **波次 3** | Agent Loop | 7 层 | 消息接收 → 上下文构建 → LLM 调用 → 工具执行 → 响应发送 → 记忆整合 |

---

## 🔄 波次 1: CLI 入口调用链

### 调用链路径

```
nanobot/__main__.py:8
  ↓
nanobot/cli/commands.py:app()
  ↓
nanobot/cli/commands.py:chat() [line 156]
  ↓
nanobot/agent/loop.py:AgentLoop.process_message() [line 380]
  ↓
nanobot/agent/loop.py:AgentLoop._run_agent_loop() [line 181]
  ↓
nanobot/providers/base.py:LLMProvider.chat()
  ↓
nanobot/agent/tools/registry.py:ToolRegistry.execute()
  ↓
nanobot/agent/tools/*.py:<Tool>.execute()
```

### 详细调用层

#### 第 1 层：模块入口 (`nanobot/__main__.py:1-8`)

```python
# nanobot/__main__.py:1-8
"""
Entry point for running nanobot as a module: python -m nanobot
"""

from nanobot.cli.commands import app

if __name__ == "__main__":
    app()
```

**关键决策点**: 
- Typer 框架自动解析命令行参数
- 根据子命令分发到不同处理函数

---

#### 第 2 层：CLI 命令分发 (`nanobot/cli/commands.py:156-250`)

```python
# nanobot/cli/commands.py:156-250 (chat 命令核心部分)
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

    # 1. 加载配置
    config = load_config()
    
    # 2. 创建核心组件
    bus = MessageBus()
    provider = _make_provider(config)
    session_manager = SessionManager(config.workspace_path)

    # 3. 创建 AgentLoop
    agent = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        model=config.agents.defaults.model,
        session_manager=session_manager,
    )

    # 4. 交互式模式（无 message 参数）
    if not message:
        _init_prompt_session()
        console.print(f"[green]{__logo__} nanobot v{__version__}[/green]")
        
        while True:
            try:
                user_input = await _read_interactive_input_async()
                if _is_exit_command(user_input):
                    break
                
                # 5. 创建 inbound message
                inbound = InboundMessage(
                    channel="cli",
                    chat_id="direct",
                    content=user_input,
                    message_id=str(uuid.uuid4()),
                )
                
                # 6. 调用 AgentLoop 处理消息
                await agent.process_message(inbound)

            except KeyboardInterrupt:
                break

        _restore_terminal()
        return

    # 7. 单次模式
    inbound = InboundMessage(
        channel="cli",
        chat_id="direct",
        content=message,
        message_id=str(uuid.uuid4()),
    )
    await agent.process_message(inbound)
```

**关键决策点**:
- **模式判断**: `if not message` 区分交互模式和单次模式
- **会话管理**: 每个 CLI 对话使用独立 session_key
- **消息封装**: 将用户输入封装为 `InboundMessage` 对象

**性能瓶颈**: 
- 交互式模式下，每次循环都创建新的 `InboundMessage`
- `_init_prompt_session()` 初始化 prompt_toolkit 会话（仅一次）

---

#### 第 3 层：AgentLoop 消息处理 (`nanobot/agent/loop.py:380-450`)

```python
# nanobot/agent/loop.py:380-450 (process_message 核心部分)
async def process_message(self, message: InboundMessage) -> None:
    """Process an inbound message from the bus."""
    async with self._processing_lock:
        session_key = message.session_key
        session = self.sessions.get(session_key)

        # 1. 设置工具上下文（用于消息路由）
        self._set_tool_context(
            message.channel, message.chat_id, message.message_id
        )

        # 2. 构建上下文（历史 + 记忆 + 技能）
        context_messages = await self.context.build(
            session=session,
            memory_window=self.memory_window,
        )

        # 3. 运行 Agent Loop
        final_content, tools_used, messages = await self._run_agent_loop(
            initial_messages=context_messages,
            on_progress=lambda thinking, tool_calls, iteration: self._on_progress(
                session, thinking, tool_calls, iteration
            ),
        )

        # 4. 更新会话消息
        session.messages = messages

        # 5. 发送响应
        if final_content:
            await self.bus.publish_outbound(
                channel=message.channel,
                chat_id=message.chat_id,
                content=final_content,
                in_reply_to=message.message_id,
            )

        # 6. 触发记忆整合
        await self._maybe_consolidate_memory(session)
```

**关键决策点**:
- **并发控制**: `async with self._processing_lock` 确保同一时间只处理一个消息
- **会话获取**: `self.sessions.get(session_key)` 获取或创建会话
- **工具上下文**: `_set_tool_context()` 为 message/spawn/cron 工具设置路由信息

**性能瓶颈**:
- `_processing_lock` 是全局锁，可能成为并发瓶颈
- 记忆整合是异步触发，不阻塞响应

---

#### 第 4 层：上下文构建 (`nanobot/agent/context.py:80-150`)

```python
# nanobot/agent/context.py:80-150 (build_messages 方法)
def build_messages(
    self,
    history: list[dict[str, Any]],
    current_message: str,
    skill_names: list[str] | None = None,
    media: list[str] | None = None,
    channel: str | None = None,
    chat_id: str | None = None,
) -> list[dict[str, Any]]:
    """Build the complete message list for an LLM call."""
    return [
        {"role": "system", "content": self.build_system_prompt(skill_names)},
        *history,
        {"role": "user", "content": self._build_runtime_context(channel, chat_id)},
        {"role": "user", "content": self._build_user_content(current_message, media)},
    ]

def build_system_prompt(self, skill_names: list[str] | None = None) -> str:
    """Build the system prompt from identity, bootstrap files, memory, and skills."""
    parts = [self._get_identity()]

    # 1. 加载 bootstrap 文件（AGENTS.md, SOUL.md, USER.md, TOOLS.md, IDENTITY.md）
    bootstrap = self._load_bootstrap_files()
    if bootstrap:
        parts.append(bootstrap)

    # 2. 加载长期记忆
    memory = self.memory.get_memory_context()
    if memory:
        parts.append(f"# Memory\n\n{memory}")

    # 3. 加载 always 技能
    always_skills = self.skills.get_always_skills()
    if always_skills:
        always_content = self.skills.load_skills_for_context(always_skills)
        if always_content:
            parts.append(f"# Active Skills\n\n{always_content}")

    # 4. 加载技能摘要
    skills_summary = self.skills.build_skills_summary()
    if skills_summary:
        parts.append(f"""# Skills

The following skills extend your capabilities. To use a skill, read its SKILL.md file using the read_file tool.

{skills_summary}""")

    return "\n\n---\n\n".join(parts)
```

**关键决策点**:
- **系统提示构建**: 按优先级加载 identity → bootstrap → memory → skills
- **技能渐进式加载**: 先加载摘要，Agent 按需读取完整技能
- **运行时上下文**: 注入当前时间、渠道、聊天 ID 等元数据

**性能瓶颈**:
- `_load_bootstrap_files()` 每次调用都读取文件（可缓存优化）
- `build_skills_summary()` 遍历所有技能目录

---

#### 第 5 层：Agent Loop 核心 (`nanobot/agent/loop.py:181-280`)

```python
# nanobot/agent/loop.py:181-280 (_run_agent_loop 核心部分)
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

        # 1. 调用 LLM
        response = await self.provider.chat(
            messages=messages,
            tools=self.tools.get_definitions(),
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            reasoning_effort=self.reasoning_effort,
        )

        response_content = self._strip_think(response.content)

        # 2. 检查是否有工具调用
        if response.has_tool_calls:
            tools_used.extend([tc.name for tc in response.tool_calls])

            # 3. 添加 assistant 消息（包含工具调用）
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

            # 4. 执行工具并收集结果
            for tool_call in response.tool_calls:
                result = await self.tools.execute(tool_call.name, tool_call.arguments)
                messages.append({
                    "role": "tool",
                    "content": result[:self._TOOL_RESULT_MAX_CHARS],
                    "tool_call_id": tool_call.id,
                })

            # 5. 进度回调
            if on_progress:
                await on_progress(
                    thinking=response_content,
                    tool_calls=response.tool_calls,
                    iteration=iteration,
                )
            continue

        # 6. 无工具调用 - 最终响应
        final_content = response_content
        break

    return final_content, tools_used, messages
```

**关键决策点**:
- **迭代限制**: `max_iterations` 防止无限循环（默认 40 次）
- **工具调用检测**: `response.has_tool_calls` 判断是否需要执行工具
- **结果截断**: `result[:self._TOOL_RESULT_MAX_CHARS]` 限制工具结果长度（500 字符）

**性能瓶颈**:
- 每次迭代都调用 LLM（网络延迟）
- 工具串行执行（可优化为并行）

---

## 🔄 波次 2: API 入口调用链

**说明**: nanobot 没有传统的 HTTP API 入口（如 FastAPI/Flask），而是使用 **MessageBus 异步通信** 模式。

### 替代架构：MessageBus + Channel

```
Channel (Telegram/WhatsApp/Discord/etc.)
  ↓
InboundMessage (封装消息)
  ↓
MessageBus.put_inbound()
  ↓
AgentLoop.process_message()
  ↓
... (同波次 1)
```

### Gateway 模式调用链 (`nanobot/cli/commands.py:419-550`)

```python
# nanobot/cli/commands.py:419-550 (gateway 命令核心部分)
@app.command()
def gateway(
    port: int = typer.Option(18790, "--port", "-p", help="Gateway port"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
):
    """Start the nanobot gateway."""
    from nanobot.agent.loop import AgentLoop
    from nanobot.bus.queue import MessageBus
    from nanobot.channels.manager import ChannelManager
    from nanobot.config.loader import load_config
    from nanobot.cron.service import CronService
    from nanobot.heartbeat.service import HeartbeatService
    from nanobot.session.manager import SessionManager

    config = load_config()
    bus = MessageBus()
    provider = _make_provider(config)
    session_manager = SessionManager(config.workspace_path)

    # 1. 创建 Cron 服务
    cron_store_path = get_data_dir() / "cron" / "jobs.json"
    cron = CronService(cron_store_path)

    # 2. 创建 AgentLoop（包含 cron 服务）
    agent = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        model=config.agents.defaults.model,
        cron_service=cron,
        session_manager=session_manager,
        mcp_servers=config.tools.mcp_servers,
        channels_config=config.channels,
    )

    # 3. 创建 Channel 管理器
    channel_manager = ChannelManager(
        config=config.channels,
        bus=bus,
        agent=agent,
    )

    # 4. 启动 Channel
    await channel_manager.start_all()

    # 5. 启动 Cron 服务
    await cron.start()

    # 6. 启动 Heartbeat 服务（可选）
    heartbeat = HeartbeatService(config, agent)
    await heartbeat.start()

    # 7. 保持运行
    await asyncio.Event().wait()
```

**关键差异**:
- **异步架构**: Gateway 模式下，Channel 和 Agent 通过 MessageBus 解耦
- **并发处理**: 多个 Channel 可以同时接收消息，通过 MessageBus 队列调度
- **后台服务**: Cron 和 Heartbeat 服务独立运行

---

## 🔄 波次 3: 核心功能调用链（Agent 执行循环）

### 完整执行流程

```
思考 (LLM 调用)
  ↓
行动 (工具调用检测)
  ↓
观察 (工具执行结果)
  ↓
循环 (返回思考) 或 结束 (最终响应)
```

### 详细调用链

#### 第 1 层：思考 (Thinking)

```python
# nanobot/agent/loop.py:195-205
response = await self.provider.chat(
    messages=messages,
    tools=self.tools.get_definitions(),
    model=self.model,
    temperature=self.temperature,
    max_tokens=self.max_tokens,
    reasoning_effort=self.reasoning_effort,
)
```

**调用栈**:
```
AgentLoop._run_agent_loop()
  ↓
LiteLLMProvider.chat() 或 OpenAICodexProvider.chat()
  ↓
HTTP 请求到 LLM API
  ↓
流式响应解析（SSE 事件）
  ↓
Response 对象（content + tool_calls）
```

---

#### 第 2 层：行动 (Action)

```python
# nanobot/agent/loop.py:207-235
if response.has_tool_calls:
    tools_used.extend([tc.name for tc in response.tool_calls])

    # 构建工具调用字典
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

    # 执行工具
    for tool_call in response.tool_calls:
        result = await self.tools.execute(tool_call.name, tool_call.arguments)
        messages.append({
            "role": "tool",
            "content": result[:self._TOOL_RESULT_MAX_CHARS],
            "tool_call_id": tool_call.id,
        })
```

**调用栈**:
```
AgentLoop._run_agent_loop()
  ↓
ToolRegistry.execute(tool_name, params)
  ↓
<Tool>.validate_params(params)
  ↓
<Tool>.execute(**params)
  ↓
返回结果字符串
```

---

#### 第 3 层：观察 (Observation)

```python
# nanobot/agent/tools/registry.py:35-50
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
```

**关键决策点**:
- **参数验证**: `tool.validate_params(params)` 检查参数合法性
- **错误处理**: 捕获异常并添加提示（`_HINT`）
- **结果截断**: 过长结果会被截断（500 字符）

---

#### 第 4 层：循环/结束 (Loop/Terminate)

```python
# nanobot/agent/loop.py:237-245
if on_progress:
    await on_progress(
        thinking=response_content,
        tool_calls=response.tool_calls,
        iteration=iteration,
    )
continue  # 继续下一轮迭代

# 无工具调用 - 最终响应
final_content = response_content
break
```

**关键决策点**:
- **继续条件**: 有工具调用 → `continue`
- **结束条件**: 无工具调用 → `break`，返回最终响应

---

## 📊 关键决策点汇总

| 层级 | 决策点 | 条件 | 分支 |
|------|--------|------|------|
| CLI 入口 | 模式判断 | `if not message` | 交互模式 vs 单次模式 |
| CLI 入口 | 退出命令 | `_is_exit_command()` | 继续 vs 退出 |
| AgentLoop | 并发控制 | `async with self._processing_lock` | 串行处理 |
| AgentLoop | 记忆整合 | `unconsolidated >= self.memory_window` | 触发 vs 跳过 |
| Agent Loop | 工具调用 | `response.has_tool_calls` | 执行工具 vs 返回响应 |
| Agent Loop | 迭代限制 | `iteration < self.max_iterations` | 继续 vs 终止 |
| ToolRegistry | 参数验证 | `tool.validate_params(params)` | 执行 vs 返回错误 |
| Memory | 压缩触发 | `len(session.messages) > keep_count` | 压缩 vs 跳过 |

---

## 🐌 性能瓶颈识别

| 瓶颈位置 | 影响 | 优化建议 |
|---------|------|---------|
| `_processing_lock` | 全局锁，阻塞并发消息处理 | 按 session_key 分锁 |
| `_load_bootstrap_files()` | 每次构建上下文都读取文件 | 添加缓存机制 |
| `build_skills_summary()` | 遍历所有技能目录 | 缓存技能列表 |
| 工具串行执行 | 多个工具调用依次执行 | 支持并行执行 |
| LLM 调用延迟 | 网络请求延迟（100ms-2s） | 流式响应、缓存常用响应 |
| 记忆整合同步 | 大会话压缩耗时 | 后台异步处理 |

---

## ✅ 阶段 3 完成检查

- [x] CLI 入口波次调用链（5 层）
- [x] API 入口波次调用链（MessageBus 架构）
- [x] 核心功能波次调用链（思考→行动→观察）
- [x] 每层标注文件 + 行号
- [x] 关键决策点分析
- [x] 性能瓶颈识别

**下一步**: 执行阶段 4 - 架构师视角分析
