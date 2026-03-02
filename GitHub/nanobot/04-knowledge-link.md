# nanobot 知识链路完整性分析

## 📊 知识链路 5 环节

知识链路追踪知识从产生到优化的完整生命周期。

---

## 1️⃣ 知识产生

**问题**: 数据如何进入系统？

**来源**:
1. **用户输入**: 通过 11 个频道接收消息
2. **工具执行**: Web 搜索、文件读取、Shell 执行结果
3. **子代理**: 子代理返回的研究结果
4. **定时任务**: Cron 任务生成的内容

**入口点**:
```python
# channels/base.py:_handle_message()
async def _handle_message(
    self,
    sender_id: str,
    chat_id: str,
    content: str,
    media: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    # 验证权限
    if not self.is_allowed(sender_id):
        return
    
    # 发布到消息总线
    await self.bus.publish_inbound(InboundMessage(
        sender_id=sender_id,
        chat_id=chat_id,
        content=content,
        media=media,
        metadata=metadata,
    ))
```

**知识类型**:
- 对话历史（用户消息 + 助手响应）
- 工具执行结果
- 记忆片段（ consolidated memory）
- 技能知识（SKILL.md 文件）

---

## 2️⃣ 知识存储

**问题**: 数据库/schema/索引？

### 2.1 会话历史存储

**位置**: `~/.nanobot/sessions/<session_key>.json`

**Schema**:
```json
{
  "session_key": "discord:123456789",
  "messages": [
    {
      "role": "user",
      "content": "你好",
      "timestamp": 1709366400000
    },
    {
      "role": "assistant",
      "content": "你好！有什么可以帮助你的？",
      "timestamp": 1709366401000
    }
  ],
  "created_at": 1709366400000,
  "updated_at": 1709366401000
}
```

**文件**: `session/manager.py`

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
```

### 2.2 记忆存储

**位置**: `~/.nanobot/memory/<session_key>/`

**文件**:
- `memory.json` -  consolidated 记忆
- `recent.json` - 最近记忆（memory_window 条）

**文件**: `agent/memory.py`

```python
class MemoryStore:
    """In-memory store for consolidated memories."""
    
    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.memories: dict[str, list[dict]] = {}
    
    def add(self, session_key: str, content: str) -> None:
        """Add a memory for a session."""
        if session_key not in self.memories:
            self.memories[session_key] = []
        self.memories[session_key].append({
            "content": content,
            "timestamp": time.time(),
        })
    
    def get_recent(self, session_key: str, limit: int = 10) -> list[str]:
        """Get recent memories for a session."""
        memories = self.memories.get(session_key, [])
        return [m["content"] for m in memories[-limit:]]
```

### 2.3 定时任务存储

**位置**: `~/.nanobot/cron/jobs.json`

**Schema**:
```json
{
  "jobs": [
    {
      "id": "job_123",
      "name": "每日提醒",
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * *",
        "tz": "Asia/Shanghai"
      },
      "prompt": "提醒我查看邮件",
      "enabled": true,
      "created_at": 1709366400000
    }
  ]
}
```

**文件**: `cron/service.py`

---

## 3️⃣ 知识检索

**问题**: 搜索策略/排序算法？

### 3.1 会话历史检索

**策略**: LIFO（Last In First Out）+ 窗口限制

```python
# agent/context.py:build_context()
def build_context(
    self,
    session_messages: list[dict],
    memory_store: MemoryStore,
    memory_window: int = 100,
    skill_names: list[str] = None,
) -> list[dict]:
    """Build context for LLM."""
    context = []
    
    # 1. 系统提示
    context.append({"role": "system", "content": self.system_prompt})
    
    # 2. 会话历史（最近 memory_window 条）
    recent = session_messages[-memory_window:]
    context.extend(recent)
    
    # 3. 记忆（consolidated）
    memories = memory_store.get_recent(session_key, limit=10)
    if memories:
        context.append({
            "role": "system",
            "content": "## Memories\n\n" + "\n".join(memories)
        })
    
    # 4. 技能
    if skill_names:
        skills_content = skills_loader.load_skills_for_context(skill_names)
        if skills_content:
            context.append({
                "role": "system",
                "content": "## Skills\n\n" + skills_content
            })
    
    return context
```

### 3.2 记忆检索

**策略**: 时间排序 + 相关性（未来可扩展向量检索）

**当前实现**: 简单的时间窗口（最近 N 条）

**优化方向**: 
- 向量嵌入（embedding）
- 语义相似度搜索
- 关键词检索

---

## 4️⃣ 知识使用

**问题**: 谁调用/如何集成？

### 4.1 代理调用

**调用者**: `AgentLoop._run_agent_loop()`

**集成方式**:
```python
# agent/loop.py
async def process_message(self, msg: InboundMessage) -> None:
    # 1. 获取会话
    session = self.sessions.get_or_create(msg.session_key)
    
    # 2. 构建上下文
    context_messages = self.context.build_context(
        session_messages=session.messages,
        memory_store=self.memory,
        memory_window=self.memory_window,
    )
    
    # 3. 调用 LLM
    response = await self.provider.chat(
        messages=context_messages,
        tools=self.tools.get_definitions(),
        model=self.model,
    )
    
    # 4. 处理响应
    if response.has_tool_calls:
        # 执行工具
        ...
    else:
        # 发送响应
        await self.bus.publish_outbound(OutboundMessage(
            content=response.content,
            chat_id=msg.chat_id,
            channel=msg.channel,
        ))
    
    # 5. 保存到会话历史
    session.add_message(...)
    self.sessions.save(session)
```

### 4.2 子代理调用

**调用者**: `SubagentManager`

**集成方式**:
```python
# agent/subagent.py
class SubagentManager:
    """Manages subagent lifecycle."""
    
    async def spawn(
        self,
        task: str,
        parent_session_key: str,
    ) -> str:
        """Spawn a subagent for a task."""
        # 创建独立会话
        sub_session_key = f"subagent:{uuid.uuid4()}"
        
        # 继承父代理配置
        sub_agent = AgentLoop(
            bus=self.bus,
            provider=self.provider,
            workspace=self.workspace,
            session_manager=self.session_manager,
            ...
        )
        
        # 启动子代理
        asyncio.create_task(sub_agent.run())
        
        # 发送任务
        await self.bus.publish_inbound(InboundMessage(
            session_key=sub_session_key,
            content=task,
        ))
        
        return sub_session_key
```

### 4.3 定时任务调用

**调用者**: `CronService`

**集成方式**:
```python
# cron/service.py
class CronService:
    """Manages scheduled jobs."""
    
    async def _execute_job(self, job: CronJob) -> None:
        """Execute a cron job."""
        if self.callback:
            result = await self.callback(job)
            # 结果发送到指定频道
            await self.bus.publish_outbound(OutboundMessage(
                content=result,
                chat_id=job.chat_id,
                channel=job.channel,
            ))
```

---

## 5️⃣ 知识优化

**问题**: 遗忘/反思/巩固？

### 5.1 记忆巩固（Consolidation）

**机制**: 定期将最近对话压缩为简洁记忆

**触发条件**:
- 会话消息数超过阈值
- 定时触发（心跳服务）

**文件**: `agent/memory.py`

```python
class MemoryStore:
    """In-memory store for consolidated memories."""
    
    async def consolidate(
        self,
        session_key: str,
        recent_messages: list[dict],
        provider: LLMProvider,
    ) -> str:
        """Consolidate recent messages into a memory."""
        # 调用 LLM 总结
        prompt = f"""Summarize the following conversation into 1-2 concise sentences:

{self._format_messages(recent_messages)}

Summary:"""
        
        response = await provider.chat(
            messages=[{"role": "user", "content": prompt}],
            model=self.model,
            max_tokens=200,
        )
        
        summary = response.content
        self.add(session_key, summary)
        return summary
```

### 5.2 上下文窗口管理

**策略**: 滑动窗口 + 截断

```python
# 保持最近 memory_window 条消息
recent_messages = all_messages[-self.memory_window:]
```

**优化**:
- 移除工具调用细节（保留结果）
- 压缩长消息
- 移除 `<think>` 块

### 5.3 技能更新

**机制**: 文件系统热加载

```python
# agent/skills.py
def load_skill(self, name: str) -> str | None:
    """Load a skill by name."""
    # 工作空间技能优先（支持覆盖）
    workspace_skill = self.workspace_skills / name / "SKILL.md"
    if workspace_skill.exists():
        return workspace_skill.read_text()
    
    # 内置技能
    builtin_skill = self.builtin_skills / name / "SKILL.md"
    if builtin_skill.exists():
        return builtin_skill.read_text()
    
    return None
```

**优化方向**:
- 技能版本控制
- 依赖检查
- 自动更新

---

## 📊 知识链路完整性评分

| 环节 | 完整性 | 备注 |
|------|-------|------|
| 知识产生 | ✅ 完整 | 多渠道输入，工具集成 |
| 知识存储 | ✅ 完整 | 会话、记忆、任务分离存储 |
| 知识检索 | ⚠️ 基础 | 时间窗口，待优化向量检索 |
| 知识使用 | ✅ 完整 | 代理、子代理、定时任务 |
| 知识优化 | ⚠️ 基础 | 记忆巩固，待优化反思机制 |

**总体评分**: 80%（良好）

---

## 🚀 优化建议

### 短期（1-2 周）

1. **向量记忆检索**
   - 集成 embedding 模型
   - 使用 FAISS/Chroma 进行相似度搜索
   - 提升记忆相关性

2. **记忆标签系统**
   - 为记忆添加标签
   - 支持标签过滤
   - 提升检索精度

3. **反思机制**
   - 定期回顾错误决策
   - 生成"教训"记忆
   - 避免重复错误

### 中期（1-2 月）

1. **知识图谱**
   - 实体关系提取
   - 构建领域知识图谱
   - 支持推理查询

2. **多会话知识共享**
   - 跨会话记忆共享
   - 全局知识库
   - 团队协作支持

3. **技能市场**
   - 技能发现机制
   - 技能评分系统
   - 自动推荐

---

*生成时间：2026-03-02*
