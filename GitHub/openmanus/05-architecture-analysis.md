# 阶段 5：架构层次覆盖分析

**执行日期**: 2026-03-04  
**分析范围**: 5 层架构层次

---

## 🏗️ 架构层次总览

```
┌─────────────────────────────────────────┐
│         表现层 (Presentation)           │
│  CLI / API / MCP Server / A2A Protocol  │
├─────────────────────────────────────────┤
│          服务层 (Service)               │
│  Flow 编排 / Agent 协同 / 任务调度       │
├─────────────────────────────────────────┤
│          核心层 (Core)                  │
│  Agent 核心 / Tool 执行 / LLM 封装        │
├─────────────────────────────────────────┤
│         后台层 (Background)             │
│  沙箱执行 / Docker 容器 / 异步任务        │
├─────────────────────────────────────────┤
│         数据层 (Data)                   │
│  内存存储 / 配置文件 / 消息历史          │
└─────────────────────────────────────────┘
```

---

## 1️⃣ 表现层 (Presentation Layer)

**职责**: 用户接口、API、外部交互

### 组件清单

| 组件 | 文件 | 职责 | 代码行 |
|------|------|------|--------|
| **CLI 入口** | `main.py` | 单 Agent 模式 | ~30 行 |
| **Flow 入口** | `run_flow.py` | 多 Agent Flow 模式 | ~50 行 |
| **MCP 入口** | `run_mcp.py` | MCP 客户端模式 | ~80 行 |
| **MCP Server** | `run_mcp_server.py` | 独立 MCP 服务 | ~30 行 |
| **沙箱入口** | `sandbox_main.py` | 沙箱 Agent 入口 | ~30 行 |
| **A2A API** | `protocol/a2a/app/main.py` | Agent-to-Agent 协议 | 待确认 |

### 关键代码

```python
# main.py:13 - CLI 入口
async def main():
    parser = argparse.ArgumentParser(description="Run Manus agent with a prompt")
    parser.add_argument("--prompt", type=str, required=False)
    args = parser.parse_args()
    
    agent = await Manus.create()
    prompt = args.prompt if args.prompt else input("Enter your prompt: ")
    await agent.run(prompt)

# run_flow.py:17 - Flow 入口
async def run_flow():
    agents = {"manus": Manus()}
    if config.run_flow_config.use_data_analysis_agent:
        agents["data_analysis"] = DataAnalysis()
    
    flow = FlowFactory.create_flow(flow_type=FlowType.PLANNING, agents=agents)
    result = await asyncio.wait_for(flow.execute(prompt), timeout=3600)
```

### 架构特征

- ✅ **多模式启动**: 支持单 Agent、Flow、MCP 三种模式
- ✅ **命令行接口**: argparse 处理参数
- ✅ **异步入口**: asyncio.run() 启动异步事件循环
- ✅ **超时保护**: run_flow.py 设置 1 小时超时
- ⚠️ **Web API**: 仅 A2A 协议，缺少 REST API

**完整性**: ✅ 完备（4/5）

---

## 2️⃣ 服务层 (Service Layer)

**职责**: 业务逻辑编排、工作流管理、任务调度

### 组件清单

| 组件 | 文件 | 职责 | 代码行 |
|------|------|------|--------|
| **Flow 工厂** | `flow/flow_factory.py` | Flow 创建 | ~30 行 |
| **PlanningFlow** | `flow/planning.py` | 计划编排核心 | ~450 行 |
| **Flow 基类** | `flow/base.py` | Flow 抽象基类 | ~50 行 |

### 核心流程

```python
# app/flow/planning.py:89 - 执行流程
async def execute(self, input_text: str) -> str:
    # 1. 创建初始计划
    await self._create_initial_plan(input_text)
    
    # 2. 循环执行步骤
    while True:
        # 2.1 获取当前步骤
        self.current_step_index, step_info = await self._get_current_step_info()
        if self.current_step_index is None:
            break
        
        # 2.2 选择合适的 Agent
        executor = self.get_executor(step_type)
        
        # 2.3 执行步骤
        step_result = await self._execute_step(executor, step_info)
        
        # 2.4 检查是否终止
        if executor.state == AgentState.FINISHED:
            break
    
    # 3. 最终总结
    return await self._finalize_plan()
```

### 关键机制

#### 1. Agent 路由
```python
# app/flow/planning.py:67
def get_executor(self, step_type: Optional[str] = None) -> BaseAgent:
    # 根据步骤类型选择 Agent
    if step_type and step_type in self.agents:
        return self.agents[step_type]
    
    # 默认返回第一个 executor
    for key in self.executor_keys:
        if key in self.agents:
            return self.agents[key]
    
    return self.primary_agent
```

#### 2. 步骤状态管理
```python
# app/flow/planning.py:23
class PlanStepStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
```

### 架构特征

- ✅ **工厂模式**: FlowFactory 统一创建 Flow
- ✅ **策略模式**: 根据步骤类型选择 Agent
- ✅ **状态模式**: PlanStepStatus 管理步骤状态
- ✅ **上下文注入**: 将计划状态注入 Agent prompt
- ⚠️ **并行执行**: 仅支持顺序执行，缺少并行

**完整性**: ✅ 完备（5/5）

---

## 3️⃣ 核心层 (Core Layer)

**职责**: 核心业务逻辑、Agent 实现、工具执行

### 组件清单

| 组件 | 文件 | 职责 | 代码行 |
|------|------|------|--------|
| **Agent 基类** | `agent/base.py` | 状态/内存管理 | ~180 行 |
| **ReActAgent** | `agent/react.py` | ReAct 模式 | ~30 行 |
| **ToolCallAgent** | `agent/toolcall.py` | 工具调用 | ~280 行 |
| **Manus** | `agent/manus.py` | 通用 Agent | ~180 行 |
| **BrowserAgent** | `agent/browser.py` | 浏览器 Agent | ~150 行 |
| **DataAnalysis** | `agent/data_analysis.py` | 数据分析 Agent | ~50 行 |
| **LLM 封装** | `llm.py` | LLM API 封装 | ~700 行 |
| **ToolCollection** | `tool/tool_collection.py` | 工具管理 | ~80 行 |
| **PlanningTool** | `tool/planning.py` | 规划工具 | ~350 行 |

### Agent 层次结构

```
BaseAgent (状态管理，内存管理，step 循环)
  ↓
ReActAgent (ReAct 模式：Think-Act-Observe)
  ↓
ToolCallAgent (工具调用：think() → act() → execute_tool())
  ↓
├── Manus (通用 Agent + MCP 集成)
├── BrowserAgent (浏览器控制 + 截图)
├── DataAnalysis (数据分析 + 可视化)
├── SandboxAgent (沙箱代码执行)
├── MCPAgent (MCP 客户端)
└── SWEAgent (软件工程)
```

### 核心循环

```python
# app/agent/base.py:107
async def run(self, request: Optional[str] = None) -> str:
    if request:
        self.update_memory("user", request)
    
    results = []
    async with self.state_context(AgentState.RUNNING):
        while self.current_step < self.max_steps and self.state != AgentState.FINISHED:
            self.current_step += 1
            step_result = await self.step()
            
            if self.is_stuck():
                self.handle_stuck_state()
            
            results.append(f"Step {self.current_step}: {step_result}")
    
    return "\n".join(results)
```

### 架构特征

- ✅ **层次化设计**: BaseAgent → ReActAgent → ToolCallAgent → 具体 Agent
- ✅ **状态管理**: AgentState (IDLE/RUNNING/FINISHED/ERROR)
- ✅ **内存管理**: Memory 存储消息历史
- ✅ **工具抽象**: ToolCollection 统一管理
- ✅ **Stuck 检测**: 检测重复响应并调整策略

**完整性**: ✅ 完备（5/5）

---

## 4️⃣ 后台层 (Background Layer)

**职责**: 异步任务、沙箱执行、资源隔离

### 组件清单

| 组件 | 文件 | 职责 | 代码行 |
|------|------|------|--------|
| **DockerSandbox** | `sandbox/core/sandbox.py` | 沙箱容器管理 | ~450 行 |
| **AsyncDockerizedTerminal** | `sandbox/core/terminal.py` | 容器终端 | ~150 行 |
| **SandboxClient** | `sandbox/client.py` | 沙箱客户端 | ~100 行 |
| **异常定义** | `sandbox/core/exceptions.py` | 沙箱异常 | ~30 行 |

### 沙箱生命周期

```python
# app/sandbox/core/sandbox.py:50
async def create(self) -> "DockerSandbox":
    # 1. 准备容器配置
    host_config = self.client.api.create_host_config(
        mem_limit=self.config.memory_limit,
        cpu_quota=int(100000 * self.config.cpu_limit),
        network_mode="none" if not self.config.network_enabled else "bridge",
        binds=self._prepare_volume_bindings(),
    )
    
    # 2. 创建容器
    container = await asyncio.to_thread(
        self.client.api.create_container,
        image=self.config.image,
        command="tail -f /dev/null",
        host_config=host_config,
        name=f"sandbox_{uuid.uuid4().hex[:8]}",
        tty=True,
        detach=True,
    )
    
    # 3. 启动容器
    await asyncio.to_thread(self.container.start)
    
    # 4. 初始化终端
    self.terminal = AsyncDockerizedTerminal(container["Id"], ...)
    await self.terminal.init()
```

### 资源隔离

```python
# 资源限制
mem_limit=self.config.memory_limit  # 内存限制
cpu_quota=int(100000 * self.config.cpu_limit)  # CPU 限制
network_mode="none"  # 网络隔离

# 文件隔离
work_dir = self._ensure_host_dir(self.config.work_dir)
bindings[work_dir] = {"bind": self.config.work_dir, "mode": "rw"}
```

### 架构特征

- ✅ **Docker 隔离**: 容器级资源隔离
- ✅ **资源限制**: 内存/CPU/网络限制
- ✅ **异步执行**: asyncio 非阻塞执行
- ✅ **超时控制**: 命令执行超时保护
- ✅ **安全清理**: 容器自动删除

**完整性**: ✅ 完备（5/5）

---

## 5️⃣ 数据层 (Data Layer)

**职责**: 数据存储、配置管理、持久化

### 组件清单

| 组件 | 文件/位置 | 类型 | 生命周期 |
|------|---------|------|---------|
| **计划存储** | `PlanningTool.plans` | 内存 Dict | 会话级 |
| **消息历史** | `Agent.memory.messages` | 内存 List | 会话级 |
| **配置文件** | `config/config.toml` | TOML 文件 | 持久化 |
| **沙箱文件** | Docker 容器 | 文件系统 | 容器生命周期 |
| **工具结果** | `ToolResult` | 对象 | 单次执行 |

### 配置管理

```python
# app/config.py
class Config(BaseModel):
    llm_config: LLMSettings
    sandbox_config: SandboxSettings
    mcp_config: MCPSettings
    run_flow_config: RunFlowSettings
    workspace_root: str = Field(default="./workspace")

# config/config.toml
[llm]
model = "gpt-4o"
base_url = "https://api.openai.com/v1"
api_key = "sk-..."

[runflow]
use_data_analysis_agent = true
```

### 架构特征

- ✅ **配置分离**: config.toml 管理配置
- ✅ **内存存储**: 快速访问（计划、消息）
- ✅ **文件存储**: 沙箱文件系统
- ⚠️ **持久化**: 缺少长期记忆存储
- ⚠️ **数据库**: 无关系型/向量数据库集成

**完整性**: ⚠️ 基础完备（3/5）

---

## 📊 架构层次完整性评分

| 层次 | 完整性 | 评分 | 备注 |
|------|--------|------|------|
| 表现层 | ✅ 完备 | 90/100 | 多模式启动 |
| 服务层 | ✅ 完备 | 95/100 | Flow 编排完善 |
| 核心层 | ✅ 完备 | 95/100 | Agent 层次清晰 |
| 后台层 | ✅ 完备 | 90/100 | 沙箱隔离完善 |
| 数据层 | ⚠️ 基础 | 70/100 | 缺少持久化 |

**总体评分**: **88/100** ⭐⭐⭐⭐

---

## 🔄 跨层调用示例

```
用户输入 (表现层)
  ↓
run_flow.py → FlowFactory (服务层)
  ↓
PlanningFlow.execute() (服务层)
  ↓
PlanningTool.create() (核心层)
  ↓
LLM.ask_tool() (核心层)
  ↓
DockerSandbox.run_command() (后台层)
  ↓
存储计划到 PlanningTool.plans (数据层)
```

---

**完整性**: ✅ 5 层架构已全覆盖  
**下一步**: 阶段 6 - 代码覆盖率验证
