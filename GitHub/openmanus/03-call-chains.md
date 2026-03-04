# 阶段 3：多入口点追踪（GSD 波次执行）

**执行日期**: 2026-03-04  
**追踪方式**: 波次独立追踪

---

## 🌊 波次 1：CLI 入口（main.py）

### 调用链：main.py → Manus → ToolCallAgent → Tool

```
main.py:22
  ↓ asyncio.run(main())
main.py:16
  ↓ agent = await Manus.create()
app/agent/manus.py:42
  ↓ instance = cls(**kwargs)
  ↓ await instance.initialize_mcp_servers()
app/agent/manus.py:54
  ↓ await self.connect_mcp_server(...)
app/agent/manus.py:67
  ↓ await self.mcp_clients.connect_sse(server_url, server_id)
  ↓ self.available_tools.add_tools(*new_tools)
app/tool/tool_collection.py:57
  ↓ self.tools += (tool,)
  ↓ self.tool_map[tool.name] = tool

# 执行阶段
main.py:19
  ↓ await agent.run(prompt)
app/agent/base.py:107
  ↓ async with self.state_context(AgentState.RUNNING):
app/agent/base.py:112
  ↓ step_result = await self.step()
app/agent/toolcall.py:123
  ↓ await self.execute_tool(command)
app/tool/tool_collection.py:27
  ↓ result = await tool(**tool_input)
```

**关键节点**:
1. **初始化**: Manus.create() → 初始化 MCP 服务器连接
2. **执行**: agent.run() → 状态管理 → step() 循环
3. **工具执行**: execute_tool() → ToolCollection.execute() → 具体工具

---

## 🌊 波次 2：Flow 入口（run_flow.py）

### 调用链：run_flow.py → PlanningFlow → Agent → Tool

```
run_flow.py:39
  ↓ asyncio.run(run_flow())
run_flow.py:17
  ↓ flow = FlowFactory.create_flow(
      flow_type=FlowType.PLANNING,
      agents=agents,
    )
app/flow/flow_factory.py:21
  ↓ return PlanningFlow(agents, **kwargs)
app/flow/planning.py:50
  ↓ super().__init__(agents, **data)
  ↓ self.executor_keys = list(self.agents.keys())

# 执行阶段
run_flow.py:27
  ↓ result = await flow.execute(prompt)
app/flow/planning.py:89
  ↓ await self._create_initial_plan(input_text)
app/flow/planning.py:125
  ↓ response = await self.llm.ask_tool(
      messages=[user_message],
      system_msgs=[system_message],
      tools=[self.planning_tool.to_param()],
      tool_choice=ToolChoice.AUTO,
    )
  ↓ result = await self.planning_tool.execute(**args)
app/tool/planning.py:72
  ↓ return self._create_plan(plan_id, title, steps)
app/tool/planning.py:103
  ↓ self.plans[plan_id] = plan
  ↓ self._current_plan_id = plan_id

# 执行循环
app/flow/planning.py:98
  ↓ while True:
      self.current_step_index, step_info = await self._get_current_step_info()
      if self.current_step_index is None:
          break
      executor = self.get_executor(step_type)
      step_result = await self._execute_step(executor, step_info)
app/flow/planning.py:234
  ↓ step_result = await executor.run(step_prompt)
app/agent/base.py:107
  ↓ async with self.state_context(AgentState.RUNNING):
  ↓ step_result = await self.step()
```

**关键节点**:
1. **Flow 创建**: FlowFactory → PlanningFlow → 初始化 Agent 字典
2. **计划创建**: _create_initial_plan() → LLM 调用 PlanningTool → 创建计划
3. **步骤执行**: _get_current_step_info() → get_executor() → _execute_step()
4. **Agent 执行**: executor.run() → step() → 工具执行

---

## 🌊 波次 3：PlanningFlow 内部调用链

### 调用链：PlanningFlow → PlanningTool → Agent → Tool

```
# 步骤调度
app/flow/planning.py:178
  ↓ async def _get_current_step_info(self):
      plan_data = self.planning_tool.plans[self.active_plan_id]
      steps = plan_data.get("steps", [])
      step_statuses = plan_data.get("step_statuses", [])
      
      for i, step in enumerate(steps):
          if status in PlanStepStatus.get_active_statuses():
              # 找到活跃步骤
              type_match = re.search(r"\[([A-Z_]+)\]", step)
              if type_match:
                  step_info["type"] = type_match.group(1).lower()
              
              # 标记为 in_progress
              await self.planning_tool.execute(
                  command="mark_step",
                  plan_id=self.active_plan_id,
                  step_index=i,
                  step_status=PlanStepStatus.IN_PROGRESS.value,
              )
              return i, step_info

# Agent 路由
app/flow/planning.py:67
  ↓ def get_executor(self, step_type: Optional[str] = None) -> BaseAgent:
      if step_type and step_type in self.agents:
          return self.agents[step_type]
      
      for key in self.executor_keys:
          if key in self.agents:
              return self.agents[key]
      
      return self.primary_agent

# 步骤执行
app/flow/planning.py:218
  ↓ async def _execute_step(self, executor: BaseAgent, step_info: dict) -> str:
      plan_status = await self._get_plan_text()
      step_prompt = f"""
        CURRENT PLAN STATUS:
        {plan_status}
        
        YOUR CURRENT TASK:
        You are now working on step {self.current_step_index}: "{step_text}"
      """
      
      step_result = await executor.run(step_prompt)
      await self._mark_step_completed()
      return step_result
```

**关键节点**:
1. **步骤识别**: 正则匹配 `[TYPE]` 标签识别步骤类型
2. **状态更新**: mark_step 命令更新步骤状态
3. **Agent 选择**: 根据步骤类型匹配 Agent（如 [BROWSER] → BrowserAgent）
4. **上下文注入**: 将当前计划状态注入到 Agent prompt

---

## 🌊 波次 4：沙箱执行调用链

### 调用链：SandboxAgent → DockerSandbox → Terminal

```
app/agent/sandbox_agent.py:45
  ↓ async def step(self) -> str:
      # 执行代码到沙箱
      result = await SANDBOX_CLIENT.run_command(cmd)
      
app/sandbox/client.py:XX
  ↓ async def run_command(self, cmd: str):
      return await self.sandbox.run_command(cmd, timeout)
      
app/sandbox/core/sandbox.py:124
  ↓ async def run_command(self, cmd: str, timeout: Optional[int] = None) -> str:
      if not self.terminal:
          raise RuntimeError("Sandbox not initialized")
      
      return await self.terminal.run_command(cmd, timeout=timeout)
      
app/sandbox/core/terminal.py:XX
  ↓ async def run_command(self, cmd: str, timeout: int):
      # 通过 Docker Exec API 执行
      exec_instance = await asyncio.to_thread(
          self.container.exec_run, cmd, demux=True
      )
      output = await asyncio.wait_for(
          self._read_output(exec_instance), timeout
      )
      return output
```

**关键节点**:
1. **沙箱初始化**: DockerSandbox.create() → 创建容器 → 初始化终端
2. **命令执行**: run_command() → Docker Exec API → 读取输出
3. **超时控制**: asyncio.wait_for() 实现超时保护
4. **资源清理**: cleanup() → 停止容器 → 删除容器

---

## 📊 调用链统计

| 波次 | 入口点 | 调用深度 | 关键模块 |
|------|--------|---------|----------|
| 波次 1 | main.py | 5 层 | Manus → ToolCallAgent → ToolCollection |
| 波次 2 | run_flow.py | 7 层 | PlanningFlow → PlanningTool → Agent |
| 波次 3 | PlanningFlow 内部 | 6 层 | 步骤调度 → Agent 路由 → 执行 |
| 波次 4 | Sandbox | 5 层 | DockerSandbox → Terminal → Docker API |

---

## 🔍 关键发现

### 1. TOC 核心流程

```
用户输入 → PlanningFlow.create_initial_plan()
  ↓
LLM 调用 PlanningTool.create() → 创建计划
  ↓
循环：_get_current_step_info() → 识别当前步骤
  ↓
get_executor() → 根据步骤类型选择 Agent
  ↓
_execute_step() → Agent.run(prompt)
  ↓
Agent.step() → 工具执行 → 结果返回
  ↓
_mark_step_completed() → 更新步骤状态
  ↓
循环直到所有步骤完成
  ↓
_finalize_plan() → 生成总结
```

### 2. Agent 层次结构

```
BaseAgent (状态管理，内存管理)
  ↓
ReActAgent (ReAct 模式)
  ↓
ToolCallAgent (工具调用)
  ↓
├── Manus (通用 Agent + MCP)
├── BrowserAgent (浏览器控制)
├── DataAnalysis (数据分析)
├── SandboxAgent (沙箱执行)
├── MCPAgent (MCP 客户端)
└── SWEAgent (软件工程)
```

### 3. 工具注册机制

```
ToolCollection.__init__(*tools)
  ↓
self.tools = tools
self.tool_map = {tool.name: tool for tool in tools}
  ↓
add_tool(tool) → 动态添加工具
  ↓
execute(name, tool_input) → 通过 tool_map 查找并执行
```

---

**完整性**: ✅ 4 个波次调用链已追踪  
**下一步**: 阶段 4 - 知识链路完整性检查
