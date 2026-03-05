# LlamaIndex Index 组合 vs Retriever 组合 深度对比

> **调研日期**: 2026-03-05  
> **源码版本**: LlamaIndex v0.12.x (main branch)  
> **核心源码**:
> - [ComposableGraph](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/composability/graph.py)
> - [QueryFusionRetriever](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/fusion_retriever.py)
> - [RecursiveRetriever](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/recursive_retriever.py)

---

## 一、问题背景

### 1.1 困惑点

在使用 LlamaIndex 时，官方文档展示了两种"组合"概念：

**方式 1：Index 组合（ComposableGraph）**
```python
from llama_index.core import ComposableGraph, SummaryIndex, VectorStoreIndex

# 创建多个子 Index
index1 = VectorStoreIndex.from_documents(docs1)
index2 = VectorStoreIndex.from_documents(docs2)

# 组合多个 Index
graph = ComposableGraph.from_indices(
    SummaryIndex,
    [index1, index2],
    index_summaries=["索引 1 摘要", "索引 2 摘要"],
)

# 查询
query_engine = graph.as_query_engine()
response = query_engine.query("你的问题")
```

**方式 2：Retriever 组合（QueryFusionRetriever）**
```python
from llama_index.core.retrievers import QueryFusionRetriever

# 创建多个 Retriever
retriever1 = index1.as_retriever(similarity_top_k=5)
retriever2 = index2.as_retriever(similarity_top_k=5)

# 组合多个 Retriever
fusion_retriever = QueryFusionRetriever(
    retrievers=[retriever1, retriever2],
    similarity_top_k=10,
    mode="reciprocal_rerank",  # RRF 融合
)

# 查询
query_engine = RetrieverQueryEngine(retriever=fusion_retriever)
response = query_engine.query("你的问题")
```

**问题**：
1. 这两种组合方式有什么区别？
2. 各自的使用场景是什么？
3. 应该选择哪种方式？

---

## 二、核心概念解析

### 2.1 组合层次对比

| 维度 | Index 组合 (ComposableGraph) | Retriever 组合 (FusionRetriever) |
|------|---------------------------|--------------------------------|
| **组合对象** | Index（索引） | Retriever（检索器） |
| **组合层次** | 上层（Index 层） | 下层（Retriever 层） |
| **查询流程** | 多级路由 → 子 Index 查询 | 并行检索 → 结果融合 |
| **适用场景** | 异构数据/多文档类型 | 混合检索/多检索策略 |

---

### 2.2 架构图对比

**Index 组合（ComposableGraph）**：
```
┌─────────────────────────────────────────┐
│  ComposableGraph (根 Index)             │
│  - SummaryIndex (存储子 Index 摘要)       │
│  - 路由查询到子 Index                     │
└─────────────────────────────────────────┘
              ↓ 路由
    ┌─────────┴─────────┐
    ↓                   ↓
┌─────────┐       ┌─────────┐
│ Index 1 │       │ Index 2 │
│ (Vector)│       │  (KG)   │
└─────────┘       └─────────┘
```

**Retriever 组合（QueryFusionRetriever）**：
```
┌─────────────────────────────────────────┐
│  QueryFusionRetriever                   │
│  - 并行调用多个 Retriever                │
│  - 融合结果（RRF/加权等）                │
└─────────────────────────────────────────┘
              ↓ 并行检索
    ┌─────────┴─────────┐
    ↓                   ↓
┌─────────┐       ┌─────────┐
│Retriever│       │Retriever│
│ (Vector)│       │ (BM25)  │
└─────────┘       └─────────┘
    ↓                   ↓
┌─────────┐       ┌─────────┐
│ Index 1 │       │ Index 2 │
└─────────┘       └─────────┘
```

---

## 三、Index 组合（ComposableGraph）详解

### 3.1 核心原理

**源码**: [`llama-index-core/llama_index/core/indices/composability/graph.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/composability/graph.py)

```python
# 源码位置：llama-index-core/llama_index/core/indices/composability/graph.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/composability/graph.py

from typing import List, Dict, Optional
from llama_index.core.indices.base import BaseIndex

class ComposableGraph(BaseIndex):
    """
    可组合图
    
    将多个 Index 组合成一个图结构，支持层级查询
    
    核心特点：
    1. 根 Index 存储子 Index 的摘要
    2. 查询时先路由到相关子 Index
    3. 支持多级嵌套（子 Index 还可以有子 Index）
    """
    
    def __init__(
        self,
        indices: List[BaseIndex],
        index_summaries: List[str],
        root_index: BaseIndex,
    ):
        self.indices = indices  # 子 Index 列表
        self.index_summaries = index_summaries  # 子 Index 摘要
        self.root_index = root_index  # 根 Index（通常是 SummaryIndex）
        
        # 为每个子 Index 创建摘要文档
        summary_docs = [
            Document(text=summary, metadata={"index_id": idx.index_id})
            for idx, summary in zip(indices, index_summaries)
        ]
        
        # 根 Index 存储摘要
        self.root_index.insert_docs(summary_docs)
    
    @classmethod
    def from_indices(
        cls,
        root_index_class,
        indices: List[BaseIndex],
        index_summaries: List[str],
        **kwargs
    ) -> "ComposableGraph":
        """
        从多个 Index 创建 ComposableGraph
        
        流程：
        1. 创建根 Index（通常是 SummaryIndex）
        2. 为每个子 Index 生成摘要
        3. 将摘要插入根 Index
        4. 建立路由关系
        """
        # 创建根 Index
        root_index = root_index_class.from_documents(
            [Document(text=s) for s in index_summaries]
        )
        
        return cls(
            indices=indices,
            index_summaries=index_summaries,
            root_index=root_index,
        )
    
    def as_query_engine(self, **kwargs):
        """
        创建查询引擎
        
        返回 ComposableGraphQueryEngine
        """
        from llama_index.core.query_engine.composable_graph_query_engine import (
            ComposableGraphQueryEngine,
        )
        
        return ComposableGraphQueryEngine(
            root_index=self.root_index,
            indices=self.indices,
            **kwargs
        )
```

---

### 3.2 查询流程

```python
# ComposableGraphQueryEngine 查询流程（简化版）
class ComposableGraphQueryEngine:
    def __init__(self, root_index, indices, **kwargs):
        self.root_index = root_index
        self.indices = indices
        self.index_map = {idx.index_id: idx for idx in indices}
    
    def query(self, query_str: str):
        """
        查询流程
        
        1. 在根 Index 中检索相关摘要
        2. 根据摘要路由到子 Index
        3. 在子 Index 中执行实际查询
        4. 合成最终答案
        """
        # Step 1: 在根 Index 中检索摘要
        root_response = self.root_index.query(
            query_str,
            response_mode="no_text",  # 只检索，不生成答案
        )
        
        # Step 2: 解析路由信息（获取相关子 Index）
        relevant_indices = self._parse_routing(root_response)
        
        # Step 3: 在子 Index 中查询
        sub_responses = []
        for index_id in relevant_indices:
            index = self.index_map[index_id]
            response = index.query(query_str)
            sub_responses.append(response)
        
        # Step 4: 合成最终答案
        final_response = self._synthesize(sub_responses)
        
        return final_response
```

---

### 3.3 使用示例

#### 场景 1：多文档类型组合

```python
from llama_index.core import (
    ComposableGraph,
    SummaryIndex,
    VectorStoreIndex,
    KnowledgeGraphIndex,
    SimpleDirectoryReader,
)

# 加载不同类型文档
text_docs = SimpleDirectoryReader("./text_data").load_data()
kg_docs = SimpleDirectoryReader("./kg_data").load_data()

# 创建子 Index
vector_index = VectorStoreIndex.from_documents(text_docs)
kg_index = KnowledgeGraphIndex.from_documents(kg_docs)

# 创建 ComposableGraph
graph = ComposableGraph.from_indices(
    SummaryIndex,
    [vector_index, kg_index],
    index_summaries=[
        "技术文档索引：包含产品手册、API 文档等",
        "知识图谱索引：包含实体关系、人物关系等",
    ],
)

# 查询
query_engine = graph.as_query_engine()
response = query_engine.query("产品 A 的技术参数是什么？")
# 自动路由到 vector_index

response = query_engine.query("张三和李四有什么关系？")
# 自动路由到 kg_index
```

---

#### 场景 2：多级层级组合

```python
from llama_index.core import ComposableGraph, SummaryIndex, VectorStoreIndex

# 第一层：部门级 Index
hr_index = VectorStoreIndex.from_documents(hr_docs)
finance_index = VectorStoreIndex.from_documents(finance_docs)
engineering_index = VectorStoreIndex.from_documents(engineering_docs)

# 第二层：公司级 ComposableGraph
company_graph = ComposableGraph.from_indices(
    SummaryIndex,
    [hr_index, finance_index, engineering_index],
    index_summaries=[
        "人力资源文档：员工手册、薪酬政策等",
        "财务文档：报销政策、预算报告等",
        "工程文档：技术规范、代码标准等",
    ],
)

# 第三层：集团级 ComposableGraph（组合多个公司）
subsidiary1_graph = ComposableGraph.from_indices(...)
subsidiary2_graph = ComposableGraph.from_indices(...)

group_graph = ComposableGraph.from_indices(
    SummaryIndex,
    [company_graph, subsidiary1_graph, subsidiary2_graph],
    index_summaries=[
        "总公司文档",
        "子公司 1 文档",
        "子公司 2 文档",
    ],
)

# 查询（自动多级路由）
query_engine = group_graph.as_query_engine()
response = query_engine.query("总公司的薪酬政策是什么？")
# 路由流程：group_graph → company_graph → hr_index
```

---

### 3.4 优缺点分析

**优点**：
- ✅ **层级路由** - 基于摘要自动路由到相关 Index
- ✅ **异构数据** - 可以组合不同类型的 Index（Vector/KG/SQL 等）
- ✅ **多级嵌套** - 支持多层级组合
- ✅ **节省成本** - 只查询相关 Index，避免全量检索

**缺点**：
- ❌ **复杂度高** - 需要维护多个 Index 和摘要
- ❌ **延迟较高** - 多级路由增加查询延迟
- ❌ **摘要质量依赖** - 路由准确性依赖摘要质量
- ❌ **不够灵活** - 无法动态调整组合策略

---

## 四、Retriever 组合详解

### 4.1 QueryFusionRetriever（融合检索）

**源码**: [`llama-index-core/llama_index/core/retrievers/fusion_retriever.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/fusion_retriever.py)

```python
# 源码位置：llama-index-core/llama_index/core/retrievers/fusion_retriever.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/fusion_retriever.py

from typing import List, Optional
from llama_index.core.base.base_retriever import BaseRetriever
from llama_index.core.schema import NodeWithScore, QueryBundle

class QueryFusionRetriever(BaseRetriever):
    """
    查询融合检索器
    
    并行调用多个 Retriever，融合结果
    
    融合模式：
    - reciprocal_rerank: RRF（倒数排名融合）
    - relative_score: 相对分数融合
    - dist_based_score: 基于距离的分数融合
    - simple: 简单拼接
    """
    
    def __init__(
        self,
        retrievers: List[BaseRetriever],
        similarity_top_k: int = 10,
        mode: str = "reciprocal_rerank",  # 融合模式
        num_queries: int = 1,  # 查询生成数量
        retriever_weights: Optional[List[float]] = None,  # Retriever 权重
        verbose: bool = False,
    ):
        self.retrievers = retrievers
        self.similarity_top_k = similarity_top_k
        self.mode = mode
        self.num_queries = num_queries
        self.retriever_weights = retriever_weights or [1.0] * len(retrievers)
    
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        """
        检索流程
        
        1. 并行调用所有 Retriever
        2. 收集所有结果
        3. 融合结果（RRF/加权等）
        4. 返回 top_k nodes
        """
        # Step 1: 并行调用所有 Retriever
        all_results = []
        for retriever, weight in zip(self.retrievers, self.retriever_weights):
            results = retriever.retrieve(query_bundle.query_str)
            # 应用权重
            weighted_results = [
                NodeWithScore(node=r.node, score=r.score * weight)
                for r in results
            ]
            all_results.append(weighted_results)
        
        # Step 2: 融合结果
        if self.mode == "reciprocal_rerank":
            fused_results = self._reciprocal_rerank(all_results)
        elif self.mode == "relative_score":
            fused_results = self._relative_score_fusion(all_results)
        elif self.mode == "dist_based_score":
            fused_results = self._dist_based_fusion(all_results)
        else:
            fused_results = self._simple_fusion(all_results)
        
        # Step 3: 返回 top_k
        return fused_results[:self.similarity_top_k]
    
    def _reciprocal_rerank(self, all_results: List[List[NodeWithScore]]) -> List[NodeWithScore]:
        """
        RRF（Reciprocal Rank Fusion）融合
        
        公式：Score = 1 / (k + rank)
        """
        from collections import defaultdict
        
        # 计算每个 node 的 RRF 分数
        rrf_scores = defaultdict(float)
        node_map = {}
        
        for results in all_results:
            for rank, result in enumerate(results):
                node_id = result.node.node_id
                rrf_scores[node_id] += 1.0 / (60 + rank)  # k=60
                node_map[node_id] = result.node
        
        # 按 RRF 分数排序
        sorted_nodes = sorted(
            rrf_scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        
        return [
            NodeWithScore(node=node_map[node_id], score=score)
            for node_id, score in sorted_nodes
        ]
```

---

### 4.2 使用示例

#### 场景 1：向量 + BM25 混合检索

```python
from llama_index.core import VectorStoreIndex
from llama_index.retrievers.bm25 import BM25Retriever
from llama_index.core.retrievers import QueryFusionRetriever

# 创建向量索引
vector_index = VectorStoreIndex.from_documents(documents)
vector_retriever = vector_index.as_retriever(similarity_top_k=10)

# 创建 BM25 检索器
bm25_retriever = BM25Retriever.from_defaults(
    nodes=vector_index.docstore.get_all_nodes(),
    similarity_top_k=10,
)

# 融合检索器
fusion_retriever = QueryFusionRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    similarity_top_k=15,
    mode="reciprocal_rerank",  # RRF 融合
    retriever_weights=[0.6, 0.4],  # 向量权重 0.6，BM25 权重 0.4
)

# 创建 QueryEngine
query_engine = RetrieverQueryEngine(retriever=fusion_retriever)

# 查询
response = query_engine.query("你的问题")
# 同时使用向量相似度和关键词匹配
```

---

#### 场景 2：多向量库融合

```python
from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.core.retrievers import QueryFusionRetriever

# 创建多个向量索引（不同向量库）
pg_vector_store = PGVectorStore.from_params(...)
pg_index = VectorStoreIndex.from_documents(docs1, storage_context=...)
pg_retriever = pg_index.as_retriever()

chroma_vector_store = ChromaVectorStore(...)
chroma_index = VectorStoreIndex.from_documents(docs2, storage_context=...)
chroma_retriever = chroma_index.as_retriever()

# 融合检索器
fusion_retriever = QueryFusionRetriever(
    retrievers=[pg_retriever, chroma_retriever],
    similarity_top_k=20,
    mode="reciprocal_rerank",
)

# 查询（跨库检索）
query_engine = RetrieverQueryEngine(retriever=fusion_retriever)
response = query_engine.query("你的问题")
```

---

#### 场景 3：查询生成 + 融合

```python
from llama_index.core.retrievers import QueryFusionRetriever

# 启用查询生成（自动改写查询）
fusion_retriever = QueryFusionRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    similarity_top_k=15,
    mode="reciprocal_rerank",
    num_queries=3,  # 生成 3 个变体查询
    use_async=True,  # 异步并行
    verbose=True,
)

# 查询流程：
# 1. 生成 3 个查询变体
#    - "你的问题"
#    - "变体查询 1"
#    - "变体查询 2"
# 2. 每个查询调用 2 个 Retriever
#    - 总共 6 次检索
# 3. 融合所有结果
# 4. 返回 top_15

response = query_engine.query("你的问题")
```

---

### 4.3 RecursiveRetriever（递归检索）

**源码**: [`llama-index-core/llama_index/core/retrievers/recursive_retriever.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/recursive_retriever.py)

```python
# 递归检索器
class RecursiveRetriever(BaseRetriever):
    """
    递归检索器
    
    检索到节点后，如果节点是 IndexNode（包含子 Retriever 引用），
    则递归调用子 Retriever
    
    适用场景：
    - 层级检索（粗粒度 → 细粒度）
    - 父子文档检索
    """
    
    def __init__(
        self,
        root_retriever: BaseRetriever,
        retriever_dict: Dict[str, BaseRetriever],
    ):
        self.root_retriever = root_retriever
        self.retriever_dict = retriever_dict
    
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        """
        递归检索流程
        
        1. 在 root_retriever 中检索
        2. 如果节点是 IndexNode，递归调用子 Retriever
        3. 合并所有结果
        """
        # Step 1: 根检索器检索
        root_results = self.root_retriever.retrieve(query_bundle.query_str)
        
        # Step 2: 递归检索
        all_results = []
        for result in root_results:
            all_results.append(result)
            
            # 检查是否是 IndexNode
            if isinstance(result.node, IndexNode):
                # 获取子 Retriever
                sub_retriever_key = result.node.index_id
                sub_retriever = self.retriever_dict.get(sub_retriever_key)
                
                if sub_retriever:
                    # 递归检索
                    sub_results = sub_retriever.retrieve(query_bundle.query_str)
                    all_results.extend(sub_results)
        
        return all_results
```

---

### 4.4 Retriever 组合优缺点

**优点**：
- ✅ **灵活组合** - 可以组合任意类型的 Retriever
- ✅ **结果融合** - RRF/加权等多种融合策略
- ✅ **并行检索** - 多个 Retriever 并行执行
- ✅ **动态调整** - 可以动态调整权重/融合策略
- ✅ **查询生成** - 自动改写查询提升召回率

**缺点**：
- ❌ **成本较高** - 多次检索增加 LLM/API 调用
- ❌ **延迟较高** - 并行检索 + 融合增加延迟
- ❌ **复杂度** - 需要调优权重/融合策略

---

## 五、核心区别对比

### 5.1 架构层次对比

| 维度 | Index 组合 | Retriever 组合 |
|------|-----------|---------------|
| **抽象层次** | Index 层（上层） | Retriever 层（下层） |
| **组合对象** | Index | Retriever |
| **查询流程** | 路由 → 子 Index 查询 | 并行检索 → 结果融合 |
| **结果处理** | 子 Index 结果合成 | 检索结果融合（RRF 等） |

---

### 5.2 使用场景对比

| 场景 | Index 组合 | Retriever 组合 | 推荐 |
|------|-----------|---------------|------|
| **多文档类型** | ✅ 适合（Vector+KG+SQL） | ⚠️ 可以但不够优雅 | Index 组合 |
| **混合检索** | ❌ 不适合 | ✅ 适合（向量+BM25） | Retriever 组合 |
| **多层级文档** | ✅ 适合（公司→部门→员工） | ⚠️ 可以但复杂 | Index 组合 |
| **多向量库** | ❌ 不适合 | ✅ 适合（PG+Chroma） | Retriever 组合 |
| **节省成本** | ✅ 适合（只查相关 Index） | ❌ 不适合（全量检索） | Index 组合 |
| **提升召回率** | ⚠️ 一般 | ✅ 适合（多检索策略） | Retriever 组合 |
| **快速原型** | ❌ 复杂 | ✅ 简单 | Retriever 组合 |

---

### 5.3 查询流程对比

**Index 组合查询流程**：
```
用户查询
    ↓
[根 Index 检索摘要]
    ↓
[路由决策：选择子 Index]
    ↓
[子 Index 1 查询] → [子 Index 2 查询]
    ↓           ↓
[结果合成]
    ↓
最终答案
```

**Retriever 组合查询流程**：
```
用户查询
    ↓
[Retriever 1 检索] → [Retriever 2 检索]
    ↓           ↓
[结果融合（RRF）]
    ↓
最终 nodes
    ↓
[LLM 生成答案]
    ↓
最终答案
```

---

## 六、组合使用示例

### 6.1 Index 组合 + Retriever 组合

```python
from llama_index.core import ComposableGraph, SummaryIndex, VectorStoreIndex
from llama_index.core.retrievers import QueryFusionRetriever
from llama_index.retrievers.bm25 import BM25Retriever

# 创建子 Index
vector_index = VectorStoreIndex.from_documents(docs1)
kg_index = KnowledgeGraphIndex.from_documents(docs2)

# 为每个 Index 创建混合检索器
vector_bm25_retriever = QueryFusionRetriever(
    retrievers=[
        vector_index.as_retriever(),
        BM25Retriever.from_defaults(nodes=vector_index.docstore.get_all_nodes()),
    ],
    mode="reciprocal_rerank",
)

kg_retriever = kg_index.as_retriever()

# 创建 ComposableGraph
graph = ComposableGraph.from_indices(
    SummaryIndex,
    [vector_index, kg_index],
    index_summaries=["向量索引", "知识图谱索引"],
)

# 自定义 QueryEngine（使用融合检索器）
# 注意：ComposableGraph 默认使用子 Index 的检索器
# 这里演示如何结合两种方式
```

---

### 6.2 推荐配置

**场景 1：企业知识库（多部门 + 混合检索）**
```python
# Index 组合：部门级隔离
hr_index = VectorStoreIndex.from_documents(hr_docs)
finance_index = VectorStoreIndex.from_documents(finance_docs)

# Retriever 组合：每个部门内混合检索
hr_retriever = QueryFusionRetriever([
    hr_index.as_retriever(),
    BM25Retriever.from_defaults(...),
])

graph = ComposableGraph.from_indices(
    SummaryIndex,
    [hr_index, finance_index],
    index_summaries=["人力资源", "财务"],
)
```

**场景 2：多数据源检索**
```python
# Retriever 组合：多向量库融合
pg_retriever = pg_index.as_retriever()
chroma_retriever = chroma_index.as_retriever()

fusion_retriever = QueryFusionRetriever([
    pg_retriever,
    chroma_retriever,
], mode="reciprocal_rerank")
```

---

## 七、总结

### 7.1 核心区别

| 维度 | Index 组合 | Retriever 组合 |
|------|-----------|---------------|
| **本质** | 多 Index 路由 | 多 Retriever 融合 |
| **层次** | 上层（Index 层） | 下层（Retriever 层） |
| **目的** | 异构数据/层级管理 | 提升召回率/混合检索 |
| **查询** | 选择性路由 | 并行全量检索 |
| **成本** | 较低（只查相关） | 较高（全量检索） |
| **灵活性** | 较低（固定路由） | 较高（动态融合） |

---

### 7.2 选择建议

**选择 Index 组合（ComposableGraph）**：
- ✅ 多文档类型（Vector+KG+SQL）
- ✅ 多层级结构（公司→部门→员工）
- ✅ 需要节省检索成本
- ✅ 数据天然隔离（不同 Index）

**选择 Retriever 组合（QueryFusionRetriever）**：
- ✅ 混合检索（向量+BM25）
- ✅ 多向量库融合（PG+Chroma）
- ✅ 提升召回率
- ✅ 快速原型开发

**组合使用**：
- ✅ 复杂场景：Index 组合 + Retriever 组合
- ✅ 每个子 Index 内部使用 Retriever 组合
- ✅ 子 Index 之间使用 Index 组合

---

### 7.3 推荐使用方式

**生产环境推荐**：
```python
# 简单场景：Retriever 组合（混合检索）
fusion_retriever = QueryFusionRetriever([
    vector_retriever,
    bm25_retriever,
], mode="reciprocal_rerank")

# 复杂场景：Index 组合 + Retriever 组合
# 1. 每个子 Index 内部使用 Retriever 组合
# 2. 子 Index 之间使用 Index 组合
```

---

**调研日期**: 2026-03-05  
**源码版本**: LlamaIndex v0.12.x  
**核心源码**:
- [ComposableGraph](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/composability/graph.py)
- [QueryFusionRetriever](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/fusion_retriever.py)
- [RecursiveRetriever](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/recursive_retriever.py)
