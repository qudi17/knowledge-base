# 阶段 4：知识链路完整性检查

**执行日期**: 2026-03-04  
**检查范围**: 知识生命周期 5 环节

---

## 🔗 知识链路 5 环节分析

### 1️⃣ 知识产生（Knowledge Generation）

**来源**:
- **用户输入**: main.py → `prompt = input("Enter your prompt: ")`
- **Flow 输入**: run_flow.py → `prompt = input("Enter your prompt: ")`
- **MCP 工具**: 通过 MCP 协议从外部服务获取
- **浏览器**: BrowserUseTool 从网页抓取
- **沙箱执行**: PythonExecute/Bash 执行结果

**知识产生点**:
```python
# app/flow/planning.py:125
response = await self.llm.ask_tool(
    messages=[user_message],
    system_msgs=[system_message],
    tools=[self.planning_tool.to_param()],
)
# ↓ LLM 生成计划步骤

# app/agent/toolcall.py:78
response = await self.llm.ask_tool(
    messages=self.messages,
    tools=self.available_tools.to_params(),
)
# ↓ LLM 生成工具调用决策
```

**完整性**: ✅ 覆盖用户输入、LLM 推理、工具执行结果

---

### 2️⃣ 知识存储（Knowledge Storage）

**存储机制**:

| 类型 | 存储位置 | 数据结构 | 生命周期 |
|------|---------|----------|---------|
| **计划数据** | PlanningTool.plans (内存) | `Dict[str, Dict]` | 会话级 |
| **消息历史** | Agent.memory.messages | `List[Message]` | 会话级 |
| **工具结果** | ToolResult | 对象 | 单次执行 |
| **沙箱文件** | Docker 容器 | 文件系统 | 容器生命周期 |
| **配置** | config.toml | TOML 文件 | 持久化 |

**计划数据结构**:
```python
# app/tool/planning.py:96
plan = {
    "plan_id": plan_id,
    "title": title,
    "steps": steps,  # List[str]
    "step_statuses": ["not_started"] * len(steps),
    "step_notes": [""] * len(steps),
}
self.plans[plan_id] = plan
```

**消息数据结构**:
```python
# app/schema.py
class Message(BaseModel):
    role: Literal["user", "system", "assistant", "tool"]
    content: str
    tool_calls: Optional[List[ToolCall]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None
    base64_image: Optional[str] = None
```

**完整性**: ✅ 覆盖计划、消息、工具结果、文件

---

### 3️⃣ 知识检索（Knowledge Retrieval）

**检索机制**:

#### 计划检索
```python
# app/flow/planning.py:178
async def _get_current_step_info(self):
    plan_data = self.planning_tool.plans[self.active_plan_id]
    steps = plan_data.get("steps", [])
    step_statuses = plan_data.get("step_statuses", [])
    
    # 查找第一个活跃步骤
    for i, step in enumerate(steps):
        if status in PlanStepStatus.get_active_statuses():
            return i, step_info
```

#### 消息检索
```python
# app/agent/base.py:148
@property
def messages(self) -> List[Message]:
    return self.memory.messages

# app/agent/browser.py:34
recent_messages = self.memory.messages[-3:] if self.memory.messages else []
```

#### 工具检索
```python
# app/tool/tool_collection.py:49
def get_tool(self, name: str) -> BaseTool:
    return self.tool_map.get(name)
```

**检索策略**:
- ✅ **直接查找**: 通过 plan_id/tool_name 精确查找
- ✅ **顺序遍历**: 查找第一个活跃步骤
- ✅ **最近 N 条**: 获取最近消息上下文
- ❌ **语义检索**: 无向量相似度检索
- ❌ **混合检索**: 无多路召回

**完整性**: ⚠️ 基础检索完备，缺少高级检索机制

---

### 4️⃣ 知识使用（Knowledge Usage）

**使用场景**:

#### 计划使用
```python
# app/flow/planning.py:220
async def _execute_step(self, executor: BaseAgent, step_info: dict) -> str:
    plan_status = await self._get_plan_text()
    step_text = step_info.get("text", f"Step {self.current_step_index}")
    
    step_prompt = f"""
    CURRENT PLAN STATUS:
    {plan_status}
    
    YOUR CURRENT TASK:
    You are now working on step {self.current_step_index}: "{step_text}"
    """
    
    step_result = await executor.run(step_prompt)
```

#### 消息历史使用
```python
# app/agent/toolcall.py:68
response = await self.llm.ask_tool(
    messages=self.messages,  # 完整消息历史
    system_msgs=[Message.system_message(self.system_prompt)],
    tools=self.available_tools.to_params(),
)
```

#### 工具结果使用
```python
# app/agent/toolcall.py:138
tool_msg = Message.tool_message(
    content=result,
    tool_call_id=command.id,
    name=command.function.name,
)
self.memory.add_message(tool_msg)  # 添加到消息历史
```

**完整性**: ✅ 计划、消息、工具结果均被有效使用

---

### 5️⃣ 知识优化（Knowledge Optimization）

**优化机制**:

#### 1.  stuck 检测和处理
```python
# app/agent/base.py:138
def is_stuck(self) -> bool:
    if len(self.memory.messages) < 2:
        return False
    
    last_message = self.memory.messages[-1]
    duplicate_count = sum(
        1 for msg in reversed(self.memory.messages[:-1])
        if msg.role == "assistant" and msg.content == last_message.content
    )
    return duplicate_count >= self.duplicate_threshold

def handle_stuck_state(self):
    stuck_prompt = "Observed duplicate responses. Consider new strategies..."
    self.next_step_prompt = f"{stuck_prompt}\n{self.next_step_prompt}"
```

#### 2. 步骤状态优化
```python
# app/tool/planning.py:145
def _update_plan(self, plan_id, title, steps):
    # 保留未变更步骤的状态
    old_steps = plan["steps"]
    old_statuses = plan["step_statuses"]
    
    new_statuses = []
    for i, step in enumerate(steps):
        if i < len(old_steps) and step == old_steps[i]:
            new_statuses.append(old_statuses[i])  # 保留状态
        else:
            new_statuses.append("not_started")  # 新步骤重置
```

#### 3. 超时保护
```python
# run_flow.py:27
result = await asyncio.wait_for(
    flow.execute(prompt),
    timeout=3600,  # 60 分钟超时
)
```

#### 4. 资源清理
```python
# app/agent/toolcall.py:203
async def cleanup(self):
    for tool_name, tool_instance in self.available_tools.tool_map.items():
        if hasattr(tool_instance, "cleanup"):
            await tool_instance.cleanup()

# app/sandbox/core/sandbox.py:369
async def cleanup(self):
    if self.container:
        await self.container.stop(timeout=5)
        await self.container.remove(force=True)
```

**缺失的优化机制**:
- ❌ **记忆压缩**: 无消息历史压缩/摘要机制
- ❌ **遗忘机制**: 无主动遗忘策略
- ❌ **反思机制**: 无执行后反思（AAR）
- ❌ **知识巩固**: 无长期记忆存储

**完整性**: ⚠️ 基础优化完备，缺少高级优化机制

---

## 📊 知识链路完整性评分

| 环节 | 完整性 | 评分 | 备注 |
|------|--------|------|------|
| 知识产生 | ✅ 完备 | 95/100 | 覆盖多来源 |
| 知识存储 | ✅ 完备 | 90/100 | 内存存储为主 |
| 知识检索 | ⚠️ 基础 | 75/100 | 缺少语义检索 |
| 知识使用 | ✅ 完备 | 95/100 | 有效集成到执行流 |
| 知识优化 | ⚠️ 基础 | 70/100 | 缺少高级优化 |

**总体评分**: **85/100** ⭐⭐⭐⭐

---

## 🔧 改进建议

### 短期改进（易实现）
1. ✅ **消息摘要**: 当消息历史过长时，自动摘要早期消息
2. ✅ **执行日志**: 添加详细的执行日志用于事后分析
3. ✅ **错误分类**: 对工具执行错误进行分类和记录

### 长期改进（需设计）
1. ⚠️ **长期记忆**: 引入向量数据库存储历史执行经验
2. ⚠️ **反思机制**: 任务完成后执行 AAR（After Action Review）
3. ⚠️ **知识图谱**: 构建任务 - 工具 - 结果的知识图谱

---

**完整性**: ✅ 知识链路 5 环节已分析  
**下一步**: 阶段 5 - 架构层次覆盖检查
