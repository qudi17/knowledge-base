# CrewAI 知识链路完整性检查

**研究阶段**: 阶段 4  
**执行日期**: 2026-03-04  
**检查范围**: Memory + Knowledge 系统

---

## 📊 知识链路 5 环节分析

### 1. 知识产生（Knowledge Generation）

**入口点**:
- 用户输入（Task description, context）
- 文件上传（input_files）
- 工具执行结果
- Agent 执行记忆
- 外部 API 数据

**知识产生流程**:

```
用户输入
    ↓
Task.description / expected_output
    ↓
Agent 执行
    ↓
LLM 生成内容 + 工具执行结果
    ↓
Memory.remember() / Knowledge.add_sources()
    ↓
存储到 Memory/Knowledge
```

**关键代码**:

```python
# Memory 保存 (unified_memory.py:200-250)
def remember(
    self,
    content: str,
    scope: str | None = None,
    metadata: dict[str, Any] | None = None,
    importance: float | None = None,
) -> MemoryRecord:
    """Save content to memory with LLM analysis."""
    
    # 1. LLM 分析内容（提取 scope/categories/importance）
    if scope is None or importance is None:
        analysis = extract_memories_from_content(
            content=content,
            llm=self.llm,
        )
        scope = scope or analysis.scope
        importance = importance or analysis.importance
    
    # 2. 生成 embedding
    embedding = self.embedder(content)
    
    # 3. 创建记忆记录
    record = MemoryRecord(
        content=content,
        scope=scope,
        embedding=embedding,
        metadata=metadata or {},
        importance=importance,
        created_at=datetime.now(),
    )
    
    # 4. 检查是否需要合并（consolidation）
    similar_records = self._find_similar(content, limit=self.consolidation_limit)
    if similar_records and similar_records[0].score >= self.consolidation_threshold:
        record = self._consolidate(record, similar_records[0])
    
    # 5. 存储到后端
    self.storage.save(record)
    
    return record
```

**知识类型**:
- ✅ 任务描述和输出
- ✅ Agent 执行历史
- ✅ 工具调用结果
- ✅ 用户反馈
- ✅ 文件内容

---

### 2. 知识存储（Knowledge Storage）

**存储系统**:

#### Memory 存储

**后端**: LanceDB（默认）  
**位置**: `lib/crewai/src/crewai/memory/storage/`

```python
# storage/lancedb_storage.py
class LanceDBStorage(StorageBackend):
    """LanceDB-based memory storage."""
    
    def __init__(self, config: MemoryConfig):
        self.db = lancedb.connect(config.path)
        self.table = self.db.create_table(
            "memories",
            schema=pa.schema([
                pa.field("id", pa.string()),
                pa.field("content", pa.string()),
                pa.field("scope", pa.string()),
                pa.field("embedding", pa.list_(pa.float32())),
                pa.field("metadata", pa.string()),  # JSON
                pa.field("importance", pa.float32()),
                pa.field("created_at", pa.timestamp()),
            ])
        )
    
    def save(self, record: MemoryRecord) -> None:
        self.table.add([{
            "id": str(record.id),
            "content": record.content,
            "scope": record.scope,
            "embedding": record.embedding,
            "metadata": json.dumps(record.metadata),
            "importance": record.importance,
            "created_at": record.created_at,
        }])
```

**存储特性**:
- ✅ 向量嵌入（支持语义搜索）
- ✅ 元数据过滤
- ✅ 时间戳索引
- ✅ Scope 分类
- ✅ 重要性评分

#### Knowledge 存储

**后端**: ChromaDB / LanceDB  
**位置**: `lib/crewai/src/crewai/knowledge/storage/`

```python
# knowledge_storage.py
class KnowledgeStorage:
    """Knowledge storage with chunking and indexing."""
    
    def __init__(
        self,
        collection_name: str,
        embedder: EmbedderConfig | None = None,
    ):
        self.collection_name = collection_name
        self.embedder = build_embedder(embedder)
        self.client = chromadb.PersistentClient(path="./knowledge")
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedder,
        )
    
    def add(
        self,
        documents: list[str],
        metadatas: list[dict] | None = None,
        ids: list[str] | None = None,
    ) -> None:
        self.collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids,
        )
```

**存储对比**:

| 特性 | Memory | Knowledge |
|------|--------|-----------|
| **用途** | 短期/长期记忆 | 领域知识库 |
| **后端** | LanceDB | ChromaDB/LanceDB |
| **分析** | LLM 自动分析 | 手动/自动分块 |
| **更新** | 支持合并/更新 | 支持增量添加 |
| **Scope** | 自动推断 | 手动指定 |
| **适用** | Agent 记忆 | RAG 知识 |

---

### 3. 知识检索（Knowledge Retrieval）

#### Memory 检索 - RecallFlow

**文件**: `lib/crewai/src/crewai/memory/recall_flow.py`

**检索流程**:

```python
# recall_flow.py (简化版)
class RecallFlow:
    """Adaptive-depth memory recall."""
    
    def recall(
        self,
        query: str,
        scope: str | None = None,
        limit: int = 5,
    ) -> list[MemoryMatch]:
        
        # 1. 短查询跳过 LLM 分析
        if len(query) < self.query_analysis_threshold:
            return self._direct_search(query, scope, limit)
        
        # 2. LLM 分析查询（提取意图/关键词）
        analysis = self._analyze_query(query)
        
        # 3. 向量搜索
        query_embedding = self.embedder(query)
        results = self.storage.search(
            query_embedding=query_embedding,
            scope=scope,
            limit=limit * 2,  # 初筛更多结果
        )
        
        # 4. 计算复合评分
        for result in results:
            result.score = compute_composite_score(
                similarity=result.similarity,
                recency=result.recency,
                importance=result.importance,
                recency_weight=self.config.recency_weight,
                semantic_weight=self.config.semantic_weight,
                importance_weight=self.config.importance_weight,
            )
        
        # 5. 路由决策
        if not results:
            return []
        
        top_confidence = results[0].score
        
        if top_confidence >= self.confidence_threshold_high:
            # 高置信度：直接返回
            return results[:limit]
        
        elif top_confidence < self.confidence_threshold_low:
            # 低置信度：深度探索
            if self.exploration_budget > 0:
                return self._explore_deeper(query, results, limit)
        
        elif self._is_complex_query(query) and top_confidence < self.complex_query_threshold:
            # 复杂查询：深度探索
            if self.exploration_budget > 0:
                return self._explore_deeper(query, results, limit)
        
        return results[:limit]
    
    def _explore_deeper(
        self,
        query: str,
        initial_results: list[MemoryMatch],
        limit: int,
    ) -> list[MemoryMatch]:
        """LLM-driven deeper exploration."""
        
        # LLM 生成探索性问题
        follow_up_queries = self.llm.generate(
            f"Based on initial results, generate follow-up queries:\n{initial_results}"
        )
        
        # 递归搜索
        for follow_up in follow_up_queries[:self.exploration_budget]:
            more_results = self._direct_search(follow_up, limit=limit)
            initial_results.extend(more_results)
        
        # 重新排序
        return sorted(initial_results, key=lambda x: x.score, reverse=True)[:limit]
```

**检索策略**:
- ✅ 向量相似度搜索
- ✅ Scope 过滤
- ✅ 复合评分（相似度 + 新近度 + 重要性）
- ✅ 自适应深度（RecallFlow 路由）
- ✅ LLM 驱动的探索式检索

#### Knowledge 检索

```python
# knowledge.py
def query(
    self,
    query: list[str],
    results_limit: int = 5,
    score_threshold: float = 0.6,
) -> list[SearchResult]:
    """Query knowledge sources."""
    
    return self.storage.search(
        query,
        limit=results_limit,
        score_threshold=score_threshold,
    )
```

**检索对比**:

| 特性 | Memory Recall | Knowledge Query |
|------|---------------|-----------------|
| **搜索方式** | 向量 + 元数据 | 向量 |
| **评分** | 复合评分 | 相似度 |
| **深度** | 自适应 | 固定 |
| **LLM 分析** | ✅ 查询分析 | ❌ 无 |
| **阈值** | 可配置 | score_threshold |
| **适用** | 动态记忆 | 静态知识 |

---

### 4. 知识使用（Knowledge Usage）

**Agent 使用知识**:

```python
# agent/core.py (简化版)
class Agent(BaseAgent):
    def execute_task(
        self,
        task: Task,
        context: list[TaskOutput] | None = None,
    ) -> TaskOutput:
        
        # 1. 检索记忆（如果启用）
        if self.memory:
            memories = self.memory.recall(
                query=task.description,
                scope=self.role,
                limit=5,
            )
            memory_context = "\n".join([m.content for m in memories])
        
        # 2. 检索知识（如果配置）
        if self.knowledge:
            knowledge_results = self.knowledge.query(
                query=[task.description],
                results_limit=5,
            )
            knowledge_context = "\n".join([r.content for r in knowledge_results])
        
        # 3. 构建 Prompt
        prompt = self._build_prompt(
            task=task,
            context=context,
            memory=memory_context,
            knowledge=knowledge_context,
        )
        
        # 4. 调用 LLM
        response = self.llm.invoke(prompt)
        
        return TaskOutput(
            description=task.description,
            raw=response,
            agent=self,
        )
```

**使用场景**:
- ✅ 任务执行上下文增强
- ✅ 历史经验复用
- ✅ 领域知识注入
- ✅ 避免重复错误
- ✅ 个性化行为

---

### 5. 知识优化（Knowledge Optimization）

#### Memory 优化

**1. Consolidation（合并）**:

```python
# unified_memory.py
def _consolidate(
    self,
    new_record: MemoryRecord,
    existing_record: MemoryRecord,
) -> MemoryRecord:
    """Merge new memory with existing similar memory."""
    
    # LLM 判断：更新/合并/删除
    action = self.llm.invoke(f"""
    Compare memories:
    Existing: {existing_record.content}
    New: {new_record.content}
    
    Action: update / merge / delete / keep_both
    """)
    
    if action == "merge":
        merged_content = self.llm.invoke(f"""
        Merge these memories:
        1. {existing_record.content}
        2. {new_record.content}
        
        Merged:
        """)
        existing_record.content = merged_content
        existing_record.updated_at = datetime.now()
        return existing_record
    
    elif action == "update":
        existing_record.content = new_record.content
        existing_record.updated_at = datetime.now()
        return existing_record
    
    elif action == "delete":
        self.storage.delete(existing_record.id)
        return new_record
    
    return new_record
```

**2. 遗忘机制（Forgetting）**:

```python
# 基于时间的衰减
def _compute_recency_score(created_at: datetime) -> float:
    """Exponential decay based on recency half-life."""
    days_old = (datetime.now() - created_at).days
    half_life_days = 30  # 默认 30 天半衰期
    return 0.5 ** (days_old / half_life_days)

# 低重要性记忆自动清理
def cleanup(
    self,
    min_importance: float = 0.2,
    max_age_days: int = 90,
) -> int:
    """Remove old, low-importance memories."""
    
    cutoff_date = datetime.now() - timedelta(days=max_age_days)
    deleted = self.storage.delete_if(
        lambda r: r.importance < min_importance and r.created_at < cutoff_date
    )
    return deleted
```

**3. 反思机制（Reflection）**:

```python
# analyze.py
def extract_memories_from_content(
    content: str,
    llm: BaseLLM,
) -> MemoryAnalysis:
    """Extract scope, categories, and importance from content."""
    
    prompt = f"""
    Analyze this content and extract:
    1. Scope (e.g., "work", "personal", "project-x")
    2. Categories (3-5 keywords)
    3. Importance (0.0-1.0)
    4. Summary (1 sentence)
    
    Content: {content[:2000]}
    """
    
    response = llm.invoke(prompt)
    return parse_analysis(response)
```

#### Knowledge 优化

**1. 分块策略（Chunking）**:

```python
# source/base_knowledge_source.py
class BaseKnowledgeSource(BaseModel):
    chunk_size: int = 1000
    chunk_overlap: int = 200
    
    def _chunk_documents(
        self,
        documents: list[str],
    ) -> list[str]:
        """Split documents into chunks."""
        chunks = []
        for doc in documents:
            # 递归分块
            chunks.extend(self._recursive_chunk(
                doc,
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
            ))
        return chunks
```

**2. 增量更新**:

```python
async def aadd_sources(self) -> None:
    """Add sources incrementally."""
    for source in self.sources:
        # 检查是否已存在
        existing_ids = self.storage.get_ids_by_hash(source.content_hash)
        if existing_ids:
            # 更新现有
            await self.storage.update(source)
        else:
            # 新增
            await self.storage.add(source)
```

---

## 🔍 知识链路完整性评分

| 环节 | 完整性 | 评分 | 备注 |
|------|--------|------|------|
| **知识产生** | ✅ 完整 | 95/100 | 支持多来源，LLM 自动分析 |
| **知识存储** | ✅ 完整 | 90/100 | 双存储系统（Memory/Knowledge） |
| **知识检索** | ✅ 完整 | 95/100 | RecallFlow 自适应检索 |
| **知识使用** | ✅ 完整 | 90/100 | Agent 自动集成 |
| **知识优化** | ✅ 完整 | 85/100 | 合并/遗忘/反思机制 |

**总体完整性**: **91/100** ⭐⭐⭐⭐⭐

---

## 📌 关键发现

### 1. 双存储架构

- **Memory**: 短期/长期记忆，LLM 自动分析
- **Knowledge**: 领域知识库，手动/自动分块
- **协同**: Agent 同时使用两者增强上下文

### 2. 智能检索

- **RecallFlow**: 自适应深度检索
- **复合评分**: 相似度 + 新近度 + 重要性
- **LLM 驱动**: 查询分析和探索式检索

### 3. 知识优化

- **Consolidation**: 相似记忆合并
- **Forgetting**: 基于时间和重要性的遗忘
- **Reflection**: LLM 自动分析内容

### 4. 生产就绪

- ✅ 异步支持
- ✅ 持久化存储
- ✅ 并发安全
- ✅ 可配置参数
- ✅ 完整的事件追踪

---

## 🎯 下一步研究方向

### 阶段 5: 架构层次覆盖检查

基于知识链路分析，下一步研究：
1. 表现层（API/CLI）
2. 服务层（业务逻辑）
3. 核心层（Agent/Crew/Flow）
4. 后台层（异步任务）
5. 数据层（存储后端）

---

**完整性检查**:
- ✅ 知识产生：多来源支持
- ✅ 知识存储：双存储架构
- ✅ 知识检索：自适应 RecallFlow
- ✅ 知识使用：Agent 集成
- ✅ 知识优化：合并/遗忘/反思

**下一步**: 阶段 5 - 架构层次覆盖检查
