# 标签核心维度定义

**版本**: v5.0
**创建日期**: 2026-03-04
**用途**: 定义应用场景标签的核心模块和分析重点，针对产品形态标签定义差异化分析维度
**核心目标**: 帮助研究者深入源码层面理解项目实现，提取可复用的设计模式和代码技巧

---

## 📐 核心模块与分析重点矩阵

### 设计理念

1. **应用场景标签** → 定义"核心模块"（分析什么）
2. **产品形态标签** → 定义"分析重点"（如何分析、分析多深）

### 产品形态分析重点差异

| 产品形态 | 分析重点 | 关键问题 |
|---------|---------|---------|
| **Platform** | UI/UX、用户管理、部署方案、权限控制 | 业务人员能否无需编码使用？部署复杂度？ |
| **Framework** | API 设计、扩展点、抽象层质量 | 开发者能否灵活扩展？抽象是否合理？ |
| **SDK/Library** | API 简洁性、文档质量、包大小 | 调用是否直观？文档是否清晰？ |
| **CLI** | 命令设计、交互体验、输出格式 | 命令是否易用？输出是否友好？ |
| **Service** | API 设计、SLA、计费模式 | 接口是否稳定？成本是否合理？ |

### 分析深度矩阵

| 应用场景 \ 产品形态 | Platform | Framework | SDK/Library | CLI | Service |
|-------------------|----------|-----------|-------------|-----|---------|
| **RAG** | UI 导入流程、权限管理、部署方案 | 数据连接器 API、扩展点 | 导入 API、配置选项 | 命令行导入 | API 端点 |
| **Agent** | 任务配置界面、可视化工具 | Agent Loop 扩展、工具注册 | Agent 初始化、工具调用 | 命令行任务 | API 任务提交 |
| **Memory** | 记忆管理界面、可视化 | 记忆存储后端扩展 | 记忆存取 API | 记忆命令 | 记忆 API |
| **Workflow** | 可视化编辑器、节点库 | 自定义节点开发 | 工作流定义 DSL | 工作流命令 | 工作流 API |
| **Data** | 数据预览、转换配置 | 自定义转换器开发 | 转换函数 API | 数据处理命令 | 数据 API |
| **Voice** | 录音/播放界面、配置 | 模型后端替换 | STT/TTS API | 语音命令 | 语音 API |
| **Image** | 图像预览、编辑工具 | 滤波器/模型扩展 | 图像处理 API | 图像命令 | 图像 API |
| **Code** | IDE 集成、代码预览 | 分析器/生成器扩展 | 代码分析 API | 代码命令 | 代码 API |
| **Search** | 搜索界面、结果展示 | 索引后端扩展 | 搜索 API | 搜索命令 | 搜索 API |

---

## 📋 源码实现分析通用框架

### 代码分析四层模型

对每个核心模块的分析应涵盖以下四个层次：

| 层级 | 分析内容 | 关键问题 | 输出格式 |
|------|---------|---------|---------|
| **1. 接口层** | 类/函数签名、参数、返回值 | API 设计是否直观？ | 代码片段 + 说明 |
| **2. 数据结构层** | 核心数据模型、状态表示 | 如何组织数据？ | class 定义 + 字段说明 |
| **3. 算法层** | 核心逻辑、控制流 | 如何解决问题？ | 伪代码/流程图 + 关键代码 |
| **4. 集成层** | 模块间调用、依赖关系 | 如何与其他模块协作？ | 调用序列图/依赖图 |

### 源码分析检查清单

对于每个核心模块，研究时应回答：

1. **文件定位**
   - [ ] 核心实现在哪个文件？
   - [ ] 代码量大约多少行？
   - [ ] 有哪些核心类和函数？

2. **数据结构**
   - [ ] 核心状态如何表示？
   - [ ] 使用了什么数据结构？
   - [ ] 状态如何持久化？

3. **核心算法**
   - [ ] 主要函数执行流程是什么？
   - [ ] 有关键的算法优化吗？
   - [ ] 错误如何处理？

4. **设计模式**
   - [ ] 使用了什么设计模式？
   - [ ] 有什么值得学习的设计技巧？
   - [ ] 有什么可以复用的代码模式？

5. **依赖关系**
   - [ ] 依赖哪些外部库？
   - [ ] 与其他内部模块如何交互？
   - [ ] 扩展点在哪里？

---

## 📊 各应用场景核心模块定义

### RAG（检索增强生成）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 数据导入模块** | 读取多种格式文档 | `loaders/`, `readers/`, `ingestion/` |
| **2. Chunking 模块** | 文本分块策略 | `chunking/`, `splitters/`, `text_splitter.py` |
| **3. 向量化模块** | Embedding 调用和管理 | `embeddings/`, `vectorization/` |
| **4. 存储模块** | 向量存储和索引 | `stores/`, `indexes/`, `vector_store.py` |
| **5. 检索模块** | 相似度检索、混合检索 | `retrievers/`, `search/`, `query_engine.py` |
| **6. 后处理模块** | Rerank、上下文压缩 | `postprocessing/`, `rerankers/`, `compressors/` |

### Agent（智能体）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. Agent Loop 模块** | 感知→思考→执行的循环 | `agent/loop.py`, `executor.py`, `runner.py` |
| **2. 工具/技能模块** | 工具注册、调用、管理 | `tools/`, `skills/`, `actions/` |
| **3. 任务编排模块** | 任务定义、分解、执行控制 | `orchestration/`, `tasks/`, `planner.py` |
| **4. 记忆模块** | 短期/长期记忆存储和检索 | `memory/`, `context/`, `history/` |
| **5. 状态管理模块** | 执行状态持久化和恢复 | `state/`, `checkpoint/`, `persistence.py` |
| **6. 多 Agent 协作模块** | Agent 间通信和任务分配 | `multi_agent/`, `collaboration/`, `swarm/` |
| **7. 反思模块** | 执行评估、错误分析、自我纠正 | `reflection/`, `evaluator/`, `critic.py` |

### Memory（记忆系统）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 记忆模型模块** | 定义记忆类型和结构 | `models/`, `memory_types/`, `schema.py` |
| **2. 存储引擎模块** | 底层存储实现 | `storage/`, `backends/`, `vector_store.py`, `graph_store.py` |
| **3. 索引模块** | 记忆索引构建和查询优化 | `indexes/`, `embeddings/`, `indexer.py` |
| **4. 检索模块** | 记忆检索和排序 | `retrievers/`, `search/`, `query.py` |
| **5. 优化模块** | 遗忘、反思、巩固 | `optimizers/`, `consolidation/`, `forgetting.py` |

### Workflow（工作流编排）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 工作流定义模块** | DSL 解析、可视化编辑器 | `workflow/`, `dsl/`, `parser.py`, `editor/` |
| **2. 节点库模块** | 内置节点类型和自定义节点 | `nodes/`, `operators/`, `tasks/` |
| **3. 执行引擎模块** | 工作流调度和执行 | `engine/`, `executor/`, `scheduler/`, `runner.py` |
| **4. 状态管理模块** | 执行状态跟踪和持久化 | `state/`, `context/`, `checkpoint.py` |
| **5. 错误处理模块** | 重试、回滚、降级策略 | `errors/`, `retry/`, `recovery/` |

### Data（数据处理）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 数据读取模块** | 读取多种格式数据 | `readers/`, `loaders/`, `parsers/` |
| **2. 数据转换模块** | 转换、过滤、映射算子 | `transformers/`, `operators/`, `transforms/` |
| **3. 数据管道模块** | 链式调用和编排 | `pipelines/`, `chains/`, `flows/` |
| **4. 数据质量模块** | 校验、清洗、异常检测 | `validation/`, `cleaning/`, `quality/` |
| **5. 数据输出模块** | 格式化输出和导出 | `writers/`, `exporters/`, `sinks/` |

### Voice（语音处理）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 音频输入模块** | 音频文件读取、流式输入 | `audio_io/`, `readers/`, `streaming/` |
| **2. STT 模块** | 语音识别引擎 | `stt/`, `asr/`, `transcribers/` |
| **3. TTS 模块** | 语音合成引擎 | `tts/`, `synthesizers/`, `speakers/` |
| **4. 音频处理模块** | 降噪、变声、格式转换 | `processing/`, `filters/`, `effects/` |
| **5. 模型管理模块** | 模型加载和切换 | `models/`, `backends/`, `inference/` |

### Image（图像处理）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 图像输入模块** | 图像读取、格式转换 | `io/`, `loaders/`, `formats/` |
| **2. 图像理解模块** | OCR、检测、描述生成 | `understanding/`, `ocr/`, `detection/`, `captioning/` |
| **3. 图像生成模块** | 文生图、图生图 | `generation/`, `diffusion/`, `gan/` |
| **4. 图像编辑模块** | 裁剪、滤镜、修复 | `editing/`, `filters/`, `inpainting/` |
| **5. 模型管理模块** | 模型加载和推理 | `models/`, `inference/`, `backends/` |

### Code（代码生成/分析）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 代码解析模块** | AST 解析、语法树构建 | `parser/`, `ast/`, `syntax/` |
| **2. 代码理解模块** | 语义分析、类型推断 | `analysis/`, `semantics/`, `type_inference/` |
| **3. 代码生成模块** | 补全、重构、测试生成 | `generation/`, `completion/`, `refactoring/` |
| **4. 代码分析模块** | 复杂度、审查、漏洞检测 | `metrics/`, `linting/`, `security/` |
| **5. IDE 集成模块** | LSP、编辑器插件 | `lsp/`, `plugins/`, `extensions/` |

### Search（搜索/推荐）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 索引构建模块** | 倒排索引、向量索引构建 | `indexing/`, `indexers/`, `build_index.py` |
| **2. 索引存储模块** | 索引持久化和更新 | `storage/`, `persistence/`, `index_store.py` |
| **3. 搜索模块** | 关键字搜索、向量搜索 | `search/`, `retrievers/`, `queries/` |
| **4. 排序模块** | 相关性排序、个性化排序 | `ranking/`, `scoring/`, `rerankers/` |
| **5. 推荐模块** | 协同过滤、内容推荐 | `recommendation/`, `recommenders/`, `collaborative/` |

---

## 📌 RAG（检索增强生成）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 数据导入模块** | 读取多种格式文档 | `loaders/`, `readers/`, `ingestion/` |
| **2. Chunking 模块** | 文本分块策略 | `chunking/`, `splitters/`, `text_splitter.py` |
| **3. 向量化模块** | Embedding 调用和管理 | `embeddings/`, `vectorization/` |
| **4. 存储模块** | 向量存储和索引 | `stores/`, `indexes/`, `vector_store.py` |
| **5. 检索模块** | 相似度检索、混合检索 | `retrievers/`, `search/`, `query_engine.py` |
| **6. 后处理模块** | Rerank、上下文压缩 | `postprocessing/`, `rerankers/`, `compressors/` |

### 不同产品形态的分析重点

#### RAG + Platform（如 Dify、AnythingLLM）
| 分析维度 | 关键问题 |
|---------|---------|
| **数据导入** | 是否有 UI 上传界面？支持拖拽？批量导入？ |
| **知识库管理** | 是否支持多知识库？权限控制？ |
| **Chunking 配置** | 是否有可视化配置界面？支持预览分块结果？ |
| **部署方案** | Docker/一键部署？资源需求？ |
| **用户管理** | 多用户？角色权限？ |

#### RAG + Framework（如 LlamaIndex、Haystack）
| 分析维度 | 关键问题 |
|---------|---------|
| **数据连接器** | 是否提供统一的数据源抽象？扩展新数据源是否简单？ |
| **节点抽象** | Document/Node 设计是否合理？元数据传递是否流畅？ |
| **检索器组合** | 是否支持 Retriever 组合（AND/OR/加权）？ |
| **查询引擎** | QueryEngine 是否可以灵活组合组件？ |
| **扩展点** | 自定义 Loader/Splitter/Retriever 是否简单？ |

#### RAG + SDK/Library
| 分析维度 | 关键问题 |
|---------|---------|
| **API 简洁性** | 几行代码可以完成导入→检索？ |
| **配置选项** | chunk_size、top_k 等参数是否可配置？ |
| **默认值合理性** | 默认配置是否适合大多数场景？ |
| **错误处理** | 向量库连接失败如何处理？ |

### 核心维度（6 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 数据源支持** | 15% | 支持的文档格式和数据源 |
| **2. Chunking 策略** | 20% | 文本分块方法和配置 |
| **3. 向量库支持** | 15% | 支持的向量数据库 |
| **4. 检索方式** | 20% | 检索算法和策略 |
| **5. 查询优化** | 15% | 查询重写和增强 |
| **6. 后处理** | 15% | 检索结果优化和合成 |

---

## 🤖 Agent（智能体）

### 核心能力定义（参考 deepagents）

根据 deepagents 的定义，一个完整的 Agent 系统应具备以下核心能力：

| 能力 | 说明 | 判断标准 |
|------|------|---------|
| **1. 规划能力 (Planning)** | 任务分解、子目标生成、执行顺序规划 | 支持任务分解/步骤规划 |
| **2. 工具使用 (Tool Use)** | 调用外部工具、API、代码执行 | 有工具注册和调用机制 |
| **3. 记忆能力 (Memory)** | 短期上下文 + 长期知识持久化 | 有会话历史和长期记忆 |
| **4. 反思能力 (Reflection)** | 自我纠错、结果评估、迭代改进 | 有执行评估和重试机制 |
| **5. 多步执行 (Multi-step)** | 循环执行、状态跟踪、断点恢复 | 有 Agent Loop 和状态管理 |

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 | deepagents 对应 |
|------|------|--------------|----------------|
| **1. Agent Loop 模块** | 感知→思考→执行的循环 | `agent/loop.py`, `executor.py`, `runner.py` | Agent Loop |
| **2. 工具/技能模块** | 工具注册、调用、管理 | `tools/`, `skills/`, `actions/` | Tool Integration |
| **3. 任务编排模块** | 任务定义、分解、执行控制 | `orchestration/`, `tasks/`, `planner.py` | Task Planning |
| **4. 记忆模块** | 短期/长期记忆存储和检索 | `memory/`, `context/`, `history/` | Memory |
| **5. 状态管理模块** | 执行状态持久化和恢复 | `state/`, `checkpoint/`, `persistence.py` | State Management |
| **6. 多 Agent 协作模块** | Agent 间通信和任务分配 | `multi_agent/`, `collaboration/`, `swarm/` | Multi-Agent |
| **7. 反思模块** | 执行评估、错误分析、自我纠正 | `reflection/`, `evaluator/`, `critic.py` | Reflection |

### 源码实现分析重点

#### 1. Agent Loop 模块分析

**核心问题**：
- Agent 如何组织"感知 - 思考 - 行动"循环？
- 如何处理流式响应？
- 如何判断循环终止条件？

**关键代码模式**：
```python
# 典型的 Agent Loop 结构
class AgentLoop:
    def run(self, task: str, max_iterations: int = 30) -> AgentState:
        state = AgentState(task=task)
        for iteration in range(max_iterations):
            # 1. 感知：获取当前状态
            context = self.build_context(state)

            # 2. 思考：LLM 推理
            response = self.llm.chat(context)

            # 3. 行动：解析并执行
            action = self.parse_response(response)
            if action.type == "DONE":
                return state
            result = self.execute(action)
            state.update(result)

            # 4. 反思：检查是否需要调整
            if self.should_reflect(state):
                state = self.reflect(state)
        return state
```

**需要提取的实现细节**：
- [ ] Loop 的主循环结构（while/for，最大迭代次数）
- [ ] 上下文构建方式（历史消息如何组织）
- [ ] 响应解析逻辑（如何识别工具调用 vs 直接回答）
- [ ] 终止条件判断（任务完成/最大迭代/错误）
- [ ] 异常处理机制

#### 2. 上下文管理分析

**核心问题**：
- 如何管理对话历史？
- 如何压缩过长的上下文？
- 如何组织和结构化系统提示？

**关键实现点**：
```python
# 上下文管理典型实现
class ContextManager:
    def __init__(self, max_tokens: int = 128000):
        self.max_tokens = max_tokens
        self.history = []

    def add_message(self, role: str, content: str):
        self.history.append({"role": role, "content": content})
        self._trim_if_needed()

    def _trim_if_needed(self):
        # 常见策略：
        # 1. 移除最早的消息
        # 2. 摘要压缩
        # 3. 滑动窗口
        pass
```

**需要提取的实现细节**：
- [ ] 消息存储结构（列表/队列/数据库）
- [ ] Token 计数方式（估算/精确计算）
- [ ] 上下文压缩策略（摘要/移除/滑动窗口）
- [ ] 系统提示的组织方式

#### 3. 记忆模块分析

**核心问题**：
- 短期记忆和长期记忆如何组织？
- 记忆如何检索和更新？
- 使用什么存储后端？

**关键实现点**：
```python
# 记忆系统典型实现
class MemorySystem:
    def __init__(self, vector_store: VectorStore):
        self.short_term = []  # 最近 N 条对话
        self.long_term = vector_store
        self.working = {}  # 工作记忆

    async def add(self, content: str, metadata: Dict):
        embedding = await self.embed(content)
        self.long_term.add(embedding, content, metadata)

    async def retrieve(self, query: str, top_k: int = 5) -> List[Memory]:
        embedding = await self.embed(query)
        return self.long_term.search(embedding, top_k)
```

**需要提取的实现细节**：
- [ ] 记忆模型定义（字段、类型）
- [ ] 存储后端（向量库/图数据库/关系型）
- [ ] 检索策略（相似度搜索/关键词搜索）
- [ ] 记忆更新机制（覆盖/追加/合并）

#### 4. 工具调用分析

**核心问题**：
- 如何定义和注册工具？
- 如何解析 LLM 的工具调用请求？
- 如何处理工具执行结果？

**关键实现点**：
```python
# 工具系统典型实现
class ToolRegistry:
    def __init__(self):
        self.tools: Dict[str, Tool] = {}

    def register(self, tool: Tool):
        self.tools[tool.name] = tool

    def get_schema(self) -> List[Dict]:
        # 生成 OpenAI 兼容的 function calling schema
        return [tool.to_schema() for tool in self.tools.values()]

    async def execute(self, name: str, args: Dict) -> Any:
        tool = self.tools[name]
        return await tool.run(**args)
```

**需要提取的实现细节**：
- [ ] 工具定义格式（Pydantic/dataclass/字典）
- [ ] Schema 生成方式（用于 LLM 理解）
- [ ] 参数验证机制
- [ ] 工具执行和结果返回
- [ ] 错误处理和重试

#### 5. MCP/Skills 集成分析

**核心问题**：
- 如何集成 MCP (Model Context Protocol) 服务器？
- 如何定义 Skills 接口？
- 如何实现工具的热插拔？

**关键实现点**：
```python
# MCP 集成典型实现
class MCPIntegration:
    def __init__(self):
        self.mcp_clients: List[MCPClient] = []

    async def connect(self, server_config: Dict):
        client = MCPClient(server_config)
        await client.initialize()
        self.mcp_clients.append(client)

    def list_tools(self) -> List[Tool]:
        tools = []
        for client in self.mcp_clients:
            tools.extend(client.list_tools())
        return tools
```


### 不同产品形态的分析重点

#### Agent + Platform（如 OpenHands、AutoGPT）
| 分析维度 | 关键问题 |
|---------|---------|
| **任务配置** | 是否有 UI 配置任务？支持可视化监控？ |
| **工具市场** | 是否有工具商店？一键安装？ |
| **执行监控** | 是否实时显示执行步骤？支持中断/修改？ |
| **沙箱环境** | 代码执行是否隔离？安全性如何？ |

#### Agent + Framework（如 LangGraph、AutoGen）
| 分析维度 | 关键问题 |
|---------|---------|
| **状态抽象** | State 设计是否合理？类型安全？ |
| **图定义** | 如何定义 Agent 执行图？声明式/命令式？ |
| **条件分支** | 如何定义条件路由？动态决策？ |
| **自定义 Agent** | 创建新 Agent 角色是否简单？ |

#### Agent + SDK/Library（如 nanobot）
| 分析维度 | 关键问题 |
|---------|---------|
| **初始化简洁性** | 几行代码启动 Agent？ |
| **工具注册** | 如何添加工具？装饰器/注册表？ |
| **流式支持** | 是否支持流式输出？ |
| **Bridge 设计** | 多平台适配是否统一？ |
| **渠道支持** | 支持多少种消息渠道（飞书/钉钉/Telegram 等）？ |

### 核心维度（7 个）⭐

| 维度 | 权重 | 说明 | deepagents 对齐 |
|------|------|------|----------------|
| **1. 规划能力** | 20% | 任务分解、子目标生成、执行顺序 | Planning |
| **2. 工具使用** | 20% | 工具注册、调用、参数传递 | Tool Use |
| **3. 记忆系统** | 15% | 短期上下文 + 长期记忆 | Memory |
| **4. 反思能力** | 15% | 自我纠错、结果评估、迭代改进 | Reflection |
| **5. 多步执行** | 15% | 循环执行、状态跟踪、断点恢复 | Multi-step |
| **6. 代码编排** | 10% | 核心架构和代码质量 | - |
| **7. 多 Agent 协作** | 5% | Agent 间通信和任务分配 | Multi-Agent |

### 评估标准

**1. 规划能力**:
- 任务分解：自动分解为子任务/手动定义/混合
- 任务依赖：DAG/状态机/自由编排
- 执行控制：顺序/并行/条件/循环
- 评分：自动化程度越高 + 编排越灵活分越高

**2. 工具使用**:
- 工具数量：内置工具数量
- 工具支持：原生工具/MCP/第三方 API
- 动态加载：运行时注册/热加载
- 工具组合：支持工具链/并行调用
- 评分：数量越多 + 生态越丰富分越高

**3. 记忆系统**:
- 记忆类型：短期/长期/工作记忆
- 存储方案：向量库/图数据库/混合
- 检索机制：相似度/图遍历/混合
- 记忆优化：遗忘/反思/consolidation
- 评分：类型越全 + 优化机制越完善分越高

**4. 反思能力**:
- 执行评估：结果质量检查/目标达成度
- 错误分析：错误识别/原因分析
- 自我纠正：重试策略/备选方案
- 迭代改进：从错误中学习
- 评分：有评估 + 纠错 + 学习机制分最高

**5. 多步执行**:
- 迭代次数：最大执行轮次
- 状态跟踪：执行进度可视化
- 断点恢复：支持中断后恢复
- 并发支持：异步/多线程/分布式
- 评分：迭代越深 + 状态管理越完善分越高

**6. 代码编排**:
- Agent Loop：清晰度/可扩展性
- 状态管理：持久化/恢复/版本
- 错误处理：重试/回滚/降级
- 并发支持：异步/多线程/分布式
- 评分：架构越清晰 + 健壮性越高分越高

**7. 多 Agent 协作**:
- 通信机制：消息传递/共享状态
- 角色分配：静态/动态/自组织
- 协作模式：竞争/合作/混合
- 协调机制：中心化/去中心化
- 评分：支持多 Agent+ 协作模式越丰富分越高

## 🧠 Memory（记忆系统）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 记忆模型模块** | 定义记忆类型和结构 | `models/`, `memory_types/`, `schema.py` |
| **2. 存储引擎模块** | 底层存储实现 | `storage/`, `backends/`, `vector_store.py`, `graph_store.py` |
| **3. 索引模块** | 记忆索引构建和查询优化 | `indexes/`, `embeddings/`, `indexer.py` |
| **4. 检索模块** | 记忆检索和排序 | `retrievers/`, `search/`, `query.py` |
| **5. 优化模块** | 遗忘、反思、巩固 | `optimizers/`, `consolidation/`, `forgetting.py` |

### 不同产品形态的分析重点

#### Memory + Platform（如 MemoryBear）
| 分析维度 | 关键问题 |
|---------|---------|
| **记忆管理 UI** | 是否有可视化界面管理记忆？支持搜索/过滤？ |
| **记忆可视化** | 是否展示记忆关联图谱？ |
| **权限控制** | 多用户记忆隔离？共享机制？ |
| **数据导出** | 支持记忆导出/备份？ |

#### Memory + Framework（如 LangChain Memory）
| 分析维度 | 关键问题 |
|---------|---------|
| **存储后端抽象** | 是否支持切换不同存储后端？ |
| **记忆接口** | ConversationMemory 等接口设计？ |
| **与 LLM 集成** | 如何自动注入上下文？ |
| **自定义记忆** | 扩展新记忆类型是否简单？ |

#### Memory + SDK/Library
| 分析维度 | 关键问题 |
|---------|---------|
| **API 简洁性** | 保存/读取记忆的 API 是否直观？ |
| **配置选项** | 相似度阈值、返回数量等可配置？ |
| **异步支持** | 是否支持异步操作？ |

### 核心维度（4 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 记忆模型** | 30% | 记忆类型定义和结构 |
| **2. 存储方案** | 25% | 存储引擎和索引策略 |
| **3. 检索机制** | 25% | 检索方式和排序算法 |
| **4. 优化策略** | 20% | 遗忘/反思/consolidation |

---

## 🔄 Workflow（工作流编排）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 工作流定义模块** | DSL 解析、可视化编辑器 | `workflow/`, `dsl/`, `parser.py`, `editor/` |
| **2. 节点库模块** | 内置节点类型和自定义节点 | `nodes/`, `operators/`, `tasks/` |
| **3. 执行引擎模块** | 工作流调度和执行 | `engine/`, `executor/`, `scheduler/`, `runner.py` |
| **4. 状态管理模块** | 执行状态跟踪和持久化 | `state/`, `context/`, `checkpoint.py` |
| **5. 错误处理模块** | 重试、回滚、降级策略 | `errors/`, `retry/`, `recovery/` |

### 不同产品形态的分析重点

#### Workflow + Platform（如 Dify、n8n）
| 分析维度 | 关键问题 |
|---------|---------|
| **可视化编辑器** | 拖拽式？画布缩放？节点连线交互？ |
| **节点丰富度** | 内置多少种节点？条件/循环/并行？ |
| **调试能力** | 支持单步执行？断点？变量查看？ |
| **版本管理** | 工作流版本控制？回滚？ |

#### Workflow + Framework（如 Prefect、Airflow）
| 分析维度 | 关键问题 |
|---------|---------|
| **DSL 设计** | YAML/Python/JSON？可读性？ |
| **自定义节点** | 开发新节点是否简单？ |
| **依赖管理** | 如何定义节点依赖？DAG 验证？ |
| **执行后端** | 支持哪些执行后端（本地/分布式）？ |

#### Workflow + SDK/Library
| 分析维度 | 关键问题 |
|---------|---------|
| **API 简洁性** | 定义工作流需要多少代码？ |
| **组合能力** | 子工作流嵌套？工作流组合？ |
| **错误处理** | 异常捕获和重试机制？ |

### 核心维度（3 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 工作流定义** | 35% | 可视化编辑和 DSL |
| **2. 执行引擎** | 35% | 执行方式和性能 |
| **3. 状态管理** | 30% | 持久化和恢复 |

---

## 📊 Data（数据处理）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 数据读取模块** | 读取多种格式数据 | `readers/`, `loaders/`, `parsers/` |
| **2. 数据转换模块** | 转换、过滤、映射算子 | `transformers/`, `operators/`, `transforms/` |
| **3. 数据管道模块** | 链式调用和编排 | `pipelines/`, `chains/`, `flows/` |
| **4. 数据质量模块** | 校验、清洗、异常检测 | `validation/`, `cleaning/`, `quality/` |
| **5. 数据输出模块** | 格式化输出和导出 | `writers/`, `exporters/`, `sinks/` |

### 核心维度（3 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 数据读取** | 35% | 格式支持和读取方式 |
| **2. 数据转换** | 35% | 转换算子和管道 |
| **3. 数据质量** | 30% | 校验和清洗 |

---

## 🎤 Voice（语音处理）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 音频输入模块** | 音频文件读取、流式输入 | `audio_io/`, `readers/`, `streaming/` |
| **2. STT 模块** | 语音识别引擎 | `stt/`, `asr/`, `transcribers/` |
| **3. TTS 模块** | 语音合成引擎 | `tts/`, `synthesizers/`, `speakers/` |
| **4. 音频处理模块** | 降噪、变声、格式转换 | `processing/`, `filters/`, `effects/` |
| **5. 模型管理模块** | 模型加载和切换 | `models/`, `backends/`, `inference/` |

### 核心维度（3 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 语音识别 (STT)** | 35% | 语音转文字 |
| **2. 语音合成 (TTS)** | 35% | 文字转语音 |
| **3. 语音处理** | 30% | 降噪/变声/实时处理 |

---

## 🖼️ Image（图像处理）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 图像输入模块** | 图像读取、格式转换 | `io/`, `loaders/`, `formats/` |
| **2. 图像理解模块** | OCR、检测、描述生成 | `understanding/`, `ocr/`, `detection/`, `captioning/` |
| **3. 图像生成模块** | 文生图、图生图 | `generation/`, `diffusion/`, `gan/` |
| **4. 图像编辑模块** | 裁剪、滤镜、修复 | `editing/`, `filters/`, `inpainting/` |
| **5. 模型管理模块** | 模型加载和推理 | `models/`, `inference/`, `backends/` |

### 核心维度（3 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 图像理解** | 35% | OCR/检测/描述 |
| **2. 图像生成** | 35% | 文生图/图生图 |
| **3. 图像处理** | 30% | 转换/编辑/批量 |

---

## 💻 Code（代码生成/分析）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 代码解析模块** | AST 解析、语法树构建 | `parser/`, `ast/`, `syntax/` |
| **2. 代码理解模块** | 语义分析、类型推断 | `analysis/`, `semantics/`, `type_inference/` |
| **3. 代码生成模块** | 补全、重构、测试生成 | `generation/`, `completion/`, `refactoring/` |
| **4. 代码分析模块** | 复杂度、审查、漏洞检测 | `metrics/`, `linting/`, `security/` |
| **5. IDE 集成模块** | LSP、编辑器插件 | `lsp/`, `plugins/`, `extensions/` |

### 核心维度（3 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 代码理解** | 35% | 语言支持/AST 解析 |
| **2. 代码生成** | 35% | 补全/重构/测试 |
| **3. 代码分析** | 30% | 复杂度/审查/漏洞 |

---

## 🔍 Search（搜索/推荐）

### 核心模块（按重要性排序）

| 模块 | 职责 | 关键文件/目录 |
|------|------|--------------|
| **1. 索引构建模块** | 倒排索引、向量索引构建 | `indexing/`, `indexers/`, `build_index.py` |
| **2. 索引存储模块** | 索引持久化和更新 | `storage/`, `persistence/`, `index_store.py` |
| **3. 搜索模块** | 关键字搜索、向量搜索 | `search/`, `retrievers/`, `queries/` |
| **4. 排序模块** | 相关性排序、个性化排序 | `ranking/`, `scoring/`, `rerankers/` |
| **5. 推荐模块** | 协同过滤、内容推荐 | `recommendation/`, `recommenders/`, `collaborative/` |

### 核心维度（3 个）⭐

| 维度 | 权重 | 说明 |
|------|------|------|
| **1. 索引构建** | 35% | 索引类型和构建速度 |
| **2. 搜索算法** | 35% | 算法支持和排序 |
| **3. 推荐系统** | 30% | 推荐算法和学习 |

---

## 📊 使用说明

### 在研究流程中的使用

1. **Round 1-2**: 识别项目标签（应用场景 + 产品形态 + 技术特性）
2. **Round 3**: 根据标签选择对应的核心模块进行深度分析
3. **Round 4**: 填写核心维度评估和对比数据

### 核心模块定位流程

```
确定项目标签组合（如 RAG + Framework）
    ↓
读取对应应用场景的核心模块列表（RAG 6 个核心模块）
    ↓
根据产品形态调整分析重点（Framework 重点关注 API 设计、扩展点）
    ↓
定位需要重点分析的文件/目录
    ↓
针对性研究
```

---

## 🔄 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-03-04 | 创建标签维度定义 v1.0 |
| 2026-03-04 | v2.0: 三级标签改为动态生成，不再预定义固定标签 |
| 2026-03-04 | v3.0: 基于 deepagents 重新定义 Agent 核心能力（5 大能力 +7 个核心模块） |

---

**版本**: v3.0
**最后更新**: 2026-03-04
**维护者**: github-deep-research
