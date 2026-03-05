# LlamaIndex Retriever 深度调研

> **调研日期**: 2026-03-05  
> **源码版本**: LlamaIndex v0.12.x (main branch)  
> **核心源码**: [`llama-index-core/llama_index/core/base/base_retriever.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/base/base_retriever.py)

---

## 一、问题背景

### 1.1 困惑点

在使用 LlamaIndex 时，官方文档展示了多种查询方式：

**方式 1：Index 直接查询**
```python
index = VectorStoreIndex.from_documents(documents)
response = index.query("你的问题")
```

**方式 2：Retriever 查询**
```python
retriever = index.as_retriever(similarity_top_k=5)
nodes = retriever.retrieve("你的问题")
```

**方式 3：QueryEngine 查询**
```python
query_engine = index.as_query_engine()
response = query_engine.query("你的问题")
```

**问题**：
1. 这三种方式有什么区别？
2. Retriever 的作用是什么？
3. 为什么需要 Retriever？

---

## 二、核心概念解析

### 2.1 三层架构

LlamaIndex 的查询流程分为**三层**：

```
┌─────────────────────────────────────────┐
│  Query Engine (查询引擎)                │
│  - 接收自然语言查询                      │
│  - 返回丰富响应（答案 + 引用）            │
│  - 包含：Retriever + ResponseSynthesizer │
└─────────────────────────────────────────┘
              ↓ 使用
┌─────────────────────────────────────────┐
│  Retriever (检索器)                     │
│  - 从 Index 中检索相关 nodes             │
│  - 返回 nodes 列表                       │
│  - 不包含 LLM 生成答案                    │
└─────────────────────────────────────────┘
              ↓ 基于
┌─────────────────────────────────────────┐
│  Index (索引)                           │
│  - 存储和管理数据                        │
│  - 提供检索接口                          │
│  - 决定数据结构和存储方式                 │
└─────────────────────────────────────────┘
```

---

### 2.2 核心区别

| 组件 | 输入 | 输出 | 是否包含 LLM | 职责 |
|------|------|------|-------------|------|
| **Index** | - | - | ❌ | 数据存储和组织 |
| **Retriever** | 查询字符串 | List[Node] | ❌ | 检索相关 nodes |
| **QueryEngine** | 查询字符串 | Response (答案 + 引用) | ✅ | 检索 + 生成答案 |

---

## 三、源码分析

### 3.1 BaseRetriever 接口

**源码**: [`llama-index-core/llama_index/core/base/base_retriever.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/base/base_retriever.py)

```python
# 源码位置：llama-index-core/llama_index/core/base/base_retriever.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/base/base_retriever.py

from abc import abstractmethod
from typing import List, Optional
from llama_index.core.schema import BaseNode, NodeWithScore, QueryBundle

class BaseRetriever:
    """
    检索器基类
    
    核心职责：从 Index 中检索相关 nodes
    """
    
    @abstractmethod
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        """
        抽象方法：子类必须实现
        
        参数：
        - query_bundle: 查询对象（包含查询字符串和 embedding）
        
        返回：
        - List[NodeWithScore]: 带分数的节点列表
        """
        pass
    
    def retrieve(self, query_str: str) -> List[NodeWithScore]:
        """
        公开方法：检索 nodes
        
        流程：
        1. 将查询字符串转为 QueryBundle
        2. 调用 _retrieve 执行实际检索
        3. 返回 nodes 列表
        """
        query_bundle = QueryBundle(query_str=query_str)
        return self._retrieve(query_bundle)
    
    async def aretrieve(self, query_str: str) -> List[NodeWithScore]:
        """异步版本"""
        pass
```

**关键点**：
- `retrieve()` 返回 **List[NodeWithScore]**（节点列表）
- **不包含 LLM 生成答案**
- 只负责检索，不负责合成响应

---

### 3.2 VectorIndexRetriever 实现

**源码**: [`llama-index-core/llama_index/core/indices/vector_store/retrievers/retriever.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/vector_store/retrievers/retriever.py)

```python
# 源码位置：llama-index-core/llama_index/core/indices/vector_store/retrievers/retriever.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/vector_store/retrievers/retriever.py

from llama_index.core.base.base_retriever import BaseRetriever
from llama_index.core.schema import NodeWithScore, QueryBundle
from typing import List, Optional

class VectorIndexRetriever(BaseRetriever):
    """
    向量索引检索器
    
    从 VectorStoreIndex 中检索相关 nodes
    """
    
    def __init__(
        self,
        index: "VectorStoreIndex",
        similarity_top_k: int = 2,
        vector_store_query_mode: str = "default",
        filters: Optional[MetadataFilters] = None,
    ):
        self._index = index
        self._similarity_top_k = similarity_top_k
        self._vector_store_query_mode = vector_store_query_mode
        self._filters = filters
    
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        """
        实现 BaseRetriever 的抽象方法
        
        流程：
        1. 从 index 获取 vector_store
        2. 生成查询 embedding
        3. 执行相似度搜索
        4. 返回 top_k nodes
        """
        vector_store = self._index.vector_store
        
        # 生成查询 embedding
        query_embedding = self._get_query_embedding(query_bundle.query_str)
        
        # 执行相似度搜索
        query_result = vector_store.query(
            query_embedding=query_embedding,
            top_k=self._similarity_top_k,
            mode=self._vector_store_query_mode,
            filters=self._filters,
        )
        
        # 转为 NodeWithScore 列表
        nodes_with_scores = []
        for node_with_score in query_result.nodes:
            nodes_with_scores.append(
                NodeWithScore(
                    node=node_with_score.node,
                    score=node_with_score.score,
                )
            )
        
        return nodes_with_scores
```

**关键点**：
- `VectorIndexRetriever` 是 `BaseRetriever` 的子类
- 实现了 `_retrieve()` 抽象方法
- 从 `vector_store` 中检索 nodes
- **仍然不包含 LLM 生成答案**

---

### 3.3 Index 与 Retriever 的关系

**源码**: [`llama-index-core/llama_index/core/indices/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/base.py)

```python
# Index 类中的 as_retriever 方法
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/base.py

class BaseIndex:
    """索引基类"""
    
    def as_retriever(self, **kwargs) -> BaseRetriever:
        """
        创建检索器
        
        返回：
        - BaseRetriever: 检索器实例
        """
        # 默认返回该 Index 对应的 Retriever
        # 例如：VectorStoreIndex 返回 VectorIndexRetriever
        return self._default_retriever_class(index=self, **kwargs)
```

**关键点**：
- `index.as_retriever()` 创建并返回 Retriever
- Retriever **基于 Index 构建**
- Retriever **持有 Index 的引用**
- Retriever 调用 Index 的 `vector_store.query()` 执行检索

---

### 3.4 QueryEngine 与 Retriever 的关系

**源码**: [`llama-index-core/llama_index/core/query_engine/retriever_query_engine.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/query_engine/retriever_query_engine.py)

```python
# 源码位置：llama-index-core/llama_index/core/query_engine/retriever_query_engine.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/query_engine/retriever_query_engine.py

from llama_index.core.base.base_retriever import BaseRetriever
from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.response_synthesizers import BaseResponseSynthesizer
from typing import List, Optional

class RetrieverQueryEngine(BaseQueryEngine):
    """
    基于 Retriever 的查询引擎
    
    这是最常用的 QueryEngine 类型
    """
    
    def __init__(
        self,
        retriever: BaseRetriever,
        response_synthesizer: Optional[BaseResponseSynthesizer] = None,
        node_postprocessors: Optional[List[BaseNodePostprocessor]] = None,
    ):
        self._retriever = retriever
        self._response_synthesizer = response_synthesizer
        self._node_postprocessors = node_postprocessors
    
    def _query(self, query_bundle: QueryBundle) -> Response:
        """
        查询流程
        
        1. 使用 Retriever 检索 nodes
        2. 后处理 nodes（可选）
        3. 使用 ResponseSynthesizer 生成答案
        """
        # Step 1: 检索 nodes
        nodes = self._retriever.retrieve(query_bundle)
        
        # Step 2: 后处理（可选）
        if self._node_postprocessors:
            for postprocessor in self._node_postprocessors:
                nodes = postprocessor.postprocess_nodes(nodes)
        
        # Step 3: 生成答案（使用 LLM）
        response = self._response_synthesizer.synthesize(
            query=query_bundle,
            nodes=nodes,
        )
        
        return response
```

**关键点**：
- `RetrieverQueryEngine` **包含 Retriever**
- 查询流程：`Retriever.retrieve()` → `ResponseSynthesizer.synthesize()`
- **ResponseSynthesizer 使用 LLM 生成答案**
- `index.as_query_engine()` 内部创建 `RetrieverQueryEngine`

---

## 四、三种查询方式对比

### 4.1 方式 1：Index 直接查询

```python
index = VectorStoreIndex.from_documents(documents)
response = index.query("你的问题")
```

**实际执行流程**：
```python
# index.query() 内部实现（简化版）
def query(self, query_str: str):
    # 1. 创建默认 Retriever
    retriever = self.as_retriever()
    
    # 2. 创建默认 ResponseSynthesizer
    response_synthesizer = get_response_synthesizer()
    
    # 3. 创建 RetrieverQueryEngine
    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
    )
    
    # 4. 执行查询
    return query_engine.query(query_str)
```

**特点**：
- ✅ 最简单，适合快速原型
- ❌ 不够灵活，无法自定义 Retriever 和 ResponseSynthesizer
- ❌ 无法复用 Retriever（每次创建新的）

---

### 4.2 方式 2：Retriever 查询

```python
retriever = index.as_retriever(similarity_top_k=5)
nodes = retriever.retrieve("你的问题")
```

**实际执行流程**：
```python
# retriever.retrieve() 内部实现（简化版）
def retrieve(self, query_str: str):
    # 1. 创建 QueryBundle
    query_bundle = QueryBundle(query_str=query_str)
    
    # 2. 调用 _retrieve 执行实际检索
    nodes_with_scores = self._retrieve(query_bundle)
    
    # 3. 返回 nodes 列表（不包含 LLM 生成答案）
    return nodes_with_scores
```

**特点**：
- ✅ 只检索，不生成答案（节省 LLM 成本）
- ✅ 可以复用 Retriever（创建一次，多次使用）
- ✅ 可以自定义后处理逻辑
- ❌ 需要自己处理 nodes（合成答案/展示等）

**使用场景**：
- 只需要检索相关文档，不需要 LLM 生成答案
- 需要自定义答案合成逻辑
- 需要复用 Retriever（如多轮对话）
- 需要检索后处理（如重排序/过滤）

---

### 4.3 方式 3：QueryEngine 查询

```python
query_engine = index.as_query_engine(similarity_top_k=5)
response = query_engine.query("你的问题")
```

**实际执行流程**：
```python
# index.as_query_engine() 内部实现（简化版）
def as_query_engine(self, **kwargs):
    # 1. 创建 Retriever
    retriever = self.as_retriever(**kwargs)
    
    # 2. 创建 ResponseSynthesizer
    response_synthesizer = get_response_synthesizer()
    
    # 3. 创建 RetrieverQueryEngine
    return RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
    )

# query_engine.query() 内部实现（简化版）
def query(self, query_str: str):
    # 1. 检索 nodes
    nodes = self._retriever.retrieve(query_str)
    
    # 2. 生成答案（使用 LLM）
    response = self._response_synthesizer.synthesize(
        query=query_str,
        nodes=nodes,
    )
    
    return response
```

**特点**：
- ✅ 完整流程：检索 + 生成答案
- ✅ 可以自定义 Retriever 和 ResponseSynthesizer
- ✅ 可以添加后处理器（如重排序/过滤）
- ❌ 每次查询都调用 LLM（成本较高）

**使用场景**：
- 需要完整的 RAG 流程（检索 + 生成）
- 需要自定义检索和合成策略
- 生产环境标准用法

---

## 五、Retriever 的核心作用

### 5.1 职责分离

**Retriever 的核心价值**：**职责分离**

```
Index (数据存储)
  ↓
Retriever (检索逻辑)
  ↓
QueryEngine (检索 + 合成)
```

**好处**：
1. **单一职责** - Retriever 只负责检索，不关心答案生成
2. **可复用** - 同一个 Retriever 可以用于多个 QueryEngine
3. **可替换** - 可以轻松切换不同的 Retriever（向量/关键词/混合）
4. **可测试** - 可以独立测试检索逻辑

---

### 5.2 使用场景

#### 场景 1：只检索，不生成

```python
# 只需要检索相关文档，不需要 LLM 生成答案
retriever = index.as_retriever(similarity_top_k=10)
nodes = retriever.retrieve("你的问题")

# 自己处理 nodes
for node in nodes:
    print(f"得分：{node.score}")
    print(f"内容：{node.text[:200]}...")
```

**适用**：
- 文档搜索/推荐
- 人工审核场景
- 节省 LLM 成本

---

#### 场景 2：自定义答案合成

```python
from llama_index.core import RetrieverQueryEngine
from llama_index.core.response_synthesizers import ResponseMode

# 创建 Retriever
retriever = index.as_retriever(similarity_top_k=5)

# 自定义 ResponseSynthesizer
response_synthesizer = get_response_synthesizer(
    response_mode=ResponseMode.REFINE,  # 迭代优化
    streaming=True,  # 流式输出
)

# 创建自定义 QueryEngine
query_engine = RetrieverQueryEngine(
    retriever=retriever,
    response_synthesizer=response_synthesizer,
)

response = query_engine.query("你的问题")
```

**适用**：
- 需要特定答案合成策略
- 需要流式输出
- 需要多轮对话

---

#### 场景 3：多 Retriever 组合

```python
from llama_index.core.retrievers import RecursiveRetriever
from llama_index.core import VectorStoreIndex, KeywordTableIndex

# 创建多个 Retriever
vector_retriever = vector_index.as_retriever()
keyword_retriever = keyword_index.as_retriever()

# 组合 Retriever
recursive_retriever = RecursiveRetriever(
    root_retriever=vector_retriever,
    retriever_dict={
        "vector": vector_retriever,
        "keyword": keyword_retriever,
    },
)

# 使用组合 Retriever
query_engine = RetrieverQueryEngine(
    retriever=recursive_retriever,
)
```

**适用**：
- 混合检索（向量 + 关键词）
- 多索引协作
- 复杂检索场景

---

#### 场景 4：添加后处理器

```python
from llama_index.core import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor

# 创建 Retriever
retriever = index.as_retriever(similarity_top_k=20)

# 添加后处理器（过滤低分 nodes）
postprocessor = SimilarityPostprocessor(similarity_cutoff=0.7)

# 创建 QueryEngine
query_engine = RetrieverQueryEngine(
    retriever=retriever,
    node_postprocessors=[postprocessor],
)

response = query_engine.query("你的问题")
```

**适用**：
- 需要过滤低质量 results
- 需要重排序
- 需要元数据过滤

---

## 六、Retriever 类型

### 6.1 内置 Retriever 类型

| Retriever | 适用 Index | 说明 |
|-----------|-----------|------|
| **VectorIndexRetriever** | VectorStoreIndex | 向量相似度检索 |
| **KeywordTableRetriever** | KeywordTableIndex | 关键词匹配检索 |
| **ListIndexRetriever** | ListIndex | 列表遍历检索 |
| **TreeIndexRetriever** | TreeIndex | 树形层级检索 |
| **KGTableRetriever** | KnowledgeGraphIndex | 知识图谱检索 |
| **PropertyGraphRetriever** | PropertyGraphIndex | 属性图检索 |
| **RecursiveRetriever** | - | 递归检索（组合多个 Retriever） |
| **QueryFusionRetriever** | - | 查询融合（多 Retriever 结果融合） |

---

### 6.2 自定义 Retriever

```python
from llama_index.core.base.base_retriever import BaseRetriever
from llama_index.core.schema import NodeWithScore, QueryBundle
from typing import List

class CustomRetriever(BaseRetriever):
    """
    自定义 Retriever
    
    实现 BaseRetriever 接口
    """
    
    def __init__(self, custom_param: int = 5):
        self.custom_param = custom_param
    
    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        """
        实现抽象方法
        
        必须返回 List[NodeWithScore]
        """
        # 自定义检索逻辑
        # ...
        
        return nodes_with_scores

# 使用
retriever = CustomRetriever(custom_param=10)
query_engine = RetrieverQueryEngine(retriever=retriever)
```

---

## 七、总结

### 7.1 三层架构

```
┌─────────────────────────────────────────┐
│  Query Engine                           │
│  - 接收查询，返回答案                     │
│  - 包含：Retriever + ResponseSynthesizer │
└─────────────────────────────────────────┘
              ↓ 使用
┌─────────────────────────────────────────┐
│  Retriever                              │
│  - 从 Index 检索 nodes                   │
│  - 返回 nodes 列表                       │
└─────────────────────────────────────────┘
              ↓ 基于
┌─────────────────────────────────────────┐
│  Index                                  │
│  - 存储和管理数据                        │
│  - 提供检索接口                          │
└─────────────────────────────────────────┘
```

---

### 7.2 三种查询方式

| 方式 | 代码 | 返回 | 适用场景 |
|------|------|------|---------|
| **Index 直接查询** | `index.query()` | Response | 快速原型 |
| **Retriever 查询** | `retriever.retrieve()` | List[Node] | 只检索/自定义合成 |
| **QueryEngine 查询** | `query_engine.query()` | Response | 生产环境 |

---

### 7.3 Retriever 的核心价值

1. **职责分离** - 检索逻辑与答案生成分离
2. **可复用** - 同一个 Retriever 可以多次使用
3. **可替换** - 可以轻松切换不同的检索策略
4. **可组合** - 可以组合多个 Retriever
5. **可测试** - 可以独立测试检索逻辑

---

### 7.4 推荐使用方式

**生产环境推荐**：
```python
# 1. 创建 Index
index = VectorStoreIndex.from_documents(documents)

# 2. 创建 Retriever（可自定义参数）
retriever = index.as_retriever(
    similarity_top_k=5,
    filters=metadata_filters,
)

# 3. 创建 QueryEngine（可自定义 ResponseSynthesizer 和后处理器）
query_engine = RetrieverQueryEngine(
    retriever=retriever,
    response_synthesizer=get_response_synthesizer(response_mode=ResponseMode.REFINE),
    node_postprocessors=[SimilarityPostprocessor(similarity_cutoff=0.7)],
)

# 4. 查询
response = query_engine.query("你的问题")
```

---

**调研日期**: 2026-03-05  
**源码版本**: LlamaIndex v0.12.x  
**核心源码**:
- [`BaseRetriever`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/base/base_retriever.py)
- [`VectorIndexRetriever`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/vector_store/retrievers/retriever.py)
- [`RetrieverQueryEngine`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/query_engine/retriever_query_engine.py)
