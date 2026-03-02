# MemoryBear 调用链分析报告

## 📊 研究概览

**项目名称**: MemoryBear  
**分析时间**: 2026-03-02 20:30 GMT+8  
**研究方法**: 毛线团研究法 v2.0 - 多入口点波次追踪

---

## 🎯 波次执行策略

### 波次 1: 记忆写入流程 ⭐⭐⭐
### 波次 2: 记忆读取流程 ⭐⭐⭐
### 波次 3: RAG 文档处理流程 ⭐⭐
### 波次 4: 工作流执行流程 ⭐⭐

---

## 📝 波次 1: 记忆写入流程调用链

### 入口点: API Controller → Service → LangGraph

```
POST /api/memory/agent/write
    ↓
MemoryAgentController.write_memory()
    ↓
MemoryAgentService.writer_messages_deal()
    ↓
long_term_storage() [write_graph.py]
    ↓
make_write_graph() [LangGraph StateGraph]
    ↓
write_node [nodes/write_nodes.py]
    ↓
write() [utils/write_tools.py]
    ↓
ExtractionOrchestrator.run()
    ↓
save_dialog_and_statements_to_neo4j()
```

### 详细调用链

#### 层级 1: API 入口 (`api/app/controllers/memory_agent_controller.py`)

```python
@router.post("/write", response_model=ApiResponse)
async def write_memory(
    request: Write_UserInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """写入记忆到长期存储"""
    service = MemoryAgentService()
    result = await service.writer_messages_deal(
        messages=request.messages,
        start_time=time.time(),
        end_user_id=request.end_user_id,
        config_id=request.config_id,
        message=request.message,
        context=context
    )
```

#### 层级 2: 服务层 (`api/app/services/memory_agent_service.py:60-85`)

```python
def writer_messages_deal(self, messages, start_time, end_user_id, config_id, message, context):
    """处理记忆写入请求"""
    duration = time.time() - start_time
    if str(messages) == 'success':
        logger.info(f"Write operation successful for group {end_user_id}")
        # 记录审计日志
        if audit_logger:
            audit_logger.log_operation(
                operation="WRITE",
                config_id=config_id,
                end_user_id=end_user_id,
                success=True,
                duration=duration
            )
        return context
    else:
        raise ValueError(f"写入失败：{messages}")
```

#### 层级 3: LangGraph 工作流 (`api/app/core/memory/agent/langgraph_graph/write_graph.py:25-50`)

```python
@asynccontextmanager
async def make_write_graph():
    """创建记忆写入图工作流"""
    workflow = StateGraph(WriteState)
    workflow.add_node("save_neo4j", write_node)
    workflow.add_edge(START, "save_neo4j")
    workflow.add_edge("save_neo4j", END)
    graph = workflow.compile()
    yield graph

async def long_term_storage(long_term_type:str="chunk", langchain_messages:list=[], ...):
    """长期记忆存储入口"""
    from app.core.memory.agent.langgraph_graph.routing.write_router import (
        memory_long_term_storage,
        window_dialogue,
        aggregate_judgment
    )
    
    # 保存会话到 Redis
    write_store.save_session_write(end_user_id, langchain_messages)
    
    # 加载记忆配置
    with get_db_context() as db_session:
        config_service = MemoryConfigService(db_session)
        memory_config = config_service.load_memory_config(
            config_id=memory_config,
            service_name="MemoryAgentService"
        )
        
        # 根据策略选择写入方式
        if long_term_type == 'chunk':
            await window_dialogue(end_user_id, langchain_messages, memory_config, scope)
        elif long_term_type == 'time':
            await memory_long_term_storage(end_user_id, memory_config, 5)
        elif long_term_type == 'aggregate':
            await aggregate_judgment(end_user_id, langchain_messages, memory_config)
```

#### 层级 4: 写入节点 (`api/app/core/memory/agent/langgraph_graph/nodes/write_nodes.py:7-45`)

```python
async def write_node(state: WriteState) -> WriteState:
    """
    LangGraph 写入节点 - 执行数据写入
    
    Args:
        state: WriteState 包含 messages, end_user_id, memory_config, language
    
    Returns:
        dict: 包含 write_result 状态和数据
    """
    messages = state.get('messages', [])
    end_user_id = state.get('end_user_id', '')
    memory_config = state.get('memory_config', '')
    language = state.get('language', 'zh')
    
    # 转换 LangChain 消息为结构化格式
    structured_messages = []
    for msg in messages:
        if hasattr(msg, 'type') and hasattr(msg, 'content'):
            role = 'user' if msg.type == 'human' else 'assistant' if msg.type == 'ai' else msg.type
            structured_messages.append({
                "role": role,
                "content": msg.content
            })
    
    try:
        result = await write(
            messages=structured_messages,
            end_user_id=end_user_id,
            memory_config=memory_config,
            language=language,
        )
        return {"write_result": {"status": "success", "data": structured_messages}}
    except Exception as e:
        logger.error(f"Data_write failed: {e}", exc_info=True)
        return {"write_result": {"status": "error", "message": str(e)}}
```

#### 层级 5: 核心写入函数 (`api/app/core/memory/agent/utils/write_tools.py:30-100`)

```python
async def write(
    end_user_id: str,
    memory_config: MemoryConfig,
    messages: list,
    ref_id: str = "wyl20251027",
    language: str = "zh",
) -> None:
    """
    执行完整的知识提取流水线
    
    流程:
    1. 从 MemoryConfig 构建 LLM/Embedding 客户端
    2. 加载和分块对话数据
    3. 运行 ExtractionOrchestrator 提取知识
    4. 保存到 Neo4j 图数据库
    """
    # 提取配置
    embedding_model_id = str(memory_config.embedding_model_id)
    chunker_strategy = memory_config.chunker_strategy
    config_id = str(memory_config.config_id)
    
    # 使用工厂模式构建客户端
    with get_db_context() as db:
        factory = MemoryClientFactory(db)
        llm_client = factory.get_llm_client_from_config(memory_config)
        embedder_client = factory.get_embedder_client_from_config(memory_config)
    
    # 初始化 Neo4j 连接器
    neo4j_connector = Neo4jConnector()
    
    # Step 1: 加载和分块数据
    chunked_dialogs = await get_chunked_dialogs(
        chunker_strategy=chunker_strategy,
        end_user_id=end_user_id,
        messages=messages,
        ref_id=ref_id,
        config_id=config_id,
    )
    
    # Step 2: 运行 ExtractionOrchestrator
    pipeline_config = get_pipeline_config(memory_config)
    
    # 加载本体论类型 (如果配置了 scene_id)
    if memory_config.scene_id:
        ontology_types = load_ontology_types_for_scene(
            scene_id=memory_config.scene_id,
            workspace_id=memory_config.workspace_id,
            db=db
        )
    
    # Step 3: 执行知识提取
    orchestrator = ExtractionOrchestrator(
        chunked_dialogs=chunked_dialogs,
        llm_client=llm_client,
        embedder_client=embedder_client,
        pipeline_config=pipeline_config,
        ontology_types=ontology_types,
        neo4j_connector=neo4j_connector,
        end_user_id=end_user_id,
        config_id=config_id,
        language=language,
    )
    
    extraction_result = await orchestrator.run()
    
    # Step 4: 保存到 Neo4j
    await save_dialog_and_statements_to_neo4j(
        neo4j_connector=neo4j_connector,
        extraction_result=extraction_result,
        end_user_id=end_user_id,
        config_id=config_id
    )
```

---

## 📖 波次 2: 记忆读取流程调用链

### 入口点: API Controller → Service → LangGraph Read Graph

```
POST /api/memory/agent/read
    ↓
MemoryAgentController.read_memory()
    ↓
MemoryAgentService.read_messages()
    ↓
make_read_graph() [LangGraph StateGraph]
    ↓
content_input_node → Split_The_Problem → Problem_Extension
    ↓
retrieve → Verify → Summary
    ↓
返回检索结果
```

### 详细调用链

#### LangGraph 读取图结构 (`api/app/core/memory/agent/langgraph_graph/read_graph.py:30-70`)

```python
@asynccontextmanager
async def make_read_graph():
    """创建记忆读取图工作流"""
    workflow = StateGraph(ReadState)
    
    # 添加节点
    workflow.add_node("content_input", content_input_node)
    workflow.add_node("Split_The_Problem", Split_The_Problem)
    workflow.add_node("Problem_Extension", Problem_Extension)
    workflow.add_node("Input_Summary", Input_Summary)
    workflow.add_node("Retrieve", retrieve)
    workflow.add_node("Verify", Verify)
    workflow.add_node("Retrieve_Summary", Retrieve_Summary)
    workflow.add_node("Summary", Summary)
    workflow.add_node("Summary_fails", Summary_fails)
    
    # 添加边
    workflow.add_edge(START, "content_input")
    workflow.add_conditional_edges("content_input", Split_continue)
    workflow.add_edge("Input_Summary", END)
    workflow.add_edge("Split_The_Problem", "Problem_Extension")
    workflow.add_edge("Problem_Extension", "Retrieve")
    workflow.add_conditional_edges("Retrieve", Retrieve_continue)
    workflow.add_edge("Retrieve_Summary", END)
    workflow.add_conditional_edges("Verify", Verify_continue)
    workflow.add_edge("Summary_fails", END)
    workflow.add_edge("Summary", END)
    
    graph = workflow.compile()
    yield graph
```

### 读取流程图

```
START
  ↓
content_input_node [内容输入节点]
  ↓
Split_continue [条件路由：是否需要拆分问题]
  ├─→ Input_Summary → END [直接总结]
  └─→ Split_The_Problem [拆分问题]
        ↓
      Problem_Extension [问题扩展]
        ↓
      retrieve [检索节点]
        ↓
      Retrieve_continue [条件路由：检索是否充分]
        ├─→ Retrieve_Summary → END [检索总结]
        └─→ Verify [验证节点]
              ↓
            Verify_continue [条件路由：验证是否通过]
              ├─→ Summary → END [最终总结]
              └─→ Summary_fails → END [总结失败]
```

---

## 📚 波次 3: RAG 文档处理流程调用链

### 入口点: Celery 任务

```
Celery Beat / API Trigger
    ↓
parse_document() [tasks.py]
    ↓
1. 文档解析 & 分段
2. 向量嵌入
3. 存储到 Elasticsearch
4. (可选) 构建 GraphRAG
```

### 详细调用链

#### Celery 任务 (`api/app/tasks.py:60-120`)

```python
@celery_app.task(name="app.core.rag.tasks.parse_document")
def parse_document(file_path: str, document_id: uuid.UUID):
    """
    文档解析、向量化和存储
    
    流程:
    1. 文档解析与分段
    2. 向量嵌入
    3. 存储到向量数据库
    4. 更新进度
    """
    db = next(get_db())
    db_document = db.query(Document).filter(Document.id == document_id).first()
    db_knowledge = db.query(Knowledge).filter(Knowledge.id == db_document.kb_id).first()
    
    # 1. 文档解析 & 分段
    progress_msg += f"Start to parse.\n"
    db_document.progress = 0.0
    db_document.progress_msg = progress_msg
    db.commit()
    
    # 配置模型
    chat_model = Base(
        key=db_knowledge.llm.api_keys[0].api_key,
        model_name=db_knowledge.llm.api_keys[0].model_name,
        base_url=db_knowledge.llm.api_keys[0].api_base
    )
    embedding_model = OpenAIEmbed(
        key=db_knowledge.embedding.api_keys[0].api_key,
        model_name=db_knowledge.embedding.api_keys[0].model_name,
        base_url=db_knowledge.embedding.api_keys[0].api_base
    )
    
    # 2. 文档分段
    chunks = chunk_document(file_path, chat_model, embedding_model)
    
    # 3. 向量化并存储
    vdb = ElasticSearchVectorFactory.create(db_knowledge.vdb_config)
    vdb.insert(chunks)
    
    # 4. (可选) 构建 GraphRAG
    if db_knowledge.enable_graphrag:
        run_graphrag_for_kb(db_knowledge.id)
```

---

## ⚙️ 波次 4: 工作流执行流程调用链

### 入口点: API → Workflow Executor

```
POST /api/workflow/run
    ↓
WorkflowController.run_workflow()
    ↓
WorkflowExecutor.execute()
    ↓
GraphBuilder.build_graph()
    ↓
Node 执行链 (Start → LLM → Code → End)
```

### 工作流执行器 (`api/app/core/workflow/executor.py`)

**文件大小**: 39,936 字节  
**核心方法**: `execute()`, `run_node()`, `handle_edge()`

```python
class WorkflowExecutor:
    """工作流执行器 - 基于 LangGraph 的图执行引擎"""
    
    async def execute(self, workflow_id: UUID, inputs: Dict) -> Dict:
        """执行工作流"""
        # 1. 加载工作流定义
        workflow = self.load_workflow(workflow_id)
        
        # 2. 构建执行图
        graph = GraphBuilder.build_graph(workflow)
        
        # 3. 初始化变量池
        variable_pool = VariablePool(inputs)
        
        # 4. 执行图
        result = await self.run_graph(graph, variable_pool)
        
        return result
    
    async def run_node(self, node: BaseNode, variable_pool: VariablePool):
        """执行单个节点"""
        # 根据节点类型分发
        if isinstance(node, StartNode):
            return await self.run_start_node(node, variable_pool)
        elif isinstance(node, LLMNode):
            return await self.run_llm_node(node, variable_pool)
        elif isinstance(node, CodeNode):
            return await self.run_code_node(node, variable_pool)
        elif isinstance(node, IfElseNode):
            return await self.run_ifelse_node(node, variable_pool)
        # ... 26 种节点类型
```

---

## 🔍 关键调用链分析

### 1. 记忆写入配置加载链

```
MemoryConfigService.load_memory_config()
    ↓
查询数据库获取 MemoryConfig
    ↓
填充 LLM/Embedding/VDB 配置
    ↓
返回完整 MemoryConfig 对象
```

### 2. Neo4j 存储链

```
save_dialog_and_statements_to_neo4j()
    ↓
Neo4jConnector.connect()
    ↓
add_memory_summary_nodes() [添加节点]
    ↓
add_memory_summary_statement_edges() [添加边]
    ↓
提交事务
```

### 3. 遗忘引擎调度链

```
Celery Beat (每 24 小时)
    ↓
forgetting_cycle 任务
    ↓
ForgettingScheduler.trigger_forgetting_cycle()
    ↓
ForgettingEngine.apply_forgetting_rules()
    ↓
更新记忆权重/标记删除
```

---

## 📊 调用链统计

| 流程 | 调用深度 | 关键组件 | 异步支持 |
|------|---------|---------|---------|
| 记忆写入 | 5 层 | LangGraph, Neo4j, ExtractionOrchestrator | ✅ async/await |
| 记忆读取 | 5 层 | LangGraph, Retrieve, Verify | ✅ async/await |
| RAG 处理 | 4 层 | Celery, Elasticsearch, GraphRAG | ✅ Celery 异步 |
| 工作流执行 | 4 层 | WorkflowExecutor, GraphBuilder, Nodes | ✅ async/await |

---

## 🎯 核心设计模式识别

### 1. 工厂模式
- `MemoryClientFactory`: 根据配置动态创建 LLM/Embedding 客户端

### 2. 策略模式
- 记忆写入策略：`chunk` / `time` / `aggregate`
- 分块策略：多种 chunker_strategy

### 3. 状态模式
- LangGraph StateGraph: 读写状态管理

### 4. 责任链模式
- 工作流节点执行链
- 遗忘引擎规则链

### 5. 观察者模式
- Celery 任务进度回调
- 审计日志记录

---

## ✅ 阶段 3 完成

**分析完成时间**: 2026-03-02 20:40 GMT+8  
**波次数**: 4 个独立入口点追踪  
**调用链深度**: 4-5 层  
**下一阶段**: 阶段 4 - 知识链路完整性检查
