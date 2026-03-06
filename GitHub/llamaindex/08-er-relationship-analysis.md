# LlamaIndex Engine、Retriever、Index ER 关系深度分析

**研究日期**: 2026-03-06
**研究重点**: Engine、Retriever 和 Index 之间的实体关系（ER）

---

## 🎯 核心结论

### ER 关系总结

| 关系 | 类型 | 说明 |
|------|------|------|
| **Engine → Retriever** | **1:N** | 一个 Engine 可以使用多个 Retriever（通过 RouterRetriever、QueryFusionRetriever 等） |
| **Retriever → Index** | **1:1 或 1:N** | 基础 Retriever 通常是 1:1，但高级 Retriever 可以是 1:N |
| **Engine → Index** | **N:N** | 通过 Retriever 中间层间接关联 |

---

## 📊 ER 关系图（Mermaid）

```mermaid
erDiagram
    BaseChatEngine ||--o{ BaseRetriever : "uses (1:N)"
    BaseQueryEngine ||--o{ BaseRetriever : "uses (1:1)"
    BaseRetriever }o--|| BaseIndex : "queries (1:1)"
    BaseRetriever }o--o{ BaseIndex : "queries (1:N via Router/Fusion)"
    
    BaseChatEngine {
        string _type
        BaseRetriever _retriever
        LLM _llm
        BaseMemory _memory
    }
    
    BaseQueryEngine {
        BaseRetriever _retriever
        BaseSynthesizer _response_synthesizer
    }
    
    BaseRetriever {
        +retrieve(QueryBundle) List[NodeWithScore]
        +_retrieve(QueryBundle) List[NodeWithScore]
    }
    
    BaseIndex {
        +index_struct
        +vector_store
        +docstore
        +as_retriever() BaseRetriever
    }
    
    VectorStoreIndex ||--o{ VectorIndexRetriever : "creates"
    RouterRetriever ||--o{ RetrieverTool : "selects from"
    QueryFusionRetriever ||--o{ BaseRetriever : "fuses multiple"
```

---

## 🏗️ 架构层次和依赖关系

### 三层架构

```
┌─────────────────────────────────────────┐
│         Engine Layer (引擎层)            │
│  - BaseChatEngine (对话引擎)             │
│  - BaseQueryEngine (查询引擎)            │
│  - ContextChatEngine, CondensePlus...   │
│  - RetrieverQueryEngine, SubQuestion... │
└─────────────────┬───────────────────────┘
                  │ uses
                  ▼
┌─────────────────────────────────────────┐
│       Retriever Layer (检索层)           │
│  - BaseRetriever (抽象基类)              │
│  - VectorIndexRetriever (向量检索)       │
│  - RouterRetriever (路由多检索器)        │
│  - QueryFusionRetriever (融合检索)       │
│  - RecursiveRetriever (递归检索)         │
└─────────────────┬───────────────────────┘
                  │ queries
                  ▼
┌─────────────────────────────────────────┐
│         Index Layer (索引层)             │
│  - BaseIndex (抽象基类)                  │
│  - VectorStoreIndex (向量索引)           │
│  - ListIndex, TreeIndex, KeywordTable.. │
│  - 存储：vector_store, docstore, graph..│
└─────────────────────────────────────────┘
```

---

## 🔍 详细关系分析

### 1. Engine → Retriever 关系

#### 1.1 单一 Retriever 模式（1:1）

**ContextChatEngine** 示例：
```python
class ContextChatEngine(BaseChatEngine):
    def __init__(
        self,
        retriever: BaseRetriever,  # 单个 Retriever
        llm: LLM,
        memory: BaseMemory,
        ...
    ):
        self._retriever = retriever
    
    def _get_nodes(self, message: str) -> List[NodeWithScore]:
        nodes = self._retriever.retrieve(message)  # 直接调用
        return nodes
```

**RetrieverQueryEngine** 示例：
```python
class RetrieverQueryEngine(BaseQueryEngine):
    def __init__(
        self,
        retriever: BaseRetriever,  # 单个 Retriever
        response_synthesizer: Optional[BaseSynthesizer] = None,
        ...
    ):
        self._retriever = retriever
    
    def retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        nodes = self._retriever.retrieve(query_bundle)
        return self._apply_node_postprocessors(nodes, query_bundle)
```

#### 1.2 多 Retriever 模式（1:N）

**RouterRetriever** - 路由多个 Retriever：
```python
class RouterRetriever(BaseRetriever):
    def __init__(
        self,
        selector: BaseSelector,
        retriever_tools: Sequence[RetrieverTool],  # 多个 Retriever
        ...
    ):
        self._retrievers: List[BaseRetriever] = [x.retriever for x in retriever_tools]
    
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        # 选择一个或多个 Retriever
        result = self._selector.select(self._metadatas, query_bundle)
        
        if len(result.inds) > 1:
            # 多 Retriever 并行检索
            for i, engine_ind in enumerate(result.inds):
                selected_retriever = self._retrievers[engine_ind]
                cur_results = selected_retriever.retrieve(query_bundle)
        else:
            # 单 Retriever 检索
            selected_retriever = self._retrievers[result.ind]
            cur_results = selected_retriever.retrieve(query_bundle)
```

**QueryFusionRetriever** - 融合多个 Retriever 结果：
```python
class QueryFusionRetriever(BaseRetriever):
    def __init__(
        self,
        retrievers: List[BaseRetriever],  # 多个 Retriever
        mode: FUSION_MODES = FUSION_MODES.SIMPLE,
        ...
    ):
        self._retrievers = retrievers
    
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        # 对每个 Retriever 执行检索
        for query in queries:
            for i, retriever in enumerate(self._retrievers):
                results[(query.query_str, i)] = retriever.retrieve(query)
        
        # 融合结果（reciprocal rank, relative score 等）
        return self._simple_fusion(results)[:self.similarity_top_k]
```

**SubQuestionQueryEngine** - 多个 QueryEngine（每个包含 Retriever）：
```python
class SubQuestionQueryEngine(BaseQueryEngine):
    def __init__(
        self,
        query_engine_tools: Sequence[QueryEngineTool],  # 多个 QueryEngine
        ...
    ):
        self._query_engines = {
            tool.metadata.name: tool.query_engine for tool in query_engine_tools
        }
    
    def _query(self, query_bundle: QueryBundle) -> RESPONSE_TYPE:
        # 生成子问题
        sub_questions = self._question_gen.generate(self._metadatas, query_bundle)
        
        # 每个子问题使用不同的 QueryEngine（Retriever）
        qa_pairs_all = [
            self._query_subq(sub_q, color=colors[str(ind)])
            for ind, sub_q in enumerate(sub_questions)
        ]
```

---

### 2. Retriever → Index 关系

#### 2.1 基础关系（1:1）

**VectorIndexRetriever** 示例：
```python
class VectorIndexRetriever(BaseRetriever):
    def __init__(
        self,
        index: VectorStoreIndex,  # 单个 Index
        similarity_top_k: int = DEFAULT_SIMILARITY_TOP_K,
        ...
    ):
        self._index = index
        self._vector_store = self._index.vector_store
        self._embed_model = self._index._embed_model
        self._docstore = self._index.docstore
    
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        # 构建向量查询
        query = self._build_vector_store_query(query_bundle)
        
        # 通过 vector_store 查询
        query_result = self._vector_store.query(query)
        
        # 从 docstore 获取节点
        nodes = self._docstore.get_nodes(node_ids=...)
        
        return self._convert_nodes_to_scored_nodes(query_result)
```

**Index 创建 Retriever**：
```python
class VectorStoreIndex(BaseIndex):
    def as_retriever(self, **kwargs: Any) -> BaseRetriever:
        """Index 工厂方法创建对应的 Retriever"""
        from llama_index.core.indices.vector_store.retrievers import VectorIndexRetriever
        
        return VectorIndexRetriever(
            self,  # 传入自身（Index）
            node_ids=list(self.index_struct.nodes_dict.values()),
            **kwargs
        )
```

#### 2.2 多 Index 关系（1:N）

通过 **RouterRetriever** 或 **QueryFusionRetriever** 实现：

```python
# 创建多个 Index
index1 = VectorStoreIndex.from_documents(docs1)
index2 = VectorStoreIndex.from_documents(docs2)
index3 = VectorStoreIndex.from_documents(docs3)

# 创建多个 Retriever（每个对应一个 Index）
retriever1 = index1.as_retriever(similarity_top_k=3)
retriever2 = index2.as_retriever(similarity_top_k=3)
retriever3 = index3.as_retriever(similarity_top_k=3)

# 使用 RouterRetriever 路由到多个 Retriever/Index
from llama_index.core.tools.retriever_tool import RetrieverTool
from llama_index.core.retrievers import RouterRetriever

router_retriever = RouterRetriever.from_defaults(
    retriever_tools=[
        RetrieverTool.from_defaults(
            retriever=retriever1,
            description="Index 1: 文档集 A"
        ),
        RetrieverTool.from_defaults(
            retriever=retriever2,
            description="Index 2: 文档集 B"
        ),
        RetrieverTool.from_defaults(
            retriever=retriever3,
            description="Index 3: 文档集 C"
        ),
    ],
    select_multi=True,  # 可以选择多个
)

# 使用 QueryFusionRetriever 融合多个 Retriever/Index
from llama_index.core.retrievers import QueryFusionRetriever

fusion_retriever = QueryFusionRetriever(
    retrievers=[retriever1, retriever2, retriever3],
    mode="reciprocal_rerank",  # 使用互逆排名融合
    num_queries=3,
)
```

---

### 3. 调用链分析

#### 3.1 标准调用链（Engine → Retriever → Index）

```
用户查询
   │
   ▼
ContextChatEngine.chat(message)
   │
   ├─► _get_nodes(message)
   │      │
   │      └─► self._retriever.retrieve(message)
   │             │
   │             └─► BaseRetriever.retrieve() [统一入口]
   │                    │
   │                    ├─► _retrieve(query_bundle) [子类实现]
   │                    │      │
   │                    │      └─► VectorIndexRetriever._retrieve()
   │                    │             │
   │                    │             ├─► _vector_store.query()
   │                    │             │      │
   │                    │             │      └─► 向量相似度搜索
   │                    │             │
   │                    │             └─► _docstore.get_nodes()
   │                    │                    │
   │                    │                    └─► 返回 NodeWithScore 列表
   │                    │
   │                    └─► _handle_recursive_retrieval()
   │
   └─► _response_synthesizer.synthesize(context, query)
          │
          └─► LLM 生成最终回复
```

#### 3.2 多 Retriever 调用链（RouterRetriever）

```
用户查询
   │
   ▼
Engine.chat(message)
   │
   └─► RouterRetriever.retrieve(message)
          │
          ├─► _selector.select(metadatas, query) [选择 Retriever]
          │      │
          │      └─► LLM 根据描述选择最佳 Retriever
          │
          ├─► selected_retriever.retrieve(query) [执行检索]
          │      │
          │      └─► VectorIndexRetriever._retrieve()
          │             │
          │             └─► index.vector_store.query()
          │
          └─► 返回检索结果
```

#### 3.3 融合检索调用链（QueryFusionRetriever）

```
用户查询
   │
   ▼
Engine.chat(message)
   │
   └─► QueryFusionRetriever.retrieve(message)
          │
          ├─► _get_queries(original_query) [生成多个查询]
          │      │
          │      └─► LLM 生成 3-4 个相关查询
          │
          ├─► 并行执行所有 Retriever
          │      │
          │      ├─► retriever1.retrieve(query1)
          │      ├─► retriever1.retrieve(query2)
          │      ├─► retriever2.retrieve(query1)
          │      └─► retriever2.retrieve(query2)
          │
          ├─► _reciprocal_rerank_fusion(results) [融合结果]
          │      │
          │      └─► 计算 RR 分数并排序
          │
          └─► 返回融合后的 Top-K 结果
```

---

## 🔧 中间层和抽象接口

### 4.1 核心抽象类

**BaseRetriever** - 检索器抽象基类：
```python
class BaseRetriever(PromptMixin, DispatcherSpanMixin):
    """Base retriever."""
    
    @abstractmethod
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        """Retrieve nodes given query. Implemented by the user."""
    
    def retrieve(self, str_or_query_bundle: QueryType) -> List[NodeWithScore]:
        """公共入口：处理回调、事件、递归检索"""
        # 1. 转换查询
        # 2. 触发事件
        # 3. 调用 _retrieve()
        # 4. 处理递归检索
        # 5. 返回结果
```

**BaseIndex** - 索引抽象基类：
```python
class BaseIndex(Generic[IS], ABC):
    """Base LlamaIndex."""
    
    @abstractmethod
    def _build_index_from_nodes(self, nodes, **kwargs) -> IS:
        """Build the index from nodes."""
    
    @abstractmethod
    def _insert(self, nodes, **kwargs) -> None:
        """Index-specific logic for inserting nodes."""
    
    def as_retriever(self, **kwargs) -> BaseRetriever:
        """工厂方法：创建对应的 Retriever"""
```

**BaseQueryEngine** - 查询引擎抽象基类：
```python
class BaseQueryEngine(PromptMixin, DispatcherSpanMixin):
    """Base Query Engine."""
    
    @abstractmethod
    def _query(self, query_bundle: QueryBundle) -> RESPONSE_TYPE:
        """Query implementation."""
    
    def query(self, str_or_query_bundle: QueryType) -> RESPONSE_TYPE:
        """公共入口"""
```

### 4.2 关键接口

**RetrieverTool** - 将 Retriever 包装为工具：
```python
class RetrieverTool(AsyncBaseTool):
    """Tool for using a retriever."""
    
    def __init__(
        self,
        retriever: BaseRetriever,
        metadata: ToolMetadata,
        ...
    ):
        self.retriever = retriever
        self.metadata = metadata  # 描述信息，用于 Router 选择
```

**QueryEngineTool** - 将 QueryEngine 包装为工具：
```python
class QueryEngineTool(AsyncBaseTool):
    """Tool for using a query engine."""
    
    def __init__(
        self,
        query_engine: BaseQueryEngine,
        metadata: ToolMetadata,
        ...
    ):
        self.query_engine = query_engine
```

---

## 💻 代码示例

### 示例 1: 基础 1:1 关系

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.query_engine import RetrieverQueryEngine

# 1. 创建 Index
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents)

# 2. 创建 Retriever（1:1 关系）
retriever = index.as_retriever(similarity_top_k=5)

# 3. 创建 QueryEngine（使用 Retriever）
query_engine = RetrieverQueryEngine(retriever=retriever)

# 4. 查询
response = query_engine.query("什么是机器学习？")
print(response)
```

### 示例 2: 1:N 关系（RouterRetriever）

```python
from llama_index.core import VectorStoreIndex
from llama_index.core.retrievers import RouterRetriever
from llama_index.core.tools.retriever_tool import RetrieverTool

# 1. 创建多个 Index
index1 = VectorStoreIndex.from_documents(docs1)
index2 = VectorStoreIndex.from_documents(docs2)

# 2. 创建多个 Retriever
retriever1 = index1.as_retriever(similarity_top_k=3)
retriever2 = index2.as_retriever(similarity_top_k=3)

# 3. 创建 RouterRetriever（1:N 关系）
router_retriever = RouterRetriever.from_defaults(
    retriever_tools=[
        RetrieverTool.from_defaults(
            retriever=retriever1,
            description="计算机科学论文"
        ),
        RetrieverTool.from_defaults(
            retriever=retriever2,
            description="生物医学文献"
        ),
    ],
    select_multi=True  # 可以选择多个 Retriever
)

# 4. 创建 ChatEngine 使用 RouterRetriever
from llama_index.core.chat_engine import ContextChatEngine

chat_engine = ContextChatEngine.from_defaults(
    retriever=router_retriever,
    system_prompt="你是一个专业的研究助手"
)

# 5. 查询 - 自动路由到合适的 Index
response = chat_engine.chat("量子计算的最新进展")
```

### 示例 3: 1:N 关系（QueryFusionRetriever）

```python
from llama_index.core.retrievers import QueryFusionRetriever

# 1. 创建多个 Retriever（每个对应不同的 Index）
retriever1 = index1.as_retriever(similarity_top_k=5)
retriever2 = index2.as_retriever(similarity_top_k=5)
retriever3 = index3.as_retriever(similarity_top_k=5)

# 2. 创建融合检索器（1:N 关系）
fusion_retriever = QueryFusionRetriever(
    retrievers=[retriever1, retriever2, retriever3],
    mode="reciprocal_rerank",  # 互逆排名融合
    num_queries=4,  # 生成 4 个查询
    similarity_top_k=10,
)

# 3. 创建 QueryEngine
query_engine = RetrieverQueryEngine(retriever=fusion_retriever)

# 4. 查询 - 并行检索所有 Index 并融合结果
response = query_engine.query("人工智能在医疗领域的应用")
```

### 示例 4: SubQuestionQueryEngine（多 QueryEngine 协作）

```python
from llama_index.core.query_engine import SubQuestionQueryEngine
from llama_index.core.tools.query_engine import QueryEngineTool

# 1. 创建多个 QueryEngine（每个有独立的 Retriever 和 Index）
finance_engine = RetrieverQueryEngine(retriever=finance_index.as_retriever())
tech_engine = RetrieverQueryEngine(retriever=tech_index.as_retriever())
bio_engine = RetrieverQueryEngine(retriever=bio_index.as_retriever())

# 2. 包装为工具
finance_tool = QueryEngineTool.from_defaults(
    query_engine=finance_engine,
    description="金融领域数据"
)
tech_tool = QueryEngineTool.from_defaults(
    query_engine=tech_engine,
    description="科技领域数据"
)
bio_tool = QueryEngineTool.from_defaults(
    query_engine=bio_engine,
    description="生物领域数据"
)

# 3. 创建 SubQuestionQueryEngine
sub_q_engine = SubQuestionQueryEngine.from_defaults(
    query_engine_tools=[finance_tool, tech_tool, bio_tool]
)

# 4. 查询 - 自动分解为子问题并分发到不同 Engine
response = sub_q_engine.query(
    "比较人工智能在金融、科技和生物领域的发展现状"
)
```

---

## 🎓 架构设计意图

### 5.1 分层设计优势

1. **关注点分离**
   - Index 层：负责数据存储和索引构建
   - Retriever 层：负责检索策略和算法
   - Engine 层：负责对话管理和响应生成

2. **灵活组合**
   - 同一个 Index 可以创建多个不同类型的 Retriever
   - 同一个 Retriever 可以用于多个不同的 Engine
   - Engine 可以动态切换 Retriever

3. **可扩展性**
   - 新增 Index 类型只需继承 BaseIndex
   - 新增检索策略只需继承 BaseRetriever
   - 新增对话模式只需继承 BaseChatEngine

### 5.2 设计模式应用

1. **工厂模式**
   ```python
   index.as_retriever()  # Index 工厂方法创建 Retriever
   ```

2. **策略模式**
   ```python
   QueryFusionRetriever(mode="reciprocal_rerank")  # 可切换融合策略
   ```

3. **装饰器模式**
   ```python
   RetrieverQueryEngine(
       retriever=retriever,
       node_postprocessors=[postprocessor1, postprocessor2]
   )
   ```

4. **组合模式**
   ```python
   RouterRetriever(retriever_tools=[...])  # 组合多个 Retriever
   ```

---

## 📋 完整性检查清单

- [x] ER 关系图（Mermaid 格式）
- [x] 架构层次分析
- [x] 调用链追踪
- [x] 代码示例（4 个场景）
- [x] 设计意图分析
- [x] 中间层和抽象接口说明

---

## 🏷️ 项目标签

| 级别 | 标签 |
|------|------|
| **一级** | RAG, Data, Dev-Tool |
| **二级** | Vector-DB, Index, Query-Engine, Retrieval |
| **三级** | Dev-Tool, Production, Enterprise |

---

**研究版本**: 1.0
**完整性评分**: 95%
**最后更新**: 2026-03-06
