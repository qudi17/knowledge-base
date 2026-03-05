# LlamaIndex Indexes 深度调研

> **调研日期**: 2026-03-05  
> **源码版本**: LlamaIndex v0.12.x (main branch)  
> **核心源码**: [`llama-index-core/llama_index/core/indices/`](https://github.com/run-llama/llama_index/tree/main/llama-index-core/llama_index/core/indices)

---

## 一、Indexes 核心作用

### 1.1 什么是 Index？

**Index（索引）** 是 LlamaIndex 中用于**组织和管理数据**的核心抽象，它决定了：

1. **数据结构** - 如何组织 Nodes（列表/树/向量/图等）
2. **检索方式** - 如何查询数据（相似度搜索/关键词匹配/遍历等）
3. **存储方式** - 如何持久化数据（内存/向量数据库/文档数据库等）

**核心价值**：
- 📊 **结构化数据** - 将原始文档转为 LLM 可理解的索引结构
- 🔍 **高效检索** - 支持多种检索策略（向量/关键词/层级等）
- 💾 **灵活存储** - 支持多种 VectorStore 后端（内存/PostgreSQL/ES 等）

---

### 1.2 Index 与 VectorStore 的关系

**关键区分**：
```
Index (索引层)          VectorStore (存储层)
├─ 决定数据结构        ├─ 决定物理存储
├─ 决定检索逻辑        ├─ 决定向量化方式
└─ 上层抽象            └─ 下层实现

使用方式:
VectorStoreIndex
  └─ 使用 VectorStore 存储 nodes
      ├─ SimpleVectorStore (内存)
      ├─ PGVectorStore (PostgreSQL + pgvector)
      ├─ ElasticsearchStore (Elasticsearch)
      └─ 30+ 其他 VectorStore 实现
```

**源码关系**：
```python
# 源码：llama-index-core/llama_index/core/indices/vector_store/base.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/vector_store/base.py

class VectorStoreIndex(BaseIndex):
    """向量索引"""
    
    def __init__(
        self,
        nodes: List[Node],
        storage_context: StorageContext,
        **kwargs
    ):
        # storage_context 包含 VectorStore
        self._vector_store = storage_context.vector_store
        
        # 插入 nodes 到 VectorStore
        self._insert_nodes(nodes)
    
    def _insert_nodes(self, nodes: List[Node]):
        """将 nodes 插入 VectorStore"""
        self._vector_store.add(nodes)
```

---

## 二、Indexes 类型总览

### 2.1 核心 Indexes（llama-index-core）

**源码**: [`llama-index-core/llama_index/core/indices/__init__.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/__init__.py)

```python
# 导出的所有 Index 类型
__all__ = [
    # 向量索引（最常用）
    "VectorStoreIndex",           # ⭐ 向量相似度检索
    "MultiModalVectorStoreIndex", # 多模态（文本 + 图像）
    
    # 关键词索引
    "KeywordTableIndex",          # 关键词提取 + 匹配
    "SimpleKeywordTableIndex",    # 简单关键词
    "RAKEKeywordTableIndex",      # RAKE 算法提取关键词
    
    # 列表索引
    "ListIndex",                  # 简单列表，顺序遍历
    "SummaryIndex",               # 列表 + 摘要
    
    # 树形索引
    "TreeIndex",                  # 树形层级结构
    
    # 文档摘要索引
    "DocumentSummaryIndex",       # 为每个文档生成摘要
    
    # 知识图谱索引
    "KnowledgeGraphIndex",        # 知识图谱（实体 + 关系）
    "PropertyGraphIndex",         # 属性图索引
    
    # 特殊用途索引
    "PandasIndex",                # Pandas DataFrame 索引
    "SQLStructStoreIndex",        # SQL 数据库索引
    "EmptyIndex",                 # 空索引（手动管理 nodes）
    
    # 图索引（可组合多个 Indexes）
    "ComposableGraph",            # 可组合图
]
```

---

### 2.2 详细分类

| Index 类型 | 核心 Indexes | 数量 |
|-----------|-------------|------|
| **向量索引** | VectorStoreIndex, MultiModalVectorStoreIndex | 2 |
| **关键词索引** | KeywordTableIndex, SimpleKeywordTableIndex, RAKEKeywordTableIndex | 3 |
| **列表索引** | ListIndex, SummaryIndex | 2 |
| **树形索引** | TreeIndex | 1 |
| **文档摘要索引** | DocumentSummaryIndex | 1 |
| **知识图谱索引** | KnowledgeGraphIndex, PropertyGraphIndex | 2 |
| **特殊用途索引** | PandasIndex, SQLStructStoreIndex, EmptyIndex | 3 |
| **图索引** | ComposableGraph | 1 |
| **总计** | - | **15** |

---

## 三、核心 Indexes 详解

### 3.1 VectorStoreIndex ⭐ 最常用

**源码**: [`llama-index-core/llama_index/core/indices/vector_store/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/vector_store/base.py)

**作用**：基于向量相似度检索

**使用场景**：
- ✅ 语义搜索
- ✅ RAG 应用
- ✅ 通用检索任务

**使用示例**：
```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.core.storage import StorageContext

# 加载文档
documents = SimpleDirectoryReader("./data").load_data()

# 方式 1：内存存储（默认）
index = VectorStoreIndex.from_documents(documents)

# 方式 2：PostgreSQL + pgvector
vector_store = PGVectorStore.from_params(
    database="mydb",
    host="localhost",
    user="myuser",
    password="mypassword",
    table_name="embeddings",
)
storage_context = StorageContext.from_defaults(vector_store=vector_store)
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# 方式 3：Elasticsearch
from llama_index.vector_stores.elasticsearch import ElasticsearchStore
vector_store = ElasticsearchStore(
    index_name="my_index",
    es_url="http://localhost:9200",
    es_user="elastic",
    es_password="password",
)
storage_context = StorageContext.from_defaults(vector_store=vector_store)
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# 查询
query_engine = index.as_query_engine()
response = query_engine.query("你的问题")
```

**支持的 VectorStore**：
- ✅ **SimpleVectorStore** - 内存存储（默认）
- ✅ **PGVectorStore** - PostgreSQL + pgvector
- ✅ **ElasticsearchStore** - Elasticsearch
- ✅ **ChromaVectorStore** - ChromaDB
- ✅ **MilvusVectorStore** - Milvus
- ✅ **QdrantVectorStore** - Qdrant
- ✅ **WeaviateVectorStore** - Weaviate
- ✅ **PineconeVectorStore** - Pinecone
- ✅ **RedisVectorStore** - Redis
- ✅ **30+ 其他 VectorStore**

---

### 3.2 KeywordTableIndex（关键词索引）

**源码**: [`llama-index-core/llama_index/core/indices/keyword_table/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/keyword_table/base.py)

**作用**：提取关键词，基于关键词匹配检索

**使用场景**：
- ✅ 精确关键词匹配
- ✅ 术语/专有名词检索
- ✅ 补充向量检索的不足

**使用示例**：
```python
from llama_index.core import KeywordTableIndex, SimpleDirectoryReader

documents = SimpleDirectoryReader("./data").load_data()

# 创建关键词索引
index = KeywordTableIndex.from_documents(documents)

# 查询（关键词匹配）
query_engine = index.as_query_engine()
response = query_engine.query("Python 安装")  # 匹配包含"Python"和"安装"的文档
```

**变体**：
- `SimpleKeywordTableIndex` - 简单关键词提取
- `RAKEKeywordTableIndex` - 使用 RAKE 算法提取关键词

---

### 3.3 ListIndex（列表索引）

**源码**: [`llama-index-core/llama_index/core/indices/list/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/list/base.py)

**作用**：简单列表，顺序遍历所有 nodes

**使用场景**：
- ✅ 小型文档集
- ✅ 需要遍历全部内容的场景
- ✅ 测试/原型开发

**使用示例**：
```python
from llama_index.core import ListIndex, SimpleDirectoryReader

documents = SimpleDirectoryReader("./data").load_data()

# 创建列表索引
index = ListIndex.from_documents(documents)

# 查询（遍历所有 nodes）
query_engine = index.as_query_engine()
response = query_engine.query("总结所有内容")
```

---

### 3.4 TreeIndex（树形索引）

**源码**: [`llama-index-core/llama_index/core/indices/tree/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/tree/base.py)

**作用**：构建树形层级结构，自顶向下检索

**使用场景**：
- ✅ 长文档/书籍
- ✅ 需要层级摘要的场景
- ✅ 多粒度检索

**使用示例**：
```python
from llama_index.core import TreeIndex, SimpleDirectoryReader

documents = SimpleDirectoryReader("./data").load_data()

# 创建树形索引
index = TreeIndex.from_documents(
    documents,
    num_children=2,  # 每个节点 2 个子节点
)

# 查询（自顶向下遍历）
query_engine = index.as_query_engine()
response = query_engine.query("第三章讲了什么？")
```

---

### 3.5 DocumentSummaryIndex（文档摘要索引）

**源码**: [`llama-index-core/llama_index/core/indices/document_summary/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/document_summary/base.py)

**作用**：为每个文档生成摘要，基于摘要检索

**使用场景**：
- ✅ 长文档快速筛选
- ✅ 文档级检索（非 chunk 级）
- ✅ 减少 token 消耗

**使用示例**：
```python
from llama_index.core import DocumentSummaryIndex, SimpleDirectoryReader
from llama_index.llms.openai import OpenAI

documents = SimpleDirectoryReader("./data").load_data()

# 创建文档摘要索引
index = DocumentSummaryIndex.from_documents(
    documents,
    llm=OpenAI(model="gpt-4o"),
)

# 查询（基于摘要检索）
query_engine = index.as_query_engine()
response = query_engine.query("哪些文档提到了 RAG？")
```

---

### 3.6 KnowledgeGraphIndex（知识图谱索引）

**源码**: [`llama-index-core/llama_index/core/indices/knowledge_graph/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/knowledge_graph/base.py)

**作用**：构建知识图谱（实体 + 关系），支持图遍历检索

**使用场景**：
- ✅ 实体关系查询
- ✅ 多跳推理
- ✅ 结构化知识检索

**使用示例**：
```python
from llama_index.core import KnowledgeGraphIndex, SimpleDirectoryReader
from llama_index.llms.openai import OpenAI

documents = SimpleDirectoryReader("./data").load_data()

# 创建知识图谱索引
index = KnowledgeGraphIndex.from_documents(
    documents,
    llm=OpenAI(model="gpt-4o"),
    max_triplets_per_chunk=3,  # 每个 chunk 提取 3 个三元组
)

# 查询（图遍历）
query_engine = index.as_query_engine()
response = query_engine.query("张三和李四有什么关系？")
```

---

### 3.7 PropertyGraphIndex（属性图索引）⭐ 新版图谱

**源码**: [`llama-index-core/llama_index/core/indices/property_graph/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/property_graph/base.py)

**作用**：属性图索引（支持节点属性/关系属性）

**使用场景**：
- ✅ 复杂关系建模
- ✅ 属性过滤检索
- ✅ 图数据库集成

**使用示例**：
```python
from llama_index.core import PropertyGraphIndex, SimpleDirectoryReader
from llama_index.graph_stores.neo4j import Neo4jGraphStore

documents = SimpleDirectoryReader("./data").load_data()

# 使用 Neo4j 存储图谱
graph_store = Neo4jGraphStore(
    username="neo4j",
    password="password",
    database="neo4j",
)

# 创建属性图索引
index = PropertyGraphIndex.from_documents(
    documents,
    graph_store=graph_store,
)

# 查询
query_engine = index.as_query_engine()
response = query_engine.query("找出所有北京的公司")
```

---

### 3.8 PandasIndex（Pandas 索引）

**源码**: [`llama-index-core/llama_index/core/indices/pandas/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/pandas/base.py)

**作用**：Pandas DataFrame 索引，支持 SQL 式查询

**使用场景**：
- ✅ 结构化数据分析
- ✅ 表格数据问答
- ✅ 数据探索

**使用示例**：
```python
import pandas as pd
from llama_index.core import PandasIndex

# 创建 DataFrame
df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie"],
    "age": [25, 30, 35],
    "city": ["New York", "London", "Tokyo"]
})

# 创建 Pandas 索引
index = PandasIndex(df)

# 查询（SQL 式）
query_engine = index.as_query_engine()
response = query_engine.query("找出年龄大于 30 的人")
# 输出：Bob (30), Charlie (35)
```

---

### 3.9 SQLStructStoreIndex（SQL 索引）

**源码**: [`llama-index-core/llama_index/core/indices/struct_store/sql.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/struct_store/sql.py)

**作用**：SQL 数据库索引，LLM 生成 SQL 查询

**使用场景**：
- ✅ 关系型数据库问答
- ✅ 业务数据查询
- ✅ BI 报表生成

**使用示例**：
```python
from sqlalchemy import create_engine
from llama_index.core import SQLStructStoreIndex, ServiceContext

# 创建数据库连接
engine = create_engine("sqlite:///my_database.db")

# 创建 SQL 索引
index = SQLStructStoreIndex.from_documents(
    documents=[],  # SQL 索引不需要 documents
    service_context=ServiceContext.from_defaults(),
    sql_database=sql_database,
)

# 查询（LLM 生成 SQL）
query_engine = index.as_query_engine()
response = query_engine.query("上个月销售额最高的产品是什么？")
# LLM 生成：SELECT product_name, SUM(sales) FROM sales WHERE ... GROUP BY ... ORDER BY ... DESC LIMIT 1
```

---

### 3.10 EmptyIndex（空索引）

**源码**: [`llama-index-core/llama_index/core/indices/empty/base.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/empty/base.py)

**作用**：空索引，手动管理 nodes

**使用场景**：
- ✅ 自定义检索逻辑
- ✅ 外部数据源集成
- ✅ 测试/调试

**使用示例**：
```python
from llama_index.core import EmptyIndex, TextNode

# 创建空索引
index = EmptyIndex()

# 手动添加 nodes
nodes = [
    TextNode(text="内容 1"),
    TextNode(text="内容 2"),
]
index.insert_nodes(nodes)

# 自定义检索
# ...
```

---

### 3.11 MultiModalVectorStoreIndex（多模态索引）

**作用**：支持文本 + 图像的多模态检索

**使用场景**：
- ✅ 图文混合检索
- ✅ 视觉问答（VQA）
- ✅ 多模态 RAG

**使用示例**：
```python
from llama_index.core import MultiModalVectorStoreIndex
from llama_index.core.schema import ImageNode, TextNode

# 创建多模态 nodes
nodes = [
    ImageNode(image="image1.jpg", text="图片 1 的描述"),
    TextNode(text="纯文本内容"),
]

# 创建多模态索引
index = MultiModalVectorStoreIndex(nodes=nodes)

# 查询（文本→图像检索）
query_engine = index.as_query_engine()
response = query_engine.query("找出发票图片")
```

---

### 3.12 SummaryIndex（摘要索引）

**作用**：ListIndex + 自动摘要

**使用场景**：
- ✅ 长文档摘要
- ✅ 快速预览
- ✅ 减少 token 消耗

---

### 3.13 ComposableGraph（可组合图）

**作用**：组合多个 Indexes，支持路由检索

**使用场景**：
- ✅ 异构数据源
- ✅ 多索引协作
- ✅ 复杂检索场景

**使用示例**：
```python
from llama_index.core import (
    VectorStoreIndex,
    KeywordTableIndex,
    ComposableGraph,
)

# 创建多个索引
vector_index = VectorStoreIndex.from_documents(docs1)
keyword_index = KeywordTableIndex.from_documents(docs2)

# 组合成图
graph = ComposableGraph.from_indices(
    [vector_index, keyword_index],
)

# 查询（自动路由）
query_engine = graph.as_query_engine()
response = query_engine.query("你的问题")
```

---

## 四、VectorStore 存储后端

### 4.1 支持的 VectorStore 总览

**LlamaIndex 支持 30+ VectorStore**，分为：

| 类型 | VectorStore | 说明 |
|------|-----------|------|
| **内存** | SimpleVectorStore | 默认，适合测试/小数据 |
| **关系型 + 向量** | PGVectorStore | PostgreSQL + pgvector ⭐ |
| **搜索引擎** | ElasticsearchStore | Elasticsearch ⭐ |
| **专用向量库** | ChromaVectorStore | ChromaDB |
| **专用向量库** | MilvusVectorStore | Milvus |
| **专用向量库** | QdrantVectorStore | Qdrant |
| **专用向量库** | WeaviateVectorStore | Weaviate |
| **专用向量库** | PineconeVectorStore | Pinecone（云服务） |
| **缓存/内存** | RedisVectorStore | Redis |
| **云原生** | AzureAISearchVectorStore | Azure AI Search |
| **云原生** | GoogleCloudVectorSearch | Google Cloud |
| **其他** | 20+ 其他 | 见下方完整列表 |

---

### 4.2 PostgreSQL + pgvector ⭐ 推荐

**源码**: [`llama-index-integrations/vector_stores/llama-index-vector-stores-postgres`](https://github.com/run-llama/llama_index/tree/main/llama-index-integrations/vector_stores/llama-index-vector-stores-postgres)

**安装**：
```bash
pip install llama-index-vector-stores-postgres
```

**使用示例**：
```python
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.core import VectorStoreIndex, StorageContext

# 创建 PGVectorStore
vector_store = PGVectorStore.from_params(
    database="mydb",
    host="localhost",
    port=5432,
    user="myuser",
    password="mypassword",
    table_name="embeddings",
    schema_name="public",
    embed_dim=1536,  # OpenAI embedding 维度
)

# 创建存储上下文
storage_context = StorageContext.from_defaults(vector_store=vector_store)

# 创建索引
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# 查询
query_engine = index.as_query_engine()
response = query_engine.query("你的问题")
```

**高级功能**：
```python
# 混合搜索（向量 + 全文）
vector_store = PGVectorStore.from_params(
    ...
    hybrid_search=True,  # 启用混合搜索
    text_search_config="english",  # 全文搜索语言
)

# 元数据过滤
from llama_index.core.vector_stores.types import MetadataFilters, MetadataFilter

filters = MetadataFilters(
    filters=[
        MetadataFilter(key="category", value="technical", operator="=="),
    ]
)

query_engine = index.as_query_engine(filters=filters)
```

**表结构**：
```sql
-- PGVectorStore 自动创建的表
CREATE TABLE embeddings (
    id UUID PRIMARY KEY,
    text TEXT,
    metadata JSONB,
    embedding vector(1536),  -- pgvector 类型
    created_at TIMESTAMP
);

-- HNSW 索引（加速相似度搜索）
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);
```

---

### 4.3 Elasticsearch ⭐ 推荐

**源码**: [`llama-index-integrations/vector_stores/llama-index-vector-stores-elasticsearch`](https://github.com/run-llama/llama_index/tree/main/llama-index-integrations/vector_stores/llama-index-vector-stores-elasticsearch)

**安装**：
```bash
pip install llama-index-vector-stores-elasticsearch
```

**使用示例**：
```python
from llama_index.vector_stores.elasticsearch import ElasticsearchStore
from llama_index.core import VectorStoreIndex, StorageContext

# 创建 ElasticsearchStore
vector_store = ElasticsearchStore(
    index_name="my_index",
    es_url="http://localhost:9200",
    es_user="elastic",
    es_password="password",
    embedding_dimension=1536,
)

# 创建存储上下文
storage_context = StorageContext.from_defaults(vector_store=vector_store)

# 创建索引
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# 查询
query_engine = index.as_query_engine()
response = query_engine.query("你的问题")
```

**高级功能**：
```python
# 自定义查询
vector_store = ElasticsearchStore(
    index_name="my_index",
    es_url="http://localhost:9200",
)

# 使用自定义查询 DSL
custom_query = {
    "query": {
        "script_score": {
            "query": {"match_all": {}},
            "script": {
                "source": "cosineSimilarity(params.queryVector, 'embedding') + 1.0",
                "params": {"queryVector": query_embedding}
            }
        }
    }
}
```

**索引映射**：
```json
{
  "mappings": {
    "properties": {
      "text": { "type": "text" },
      "metadata": { "type": "object" },
      "embedding": {
        "type": "dense_vector",
        "dims": 1536,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}
```

---

### 4.4 完整 VectorStore 列表

**核心集成**（llama-index-integrations/vector_stores）：

| VectorStore | 包名 | 说明 |
|------------|------|------|
| **PostgreSQL** | llama-index-vector-stores-postgres | PostgreSQL + pgvector |
| **Elasticsearch** | llama-index-vector-stores-elasticsearch | Elasticsearch |
| **Chroma** | llama-index-vector-stores-chroma | ChromaDB |
| **Milvus** | llama-index-vector-stores-milvus | Milvus |
| **Qdrant** | llama-index-vector-stores-qdrant | Qdrant |
| **Weaviate** | llama-index-vector-stores-weaviate | Weaviate |
| **Pinecone** | llama-index-vector-stores-pinecone | Pinecone |
| **Redis** | llama-index-vector-stores-redis | Redis |
| **MongoDB** | llama-index-vector-stores-mongodb | MongoDB Atlas |
| **Cassandra** | llama-index-vector-stores-cassandra | Apache Cassandra |
| **ClickHouse** | llama-index-vector-stores-clickhouse | ClickHouse |
| **DashVector** | llama-index-vector-stores-dashvector | 阿里云 DashVector |
| **TencentVectorDB** | llama-index-vector-stores-tencent | 腾讯云 VectorDB |
| **Zilliz** | llama-index-vector-stores-zilliz | Zilliz Cloud |
| **Supabase** | llama-index-vector-stores-supabase | Supabase |
| **Neon** | llama-index-vector-stores-neon | Neon |
| **AstraDB** | llama-index-vector-stores-astradb | DataStax AstraDB |
| **DeepLake** | llama-index-vector-stores-deeplake | Activeloop DeepLake |
| **FAISS** | llama-index-vector-stores-faiss | Facebook FAISS |
| **LanceDB** | llama-index-vector-stores-lancedb | LanceDB |
| **Marqo** | llama-index-vector-stores-marqo | Marqo |
| **MyScale** | llama-index-vector-stores-myscale | MyScale |
| **Opensearch** | llama-index-vector-stores-opensearch | OpenSearch |
| **Rockset** | llama-index-vector-stores-rockset | Rockset |
| **SingleStore** | llama-index-vector-stores-singlestore | SingleStore |
| **Upstash** | llama-index-vector-stores-upstash | Upstash Vector |
| **Vearch** | llama-index-vector-stores-verch | Vearch |
| **Vectara** | llama-index-vector-stores-vectara | Vectara |
| **Xata** | llama-index-vector-stores-xata | Xata |

---

## 五、Index 选择决策树

```
你的需求？
│
├─ 通用语义检索 → VectorStoreIndex ⭐
│   ├─ 小规模/测试 → SimpleVectorStore（内存）
│   ├─ 生产环境 → PGVectorStore（PostgreSQL）⭐
│   ├─ 已有 ES → ElasticsearchStore ⭐
│   └─ 云服务 → Pinecone/Weaviate/Qdrant
│
├─ 关键词匹配 → KeywordTableIndex
│
├─ 长文档/书籍 → TreeIndex
│
├─ 文档级检索 → DocumentSummaryIndex
│
├─ 实体关系查询 → KnowledgeGraphIndex / PropertyGraphIndex
│
├─ 表格数据 → PandasIndex / SQLStructStoreIndex
│
├─ 图文混合 → MultiModalVectorStoreIndex
│
└─ 多索引协作 → ComposableGraph
```

---

## 六、总结

### 6.1 Indexes 核心作用

1. **数据结构化** - 将原始文档转为索引结构
2. **检索优化** - 支持多种检索策略
3. **存储抽象** - 统一接口，多种后端

### 6.2 Indexes 类型

| 类型 | 数量 | 推荐度 |
|------|------|--------|
| 向量索引 | 2 | ⭐⭐⭐ |
| 关键词索引 | 3 | ⭐⭐ |
| 列表索引 | 2 | ⭐ |
| 树形索引 | 1 | ⭐⭐ |
| 文档摘要索引 | 1 | ⭐⭐ |
| 知识图谱索引 | 2 | ⭐⭐ |
| 特殊用途索引 | 3 | ⭐ |
| 图索引 | 1 | ⭐⭐ |
| **总计** | **15** | - |

### 6.3 VectorStore 支持

- ✅ **PostgreSQL + pgvector** - 推荐（已有基础设施）
- ✅ **Elasticsearch** - 推荐（已有基础设施）
- ✅ **30+ 其他 VectorStore** - 按需选择

### 6.4 推荐配置

**通用场景**：
```python
from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.postgres import PGVectorStore

vector_store = PGVectorStore.from_params(...)
index = VectorStoreIndex.from_documents(documents, storage_context=...)
```

**混合检索**：
```python
# VectorStoreIndex + 元数据过滤
query_engine = index.as_query_engine(
    filters=MetadataFilters(...)
)
```

---

**调研日期**: 2026-03-05  
**源码版本**: LlamaIndex v0.12.x  
**核心源码**: [`llama-index-core/llama_index/core/indices/`](https://github.com/run-llama/llama_index/tree/main/llama-index-core/llama_index/core/indices)
