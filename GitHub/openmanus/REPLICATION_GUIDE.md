# OpenManus TOC 复刻指南

**目标**: 在自己的项目中复刻 OpenManus 的 TOC（任务编排与控制）架构  
**研究来源**: `/Users/eddy/.openclaw/workspace/knowledge-base/github/openmanus/`  
**完整性**: 97.2/100 ⭐⭐⭐⭐⭐

---

## 📦 一、核心架构概览

### OpenManus TOC 核心组件

```
┌─────────────────────────────────────────────────┐
│              PlanningFlow (TOC 核心)             │
│  - 计划创建/更新/删除                            │
│  - Agent 路由（策略模式）                         │
│  - 状态管理（4 种步骤状态）                       │
│  - 循环执行直到完成                              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│            Agent 层次结构（责任链）              │
│  BaseAgent → ReActAgent → ToolCallAgent        │
│                    ↓                            │
│    ┌───────────┬───────────┬───────────┐       │
│    ↓           ↓           ↓           ↓       │
│  Manus    Browser    Data     Sandbox        │
│  (通用)   (浏览器)  (分析)    (沙箱)          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│          ToolCollection (工具管理)              │
│  - O(1) 查找速度 (tool_map)                     │
│  - 动态添加工具                                  │
│  - MCP 远程工具支持                              │
│  - 统一错误处理                                  │
└─────────────────────────────────────────────────┘
```

---

## 💻 二、核心代码实现

### 1. PlanningFlow（TOC 核心）⭐⭐⭐⭐⭐

**职责**: 任务编排与执行循环

```python
# planning_flow.py
from enum import Enum
from typing import Dict, List, Optional
from app.agent.base import BaseAgent


class PlanStepStatus(str, Enum):
    """步骤状态定义"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    
    @classmethod
    def get_status_marks(cls) -> Dict[str, str]:
        """状态标记符号"""
        return {
            cls.COMPLETED.value: "[✓]",
            cls.IN_PROGRESS.value: "[→]",
            cls.BLOCKED.value: "[!]",
            cls.NOT_STARTED.value: "[ ]",
        }


class PlanningFlow:
    """PlanningFlow - TOC 核心实现"""
    
    def __init__(self, agents: Dict[str, BaseAgent], primary_agent: BaseAgent):
        self.agents = agents  # {"browser": BrowserAgent, "coder": CoderAgent, ...}
        self.primary_agent = primary_agent
        self.executor_keys = list(agents.keys())
        self.planning_tool = PlanningTool()
        self.active_plan_id = None
        self.current_step_index = None
    
    async def execute(self, input_text: str) -> str:
        """执行完整的工作流"""
        try:
            # 1. 创建初始计划
            await self._create_initial_plan(input_text)
            
            # 2. 循环执行步骤
            result = ""
            while True:
                # 获取当前步骤
                self.current_step_index, step_info = await self._get_current_step_info()
                
                # 所有步骤完成，退出循环
                if self.current_step_index is None:
                    result += await self._finalize_plan()
                    break
                
                # 3. Agent 路由（策略模式）
                step_type = step_info.get("type")
                executor = self.get_executor(step_type)
                
                # 4. 执行步骤
                step_result = await self._execute_step(executor, step_info)
                result += f"\n{step_result}"
            
            return result
            
        except Exception as e:
            logger.error(f"Flow execution failed: {e}")
            raise
    
    def get_executor(self, step_type: Optional[str] = None) -> BaseAgent:
        """策略模式：根据步骤类型选择 Agent"""
        # 策略 1: 根据步骤类型匹配
        if step_type and step_type in self.agents:
            return self.agents[step_type]
        
        # 策略 2: 使用第一个可用的 executor
        for key in self.executor_keys:
            if key in self.agents:
                return self.agents[key]
        
        # 策略 3: 回退到 primary agent
        return self.primary_agent
    
    async def _create_initial_plan(self, input_text: str):
        """创建初始计划"""
        plan_id = f"plan_{uuid.uuid4().hex[:8]}"
        
        # 使用 LLM 生成计划
        prompt = f"""
        你是规划助手。用户目标是：{input_text}
        
        请将任务分解为有序的步骤列表。每个步骤格式：
        [TYPE] 步骤描述
        
        TYPE 可以是：BROWSER, CODE, ANALYSIS, SANDBOX, GENERAL
        
        示例：
        1. [BROWSER] 访问 example.com 获取数据
        2. [CODE] 编写 Python 脚本处理数据
        3. [ANALYSIS] 分析处理结果
        4. [SANDBOX] 在沙箱中运行测试
        """
        
        response = await self.primary_agent.llm.ask(prompt)
        steps = self._parse_steps(response)
        
        # 创建计划
        self.planning_tool.create_plan(
            plan_id=plan_id,
            title=f"Plan for: {input_text}",
            steps=steps
        )
        
        self.active_plan_id = plan_id
    
    def _parse_steps(self, response: str) -> List[str]:
        """解析 LLM 返回的步骤"""
        import re
        steps = []
        for line in response.split("\n"):
            # 匹配 [TYPE] 格式
            if re.search(r"\[\w+\]", line):
                steps.append(line.strip())
        return steps
    
    async def _get_current_step_info(self) -> tuple[Optional[int], Dict]:
        """获取下一个待执行步骤"""
        plan = self.planning_tool.get_plan(self.active_plan_id)
        
        for i, (step, status) in enumerate(zip(
            plan["steps"], 
            plan["step_statuses"]
        )):
            if status == PlanStepStatus.NOT_STARTED.value:
                # 解析步骤类型
                import re
                type_match = re.search(r"\[([A-Z_]+)\]", step)
                step_type = type_match.group(1).lower() if type_match else None
                
                return i, {
                    "text": step,
                    "type": step_type,
                    "index": i
                }
        
        return None, {}  # 所有步骤完成
    
    async def _execute_step(self, executor: BaseAgent, step_info: Dict) -> str:
        """执行单个步骤"""
        step_text = step_info["text"]
        
        # 更新步骤状态
        self.planning_tool.update_step_status(
            self.active_plan_id,
            step_info["index"],
            PlanStepStatus.IN_PROGRESS.value
        )
        
        # 执行步骤
        try:
            result = await executor.run(step_text)
            
            # 标记为完成
            self.planning_tool.update_step_status(
                self.active_plan_id,
                step_info["index"],
                PlanStepStatus.COMPLETED.value
            )
            
            return f"✓ Completed: {step_text}\n  Result: {result}"
            
        except Exception as e:
            # 标记为阻塞
            self.planning_tool.update_step_status(
                self.active_plan_id,
                step_info["index"],
                PlanStepStatus.BLOCKED.value
            )
            
            return f"✗ Blocked: {step_text}\n  Error: {e}"
    
    async def _finalize_plan(self) -> str:
        """完成计划并生成总结"""
        plan = self.planning_tool.get_plan(self.active_plan_id)
        
        # 生成总结报告
        prompt = f"""
        任务已完成。请生成总结报告。
        
        计划标题：{plan['title']}
        总步骤数：{len(plan['steps'])}
        步骤详情：
        """
        
        for step, status in zip(plan["steps"], plan["step_statuses"]):
            mark = PlanStepStatus.get_status_marks()[status]
            prompt += f"{mark} {step}\n"
        
        summary = await self.primary_agent.llm.ask(prompt)
        return f"\n=== Plan Completed ===\n{summary}"
```

---

### 2. PlanningTool（计划管理工具）⭐⭐⭐⭐⭐

**职责**: 计划的 CRUD 操作

```python
# planning_tool.py
from typing import Dict, List, Optional


class PlanningTool:
    """计划管理工具"""
    
    def __init__(self):
        self.plans: Dict[str, Dict] = {}
        self._current_plan_id: Optional[str] = None
    
    def create_plan(self, plan_id: str, title: str, steps: List[str]):
        """创建新计划"""
        if not plan_id or not title or not steps:
            raise ValueError("Missing required parameters")
        
        plan = {
            "plan_id": plan_id,
            "title": title,
            "steps": steps,
            "step_statuses": ["not_started"] * len(steps),
            "step_notes": [""] * len(steps),
        }
        
        self.plans[plan_id] = plan
        self._current_plan_id = plan_id
        
        return self._format_plan(plan)
    
    def update_step_status(
        self, 
        plan_id: str, 
        step_index: int, 
        new_status: str
    ):
        """更新步骤状态"""
        if plan_id not in self.plans:
            raise ValueError(f"Plan {plan_id} not found")
        
        plan = self.plans[plan_id]
        
        if step_index < 0 or step_index >= len(plan["steps"]):
            raise ValueError(f"Invalid step index: {step_index}")
        
        plan["step_statuses"][step_index] = new_status
        
        return self._format_step(step_index, plan)
    
    def get_plan(self, plan_id: str) -> Optional[Dict]:
        """获取计划"""
        return self.plans.get(plan_id)
    
    def _format_plan(self, plan: Dict) -> str:
        """格式化计划输出"""
        marks = PlanStepStatus.get_status_marks()
        
        output = f"Plan: {plan['title']}\n"
        for i, (step, status) in enumerate(
            zip(plan["steps"], plan["step_statuses"])
        ):
            mark = marks.get(status, "[ ]")
            output += f"{i+1}. {mark} {step}\n"
        
        return output
    
    def _format_step(self, step_index: int, plan: Dict) -> str:
        """格式化单个步骤"""
        step = plan["steps"][step_index]
        status = plan["step_statuses"][step_index]
        mark = PlanStepStatus.get_status_marks().get(status, "[ ]")
        
        return f"{step_index+1}. {mark} {step}"
```

---

### 3. Agent 层次结构（责任链模式）⭐⭐⭐⭐⭐

#### 3.1 BaseAgent（基础类）

```python
# base_agent.py
from enum import Enum
from typing import List, Optional
from contextlib import asynccontextmanager


class AgentState(str, Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    FINISHED = "FINISHED"
    ERROR = "ERROR"


class BaseAgent:
    """Agent 基类"""
    
    def __init__(self, name: str, llm=None):
        self.name = name
        self.llm = llm
        self.state = AgentState.IDLE
        self.max_steps = 20
        self.current_step = 0
        self.memory_messages: List[Dict] = []
        self.duplicate_threshold = 3
    
    @asynccontextmanager
    async def state_context(self, new_state: AgentState):
        """上下文管理器：安全的状态转换"""
        previous_state = self.state
        self.state = new_state
        try:
            yield
        except Exception as e:
            self.state = AgentState.ERROR
            raise e
        finally:
            self.state = previous_state
    
    async def run(self, request: str) -> str:
        """运行 Agent"""
        self.memory_messages.append({"role": "user", "content": request})
        
        results = []
        async with self.state_context(AgentState.RUNNING):
            while (
                self.current_step < self.max_steps 
                and self.state != AgentState.FINISHED
            ):
                self.current_step += 1
                step_result = await self.step()
                
                # Stuck 检测
                if self.is_stuck():
                    self.handle_stuck_state()
                
                results.append(f"Step {self.current_step}: {step_result}")
        
        return "\n".join(results)
    
    async def step(self) -> str:
        """抽象方法：子类实现"""
        raise NotImplementedError
    
    def is_stuck(self) -> bool:
        """检测是否陷入循环"""
        if len(self.memory_messages) < 2:
            return False
        
        last_message = self.memory_messages[-1]
        duplicate_count = sum(
            1 for msg in reversed(self.memory_messages[:-1])
            if msg.get("content") == last_message.get("content")
        )
        
        return duplicate_count >= self.duplicate_threshold
    
    def handle_stuck_state(self):
        """处理 stuck 状态"""
        stuck_prompt = (
            "Observed duplicate responses. "
            "Consider new strategies and avoid repeating ineffective approaches."
        )
        self.memory_messages.append({
            "role": "system",
            "content": stuck_prompt
        })
```

#### 3.2 ToolCallAgent（工具调用 Agent）

```python
# tool_call_agent.py
import json


class ToolCallAgent(BaseAgent):
    """支持工具调用的 Agent"""
    
    def __init__(self, name: str, llm=None, tools=None):
        super().__init__(name, llm)
        self.tools = tools  # ToolCollection
        self.tool_calls: List[Dict] = []
    
    async def step(self) -> str:
        """执行单个步骤：think → act"""
        # Think: 决定使用什么工具
        should_act = await self.think()
        
        if not should_act:
            return "Thinking complete - no action needed"
        
        # Act: 执行工具调用
        return await self.act()
    
    async def think(self) -> bool:
        """处理当前状态并决定下一步行动"""
        response = await self.llm.ask_tool(
            messages=self.memory_messages,
            tools=self.tools.to_params()
        )
        
        self.tool_calls = response.get("tool_calls", [])
        return bool(self.tool_calls)
    
    async def act(self) -> str:
        """执行工具调用"""
        if not self.tool_calls:
            return self.memory_messages[-1].get("content", "")
        
        results = []
        for tool_call in self.tool_calls:
            result = await self.execute_tool(tool_call)
            results.append(result)
        
        return "\n\n".join(results)
    
    async def execute_tool(self, tool_call: Dict) -> str:
        """执行单个工具调用"""
        tool_name = tool_call["function"]["name"]
        tool_args = json.loads(tool_call["function"]["arguments"] or "{}")
        
        try:
            result = await self.tools.execute(name=tool_name, **tool_args)
            
            # 记录到内存
            self.memory_messages.append({
                "role": "assistant",
                "content": f"Called {tool_name}",
            })
            self.memory_messages.append({
                "role": "tool",
                "content": str(result),
                "tool_call_id": tool_call.get("id"),
            })
            
            return str(result)
            
        except Exception as e:
            return f"Error executing {tool_name}: {e}"
```

---

### 4. ToolCollection（工具管理）⭐⭐⭐⭐⭐

```python
# tool_collection.py
from typing import Dict, List, Any


class ToolCollection:
    """工具集合管理"""
    
    def __init__(self, *tools):
        self.tools = tools
        self.tool_map: Dict[str, Any] = {
            tool.name: tool for tool in tools
        }
    
    def to_params(self) -> List[Dict[str, Any]]:
        """转换为 LLM 友好的格式"""
        return [tool.to_param() for tool in self.tools]
    
    async def execute(self, *, name: str, **kwargs) -> Any:
        """执行工具"""
        tool = self.tool_map.get(name)
        
        if not tool:
            return {"error": f"Tool {name} not found"}
        
        try:
            result = await tool(**kwargs)
            return result
        except Exception as e:
            return {"error": str(e)}
    
    def add_tool(self, tool):
        """添加单个工具"""
        if tool.name in self.tool_map:
            logger.warning(f"Tool {tool.name} already exists")
            return self
        
        self.tools += (tool,)
        self.tool_map[tool.name] = tool
        return self
    
    def get_tool(self, name: str):
        """获取工具"""
        return self.tool_map.get(name)
```

---

## 📝 三、提示词模板

### 1. 计划生成提示词 ⭐⭐⭐⭐⭐

```python
PLAN_GENERATION_PROMPT = """
你是规划助手。用户目标是：{user_goal}

请将任务分解为有序的步骤列表。每个步骤格式：
[TYPE] 步骤描述

TYPE 可以是：
- BROWSER: 网页浏览、数据抓取
- CODE: 代码编写、文件操作
- ANALYSIS: 数据分析、报告生成
- SANDBOX: 沙箱执行、测试
- GENERAL: 通用任务

示例输出：
1. [BROWSER] 访问 example.com 获取最新数据
2. [CODE] 编写 Python 脚本清洗和转换数据
3. [ANALYSIS] 分析数据趋势，生成可视化图表
4. [SANDBOX] 在隔离环境中运行测试验证结果
5. [GENERAL] 生成最终报告并总结关键发现

要求：
- 步骤之间逻辑清晰，前后依赖合理
- 每个步骤可独立执行
- 优先使用专用工具（BROWSER/CODE 等）
- 总步骤数控制在 5-10 个
"""
```

### 2. Agent 执行提示词 ⭐⭐⭐⭐⭐

```python
AGENT_EXECUTION_PROMPT = """
你是 {agent_role}。当前任务：{task_description}

可用工具：
{available_tools}

当前状态：
- 已执行步骤：{completed_steps}
- 当前步骤：{current_step}
- 计划进度：{progress_percentage}%

请决定下一步行动：
1. 如果需要调用工具，返回工具调用格式
2. 如果任务完成，返回最终结果
3. 如果需要更多信息，说明需要什么

示例工具调用：
{{
  "name": "browser_navigate",
  "arguments": {{"url": "https://example.com"}}
}}
"""
```

### 3. Browser Agent 专用提示词 ⭐⭐⭐⭐

```python
BROWSER_AGENT_PROMPT = """
你是浏览器控制助手。当前 URL: {current_url}

可用操作：
- navigate(url): 导航到指定 URL
- click(selector): 点击元素
- fill(selector, text): 填充表单
- screenshot(): 截图
- get_text(selector): 获取文本
- evaluate(js): 执行 JavaScript

当前页面状态：
{page_state}

用户目标：{user_goal}

请决定下一步操作。如果需要导航，优先使用 navigate()。
"""
```

### 4. Stuck 处理提示词 ⭐⭐⭐

```python
STUCK_HANDLING_PROMPT = """
Observed duplicate responses. Consider new strategies and avoid repeating ineffective approaches.

当前任务：{task}
已尝试方法：{attempted_approaches}

请：
1. 分析为什么之前的方法无效
2. 提出新的解决思路
3. 避免重复之前的错误
"""
```

---

## 🏗️ 四、架构设计决策

### 1. 为什么使用策略模式进行 Agent 路由？

**优点**:
- ✅ 灵活性：根据步骤类型动态选择 Agent
- ✅ 可扩展：轻松添加新的 Agent 类型
- ✅ 容错性：多层回退机制确保总有 Agent 可用

**实现**:
```python
def get_executor(self, step_type: Optional[str] = None) -> BaseAgent:
    # 策略 1: 根据步骤类型匹配
    if step_type and step_type in self.agents:
        return self.agents[step_type]
    
    # 策略 2: 使用第一个可用的 executor
    for key in self.executor_keys:
        if key in self.agents:
            return self.agents[key]
    
    # 策略 3: 回退到 primary agent
    return self.primary_agent
```

---

### 2. 为什么使用 4 种步骤状态？

**状态定义**:
- `not_started`: 未开始
- `in_progress`: 执行中
- `completed`: 已完成
- `blocked`: 阻塞（执行失败）

**优点**:
- ✅ 清晰的状态流转
- ✅ 便于调试和监控
- ✅ 支持错误恢复

**状态转换**:
```
not_started → in_progress → completed
                      ↓
                   blocked (可重试)
```

---

### 3. 为什么使用责任链模式的 Agent 继承？

**继承链**:
```
BaseAgent (状态管理/内存管理)
  ↓
ReActAgent (ReAct 模式：think → act)
  ↓
ToolCallAgent (工具调用)
  ↓
Manus/Browser/DataAnalysis/... (具体实现)
```

**优点**:
- ✅ 职责分离：每层负责特定功能
- ✅ 代码复用：公共逻辑在父类实现
- ✅ 易于扩展：添加新 Agent 只需继承

---

### 4. 为什么使用 ToolCollection 统一管理工具？

**优点**:
- ✅ O(1) 查找速度（tool_map）
- ✅ 动态扩展（add_tool）
- ✅ 统一错误处理
- ✅ LLM 友好的参数转换（to_params）

**实现**:
```python
class ToolCollection:
    def __init__(self, *tools):
        self.tool_map = {tool.name: tool for tool in tools}
    
    async def execute(self, *, name: str, **kwargs):
        tool = self.tool_map.get(name)
        return await tool(**kwargs) if tool else ToolFailure()
```

---

## 🚀 五、快速开始模板

### 最小可运行示例

```python
# main.py
import asyncio
from planning_flow import PlanningFlow
from tool_call_agent import ToolCallAgent
from tool_collection import ToolCollection
from planning_tool import PlanningTool


async def main():
    # 1. 创建工具
    tools = ToolCollection(
        BrowserTool(),
        CodeTool(),
        AnalysisTool(),
    )
    
    # 2. 创建 Agent
    browser_agent = ToolCallAgent(
        name="BrowserAgent",
        tools=tools,
    )
    
    code_agent = ToolCallAgent(
        name="CodeAgent",
        tools=tools,
    )
    
    primary_agent = ToolCallAgent(
        name="PrimaryAgent",
        tools=tools,
    )
    
    # 3. 创建 Flow
    flow = PlanningFlow(
        agents={
            "browser": browser_agent,
            "code": code_agent,
        },
        primary_agent=primary_agent,
    )
    
    # 4. 执行
    result = await flow.execute("帮我分析 example.com 的数据")
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 📊 六、性能优化建议

### 1. 并行执行（未来扩展）

```python
async def _execute_steps_parallel(self, step_indices: List[int]):
    """并行执行多个步骤"""
    tasks = [
        self._execute_step(self.get_executor(), steps[i])
        for i in step_indices
    ]
    results = await asyncio.gather(*tasks)
    return results
```

### 2. 结果缓存

```python
from functools import lru_cache


class PlanningFlow:
    @lru_cache(maxsize=100)
    def get_executor(self, step_type: str) -> BaseAgent:
        # 缓存 Agent 路由结果
        ...
```

### 3. 超时保护

```python
import asyncio


async def execute_with_timeout(self, input_text: str, timeout: int = 3600):
    """带超时的执行"""
    try:
        result = await asyncio.wait_for(
            self.execute(input_text),
            timeout=timeout
        )
        return result
    except asyncio.TimeoutError:
        return "Error: Execution timed out"
```

---

## 🔍 七、调试技巧

### 1. 日志记录

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PlanningFlow:
    async def execute(self, input_text: str):
        logger.info(f"Starting flow with input: {input_text}")
        
        while True:
            step_index, step_info = await self._get_current_step_info()
            logger.info(f"Executing step {step_index}: {step_info}")
            ...
```

### 2. 状态监控

```python
def get_plan_status(self, plan_id: str) -> Dict:
    """获取计划执行状态"""
    plan = self.planning_tool.get_plan(plan_id)
    
    total = len(plan["steps"])
    completed = sum(1 for s in plan["step_statuses"] if s == "completed")
    blocked = sum(1 for s in plan["step_statuses"] if s == "blocked")
    
    return {
        "total": total,
        "completed": completed,
        "blocked": blocked,
        "progress": completed / total * 100,
    }
```

---

## 📚 八、参考资料

- **OpenManus 源码**: https://github.com/FoundationAgents/OpenManus
- **完整研究报告**: `/Users/eddy/.openclaw/workspace/knowledge-base/github/openmanus/final-report.md`
- **设计模式详解**: `/Users/eddy/.openclaw/workspace/knowledge-base/github/openmanus/07-design-patterns.md`
- **架构分析**: `/Users/eddy/.openclaw/workspace/knowledge-base/github/openmanus/05-architecture-analysis.md`

---

## ✅ 九、检查清单

在开始实现前，确认以下要点：

- [ ] 理解 PlanningFlow 的执行循环
- [ ] 掌握策略模式的 Agent 路由
- [ ] 熟悉 4 种步骤状态的定义和转换
- [ ] 了解 ToolCollection 的管理机制
- [ ] 准备好 LLM 接口（OpenAI/Claude/智谱等）
- [ ] 设计好工具接口（Browser/Code/Analysis 等）
- [ ] 规划好错误处理和日志记录
- [ ] 考虑是否需要 Docker 沙箱隔离

---

**祝你复刻成功！** 🚀

如有问题，可参考完整研究报告或继续提问。
