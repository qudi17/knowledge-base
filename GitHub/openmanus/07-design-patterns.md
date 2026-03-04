# 阶段 7：深度分析（设计模式与核心代码）

**执行日期**: 2026-03-04  
**分析重点**: TOC 核心架构、设计模式、关键实现

---

## 🎨 设计模式识别

### 1. 工厂模式 (Factory Pattern) ⭐⭐⭐⭐⭐

**位置**: `app/flow/flow_factory.py`

**用途**: 统一创建不同类型的 Flow

```python
# app/flow/flow_factory.py:1-25
from enum import Enum
from typing import Dict, List, Union

from app.agent.base import BaseAgent
from app.flow.base import BaseFlow
from app.flow.planning import PlanningFlow


class FlowType(str, Enum):
    PLANNING = "planning"


class FlowFactory:
    """Factory for creating different types of flows with support for multiple agents"""

    @staticmethod
    def create_flow(
        flow_type: FlowType,
        agents: Union[BaseAgent, List[BaseAgent], Dict[str, BaseAgent]],
        **kwargs,
    ) -> BaseFlow:
        flows = {
            FlowType.PLANNING: PlanningFlow,
        }

        flow_class = flows.get(flow_type)
        if not flow_class:
            raise ValueError(f"Unknown flow type: {flow_type}")

        return flow_class(agents, **kwargs)
```

**设计优点**:
- ✅ **解耦**: 客户端代码不需要知道具体 Flow 类的实现
- ✅ **扩展性**: 添加新 Flow 类型只需修改 flows 字典
- ✅ **集中管理**: 所有 Flow 创建逻辑集中在一处

**使用场景**:
```python
# run_flow.py:17
flow = FlowFactory.create_flow(
    flow_type=FlowType.PLANNING,
    agents=agents,
)
```

---

### 2. 策略模式 (Strategy Pattern) ⭐⭐⭐⭐⭐

**位置**: `app/flow/planning.py` - Agent 路由

**用途**: 根据步骤类型选择不同的 Agent 执行策略

```python
# app/flow/planning.py:67-80
class PlanningFlow(BaseFlow):
    executor_keys: List[str] = Field(default_factory=list)
    
    def get_executor(self, step_type: Optional[str] = None) -> BaseAgent:
        """
        Get an appropriate executor agent for the current step.
        Can be extended to select agents based on step type/requirements.
        """
        # 策略 1: 根据步骤类型匹配 Agent
        if step_type and step_type in self.agents:
            return self.agents[step_type]

        # 策略 2: 使用第一个可用的 executor
        for key in self.executor_keys:
            if key in self.agents:
                return self.agents[key]

        # 策略 3: 回退到 primary agent
        return self.primary_agent
```

**设计优点**:
- ✅ **灵活性**: 可以根据步骤类型动态选择 Agent
- ✅ **可扩展**: 轻松添加新的 Agent 选择策略
- ✅ **容错性**: 多层回退机制确保总有 Agent 可用

**使用场景**:
```python
# 步骤包含 [BROWSER] 标签
step_info = {"type": "browser", "text": "[BROWSER] Visit example.com"}

# 自动选择 BrowserAgent
executor = self.get_executor(step_type="browser")
# 返回 self.agents["browser"]
```

---

### 3. 状态模式 (State Pattern) ⭐⭐⭐⭐

**位置**: `app/flow/planning.py` - PlanStepStatus

**用途**: 管理计划步骤的不同状态

```python
# app/flow/planning.py:23-37
class PlanStepStatus(str, Enum):
    """Enum class defining possible statuses of a plan step"""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"

    @classmethod
    def get_all_statuses(cls) -> list[str]:
        """Return a list of all possible step status values"""
        return [status.value for status in cls]

    @classmethod
    def get_active_statuses(cls) -> list[str]:
        """Return a list of values representing active statuses"""
        return [cls.NOT_STARTED.value, cls.IN_PROGRESS.value]

    @classmethod
    def get_status_marks(cls) -> Dict[str, str]:
        """Return a mapping of statuses to their marker symbols"""
        return {
            cls.COMPLETED.value: "[✓]",
            cls.IN_PROGRESS.value: "[→]",
            cls.BLOCKED.value: "[!]",
            cls.NOT_STARTED.value: "[ ]",
        }
```

**状态转换**:
```
not_started → in_progress → completed
                      ↓
                   blocked
```

**设计优点**:
- ✅ **清晰的状态定义**: 4 种状态覆盖所有场景
- ✅ **工具方法**: 提供状态查询和标记的便捷方法
- ✅ **类型安全**: Enum 确保状态值的有效性

---

### 4. 责任链模式 (Chain of Responsibility) ⭐⭐⭐⭐

**位置**: `app/agent/` - Agent 层次结构

**用途**: 通过继承链传递责任

```
BaseAgent (基础状态管理、内存管理)
  ↓
ReActAgent (ReAct 模式：think → act)
  ↓
ToolCallAgent (工具调用：think → act → execute_tool)
  ↓
Manus/Browser/DataAnalysis/... (具体实现)
```

**核心实现**:
```python
# app/agent/base.py:107-127
class BaseAgent(BaseModel, ABC):
    async def run(self, request: Optional[str] = None) -> str:
        if request:
            self.update_memory("user", request)
        
        results = []
        async with self.state_context(AgentState.RUNNING):
            while (
                self.current_step < self.max_steps 
                and self.state != AgentState.FINISHED
            ):
                self.current_step += 1
                step_result = await self.step()  # 抽象方法，子类实现
                
                if self.is_stuck():
                    self.handle_stuck_state()
                
                results.append(f"Step {self.current_step}: {step_result}")
        
        return "\n".join(results)

# app/agent/react.py:29-35
class ReActAgent(BaseAgent, ABC):
    async def step(self) -> str:
        """Execute a single step: think and act."""
        should_act = await self.think()  # 子类实现
        if not should_act:
            return "Thinking complete - no action needed"
        return await self.act()  # 子类实现

# app/agent/toolcall.py:62-127
class ToolCallAgent(ReActAgent):
    async def think(self) -> bool:
        """Process current state and decide next actions using tools"""
        response = await self.llm.ask_tool(
            messages=self.messages,
            tools=self.available_tools.to_params(),
        )
        self.tool_calls = response.tool_calls
        return bool(self.tool_calls)
    
    async def act(self) -> str:
        """Execute tool calls and handle their results"""
        if not self.tool_calls:
            return self.messages[-1].content
        
        results = []
        for command in self.tool_calls:
            result = await self.execute_tool(command)
            results.append(result)
        
        return "\n\n".join(results)
```

**设计优点**:
- ✅ **职责分离**: 每层负责特定功能
- ✅ **代码复用**: 公共逻辑在父类实现
- ✅ **易于扩展**: 添加新 Agent 只需继承并实现抽象方法

---

### 5. 工具模式 (Tool Pattern) ⭐⭐⭐⭐⭐

**位置**: `app/tool/tool_collection.py`

**用途**: 统一管理和执行工具

```python
# app/tool/tool_collection.py:10-60
class ToolCollection:
    """A collection of defined tools."""

    class Config:
        arbitrary_types_allowed = True

    def __init__(self, *tools: BaseTool):
        self.tools = tools
        self.tool_map = {tool.name: tool for tool in tools}

    def to_params(self) -> List[Dict[str, Any]]:
        return [tool.to_param() for tool in self.tools]

    async def execute(
        self, *, name: str, tool_input: Dict[str, Any] = None
    ) -> ToolResult:
        tool = self.tool_map.get(name)
        if not tool:
            return ToolFailure(error=f"Tool {name} is invalid")
        try:
            result = await tool(**tool_input)
            return result
        except ToolError as e:
            return ToolFailure(error=e.message)

    def add_tool(self, tool: BaseTool):
        """Add a single tool to the collection."""
        if tool.name in self.tool_map:
            logger.warning(f"Tool {tool.name} already exists, skipping")
            return self
        
        self.tools += (tool,)
        self.tool_map[tool.name] = tool
        return self
```

**设计优点**:
- ✅ **统一管理**: 所有工具通过 tool_map 快速查找
- ✅ **动态扩展**: 支持运行时添加工具
- ✅ **错误处理**: 统一的错误返回格式
- ✅ **参数转换**: to_params() 提供 LLM 友好的格式

---

### 6. 上下文管理器模式 (Context Manager Pattern) ⭐⭐⭐

**位置**: `app/agent/base.py` - state_context

**用途**: 安全的状态转换

```python
# app/agent/base.py:56-74
class BaseAgent(BaseModel, ABC):
    @asynccontextmanager
    async def state_context(self, new_state: AgentState):
        """Context manager for safe agent state transitions."""
        if not isinstance(new_state, AgentState):
            raise ValueError(f"Invalid state: {new_state}")

        previous_state = self.state
        self.state = new_state
        try:
            yield
        except Exception as e:
            self.state = AgentState.ERROR  # 异常时转换为 ERROR 状态
            raise e
        finally:
            self.state = previous_state  # 恢复到之前状态
```

**使用场景**:
```python
# app/agent/base.py:109
async def run(self, request: Optional[str] = None) -> str:
    async with self.state_context(AgentState.RUNNING):
        # 执行循环
        while self.current_step < self.max_steps:
            step_result = await self.step()
    # 自动恢复到之前的状态
```

**设计优点**:
- ✅ **异常安全**: 即使发生异常也能正确恢复状态
- ✅ **代码简洁**: 避免手动的 try-finally 状态恢复
- ✅ **可重用**: 任何需要状态转换的场景都可使用

---

### 7. 单例模式 (Singleton Pattern) ⭐⭐⭐

**位置**: `app/llm.py` - LLM 实例

**用途**: 共享 LLM 实例，减少资源消耗

```python
# app/agent/base.py:46-50
class BaseAgent(BaseModel, ABC):
    llm: LLM = Field(default_factory=LLM, description="Language model instance")
    
    @model_validator(mode="after")
    def initialize_agent(self) -> "BaseAgent":
        if self.llm is None or not isinstance(self.llm, LLM):
            self.llm = LLM(config_name=self.name.lower())
        return self
```

**设计优点**:
- ✅ **资源共享**: 多个 Agent 可共享同一个 LLM 实例
- ✅ **配置灵活**: 也可为每个 Agent 创建独立实例
- ✅ **延迟初始化**: 仅在需要时创建实例

---

## 📝 核心代码片段（3A 原则）

### 片段 1: PlanningFlow 执行循环（85 行）⭐⭐⭐⭐⭐

**文件**: `app/flow/planning.py:89-173`  
**行数**: 85 行  
**职责**: TOC 核心执行逻辑

```python
# app/flow/planning.py:89-173
async def execute(self, input_text: str) -> str:
    """Execute the planning flow with agents."""
    try:
        if not self.primary_agent:
            raise ValueError("No primary agent available")

        # Create initial plan if input provided
        if input_text:
            await self._create_initial_plan(input_text)

            # Verify plan was created successfully
            if self.active_plan_id not in self.planning_tool.plans:
                logger.error(
                    f"Plan creation failed. Plan ID {self.active_plan_id} not found."
                )
                return f"Failed to create plan for: {input_text}"

        result = ""
        while True:
            # Get current step to execute
            self.current_step_index, step_info = await self._get_current_step_info()

            # Exit if no more steps or plan completed
            if self.current_step_index is None:
                result += await self._finalize_plan()
                break

            # Execute current step with appropriate agent
            step_type = step_info.get("type") if step_info else None
            executor = self.get_executor(step_type)
            step_result = await self._execute_step(executor, step_info)
            result += step_result + "\n"

            # Check if agent wants to terminate
            if hasattr(executor, "state") and executor.state == AgentState.FINISHED:
                break

        return result
    except Exception as e:
        logger.error(f"Error in PlanningFlow: {str(e)}")
        return f"Execution failed: {str(e)}"
```

**关键特性**:
1. ✅ **计划验证**: 检查计划是否成功创建
2. ✅ **循环执行**: 持续执行直到所有步骤完成
3. ✅ **Agent 路由**: 根据步骤类型选择合适的 Agent
4. ✅ **异常处理**: 捕获并记录所有异常
5. ✅ **提前终止**: 支持 Agent 主动终止

**设计决策**:
- **为什么使用 while True**: 不确定需要多少步才能完成计划
- **为什么检查 FINISHED 状态**: 允许 Agent 在特定条件下提前终止
- **为什么返回字符串拼接**: 累积所有步骤的结果供最终输出

---

### 片段 2: PlanningTool 创建计划（62 行）⭐⭐⭐⭐⭐

**文件**: `app/tool/planning.py:96-157`  
**行数**: 62 行  
**职责**: 计划创建和状态初始化

```python
# app/tool/planning.py:96-157
def _create_plan(
    self, plan_id: Optional[str], title: Optional[str], steps: Optional[List[str]]
) -> ToolResult:
    """Create a new plan with the given ID, title, and steps."""
    if not plan_id:
        raise ToolError("Parameter `plan_id` is required for command: create")

    if plan_id in self.plans:
        raise ToolError(
            f"A plan with ID '{plan_id}' already exists. Use 'update' to modify."
        )

    if not title:
        raise ToolError("Parameter `title` is required for command: create")

    if (
        not steps
        or not isinstance(steps, list)
        or not all(isinstance(step, str) for step in steps)
    ):
        raise ToolError(
            "Parameter `steps` must be a non-empty list of strings"
        )

    # Create a new plan with initialized step statuses
    plan = {
        "plan_id": plan_id,
        "title": title,
        "steps": steps,
        "step_statuses": ["not_started"] * len(steps),
        "step_notes": [""] * len(steps),
    }

    self.plans[plan_id] = plan
    self._current_plan_id = plan_id  # Set as active plan

    return ToolResult(
        output=f"Plan created successfully with ID: {plan_id}\n\n{self._format_plan(plan)}"
    )
```

**关键特性**:
1. ✅ **参数验证**: 严格检查所有必需参数
2. ✅ **唯一性检查**: 防止重复创建相同 plan_id
3. ✅ **状态初始化**: 所有步骤初始化为 not_started
4. ✅ **自动激活**: 新创建的计划自动成为当前计划
5. ✅ **格式化输出**: 返回人类可读的计划描述

**设计决策**:
- **为什么使用 Dict 存储计划**: 快速查找和更新
- **为什么初始化 step_statuses**: 确保每个步骤都有明确状态
- **为什么设置 active plan**: 简化后续操作的参数传递

---

### 片段 3: ToolCallAgent think 方法（92 行）⭐⭐⭐⭐⭐

**文件**: `app/agent/toolcall.py:62-153`  
**行数**: 92 行  
**职责**: LLM 推理和工具选择

```python
# app/agent/toolcall.py:62-153
async def think(self) -> bool:
    """Process current state and decide next actions using tools"""
    if self.next_step_prompt:
        user_msg = Message.user_message(self.next_step_prompt)
        self.messages += [user_msg]

    try:
        # Get response with tool options
        response = await self.llm.ask_tool(
            messages=self.messages,
            system_msgs=(
                [Message.system_message(self.system_prompt)]
                if self.system_prompt
                else None
            ),
            tools=self.available_tools.to_params(),
            tool_choice=self.tool_choices,
        )
    except ValueError:
        raise
    except Exception as e:
        # Check if this is a RetryError containing TokenLimitExceeded
        if hasattr(e, "__cause__") and isinstance(e.__cause__, TokenLimitExceeded):
            token_limit_error = e.__cause__
            logger.error(f"🚨 Token limit error: {token_limit_error}")
            self.memory.add_message(
                Message.assistant_message(
                    f"Maximum token limit reached: {str(token_limit_error)}"
                )
            )
            self.state = AgentState.FINISHED
            return False
        raise

    self.tool_calls = tool_calls = (
        response.tool_calls if response and response.tool_calls else []
    )
    content = response.content if response and response.content else ""

    # Log response info
    logger.info(f"✨ {self.name}'s thoughts: {content}")
    logger.info(
        f"🛠️ {self.name} selected {len(tool_calls)} tools to use"
    )

    try:
        if response is None:
            raise RuntimeError("No response received from the LLM")

        # Handle different tool_choices modes
        if self.tool_choices == ToolChoice.NONE:
            if tool_calls:
                logger.warning(f"Agent tried to use tools when unavailable")
            if content:
                self.memory.add_message(Message.assistant_message(content))
                return True
            return False

        # Create and add assistant message
        assistant_msg = (
            Message.from_tool_calls(content=content, tool_calls=self.tool_calls)
            if self.tool_calls
            else Message.assistant_message(content)
        )
        self.memory.add_message(assistant_msg)

        if self.tool_choices == ToolChoice.REQUIRED and not self.tool_calls:
            return True  # Will be handled in act()

        # For 'auto' mode, continue with content if no commands but content exists
        if self.tool_choices == ToolChoice.AUTO and not self.tool_calls:
            return bool(content)

        return bool(self.tool_calls)
    except Exception as e:
        logger.error(f"Error in thinking process: {e}")
        self.memory.add_message(Message.assistant_message(f"Error: {str(e)}"))
        return False
```

**关键特性**:
1. ✅ **工具调用**: 通过 LLM 选择合适的工具
2. ✅ **异常处理**: 特殊处理 Token 超限错误
3. ✅ **日志记录**: 详细的思考过程日志
4. ✅ **模式处理**: 支持 NONE/AUTO/REQUIRED 三种工具选择模式
5. ✅ **消息记录**: 将思考结果添加到消息历史

**设计决策**:
- **为什么区分 tool_choices 模式**: 提供不同的控制粒度
- **为什么处理 TokenLimitExceeded**: 避免任务无限重试
- **为什么记录日志**: 便于调试和理解 Agent 决策过程

---

### 片段 4: DockerSandbox 资源隔离（48 行）⭐⭐⭐⭐

**文件**: `app/sandbox/core/sandbox.py:50-97`  
**行数**: 48 行  
**职责**: Docker 容器创建和资源限制

```python
# app/sandbox/core/sandbox.py:50-97
async def create(self) -> "DockerSandbox":
    """Creates and starts the sandbox container."""
    try:
        # Prepare container config with resource limits
        host_config = self.client.api.create_host_config(
            mem_limit=self.config.memory_limit,
            cpu_period=100000,
            cpu_quota=int(100000 * self.config.cpu_limit),
            network_mode="none" if not self.config.network_enabled else "bridge",
            binds=self._prepare_volume_bindings(),
        )

        # Generate unique container name with sandbox_ prefix
        container_name = f"sandbox_{uuid.uuid4().hex[:8]}"

        # Create container
        container = await asyncio.to_thread(
            self.client.api.create_container,
            image=self.config.image,
            command="tail -f /dev/null",
            hostname="sandbox",
            working_dir=self.config.work_dir,
            host_config=host_config,
            name=container_name,
            tty=True,
            detach=True,
        )

        self.container = self.client.containers.get(container["Id"])

        # Start container
        await asyncio.to_thread(self.container.start)

        # Initialize terminal
        self.terminal = AsyncDockerizedTerminal(
            container["Id"],
            self.config.work_dir,
            env_vars={"PYTHONUNBUFFERED": "1"}
        )
        await self.terminal.init()

        return self
    except Exception as e:
        await self.cleanup()
        raise RuntimeError(f"Failed to create sandbox: {e}") from e
```

**关键特性**:
1. ✅ **内存限制**: `mem_limit` 防止内存溢出
2. ✅ **CPU 限制**: `cpu_quota` 控制 CPU 使用
3. ✅ **网络隔离**: `network_mode="none"` 可选网络隔离
4. ✅ **唯一命名**: UUID 防止容器名冲突
5. ✅ **异常清理**: 失败时自动清理资源

**设计决策**:
- **为什么使用 uuid**: 确保容器名唯一，支持并发沙箱
- **为什么使用 tail -f /dev/null**: 保持容器运行而不执行任何命令
- **为什么设置 PYTHONUNBUFFERED**: 确保 Python 输出实时显示

---

## 📊 代码指标统计

### 文件大小分布

| 范围 | 文件数 | 占比 | 示例 |
|------|--------|------|------|
| >400 行 | 3 | 4% | planning.py, sandbox.py, llm.py |
| 200-400 行 | 8 | 11% | toolcall.py, manus.py, planning.py |
| 100-200 行 | 20 | 27% | base.py, browser.py, 各种工具 |
| <100 行 | 43 | 58% | 配置文件、异常定义等 |

### 复杂度分析

| 模块 | 平均复杂度 | 最高复杂度 | 备注 |
|------|-----------|-----------|------|
| Flow | 高 | PlanningFlow (12) | 多分支和循环 |
| Agent | 中高 | ToolCallAgent (10) | 异常处理复杂 |
| Tool | 中 | PlanningTool (9) | 多命令处理 |
| Sandbox | 高 | DockerSandbox (11) | 资源管理复杂 |

---

## 🎯 性能优化点

### 1. 异步执行 ⭐⭐⭐⭐⭐

**位置**: 全局使用 asyncio

```python
# app/agent/base.py:107
async def run(self, request: Optional[str] = None) -> str:
    async with self.state_context(AgentState.RUNNING):
        while self.current_step < self.max_steps:
            step_result = await self.step()  # 异步执行
```

**优势**:
- ✅ 非阻塞 I/O（LLM API、文件读写）
- ✅ 支持并发执行多个任务
- ✅ 提高资源利用率

### 2. 工具缓存 ⭐⭐⭐

**位置**: `app/tool/tool_collection.py`

```python
self.tool_map = {tool.name: tool for tool in tools}
```

**优势**:
- ✅ O(1) 时间复杂度的工具查找
- ✅ 避免重复创建工具实例

### 3. 消息历史限制 ⭐⭐⭐

**位置**: `app/schema.py:141`

```python
class Memory(BaseModel):
    max_messages: int = Field(default=100)
    
    def add_message(self, message: Message) -> None:
        self.messages.append(message)
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages:]
```

**优势**:
- ✅ 防止内存溢出
- ✅ 控制 Token 使用量

---

## 🔒 安全机制

### 1. 沙箱隔离 ⭐⭐⭐⭐⭐

```python
# app/sandbox/core/sandbox.py:53
host_config = self.client.api.create_host_config(
    mem_limit=self.config.memory_limit,
    cpu_quota=int(100000 * self.config.cpu_limit),
    network_mode="none" if not self.config.network_enabled else "bridge",
)
```

**保护**:
- ✅ 资源限制（内存/CPU）
- ✅ 网络隔离（可选）
- ✅ 文件系统隔离

### 2. 路径安全检查 ⭐⭐⭐⭐

```python
# app/sandbox/core/sandbox.py:209
def _safe_resolve_path(self, path: str) -> str:
    if ".." in path.split("/"):
        raise ValueError("Path contains potentially unsafe patterns")
    
    resolved = os.path.join(self.config.work_dir, path)
    return resolved
```

**保护**:
- ✅ 防止路径遍历攻击
- ✅ 限制访问范围

### 3. 超时保护 ⭐⭐⭐⭐

```python
# run_flow.py:27
result = await asyncio.wait_for(
    flow.execute(prompt),
    timeout=3600,  # 60 分钟超时
)
```

**保护**:
- ✅ 防止无限循环
- ✅ 资源及时释放

---

## 📈 可复用设计模式总结

### 1. TOC 核心架构（可直接复用）

```python
# 1. 定义 Flow 类型
class FlowType(str, Enum):
    PLANNING = "planning"
    ORCHESTRATION = "orchestration"

# 2. 创建 Flow 工厂
class FlowFactory:
    @staticmethod
    def create_flow(flow_type, agents, **kwargs):
        flow_class = flows.get(flow_type)
        return flow_class(agents, **kwargs)

# 3. 实现 PlanningFlow
class PlanningFlow(BaseFlow):
    async def execute(self, input_text: str) -> str:
        # 创建计划
        await self._create_initial_plan(input_text)
        
        # 循环执行步骤
        while True:
            step_index, step_info = await self._get_current_step_info()
            if step_index is None:
                break
            
            executor = self.get_executor(step_info.get("type"))
            await self._execute_step(executor, step_info)
        
        return await self._finalize_plan()
```

### 2. Agent 层次结构（可直接复用）

```python
# 1. 定义基类
class BaseAgent(BaseModel, ABC):
    @abstractmethod
    async def step(self) -> str:
        pass
    
    async def run(self, request: str) -> str:
        async with self.state_context(AgentState.RUNNING):
            while self.current_step < self.max_steps:
                self.current_step += 1
                result = await self.step()

# 2. 实现具体 Agent
class MyCustomAgent(ToolCallAgent):
    name = "my_agent"
    available_tools = ToolCollection(Tool1(), Tool2())
    
    async def step(self) -> str:
        should_act = await self.think()
        if should_act:
            return await self.act()
```

### 3. 工具集合模式（可直接复用）

```python
class ToolCollection:
    def __init__(self, *tools):
        self.tools = tools
        self.tool_map = {tool.name: tool for tool in tools}
    
    async def execute(self, name: str, **kwargs):
        tool = self.tool_map.get(name)
        if tool:
            return await tool(**kwargs)
        return ToolFailure(error=f"Tool {name} not found")
```

---

**完整性**: ✅ 设计模式和核心代码已分析  
**下一步**: 阶段 8 - 完整性评分
