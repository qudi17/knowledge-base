# LlamaIndex 架构分析与对比

## 一、LlamaIndex 核心架构

### 1.1 整体设计哲学

**LlamaIndex** 是一个**数据框架（Data Framework）**，专为 LLM 应用设计，核心聚焦于：
- **文档加载** → **索引构建** → **检索查询** → **生成回答**

与 LangChain 的"通用 LLM 编排"不同，LlamaIndex 更专注于**RAG 场景的深度优化**。

---

### 1.2 核心组件架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     LlamaIndex 架构                              │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Data Loaders│ →   │  Ingestion   │ →   │   Indexes    │
│  (连接器)     │     │  Pipeline    │     │  (索引类型)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Transformers│     │  Retrievers  │
                     │  (分块/嵌入)  │     │  (检索器)     │
                     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  Query Engine│
                                          │  (查询引擎)   │
                                          └──────────────┘
```

---

## 二、Ingestion Pipeline（核心）

### 2.1 管道设计

LlamaIndex 的 **Ingestion Pipeline** 是其文档处理的核心，采用**转换链（Transformation Chain）**模式：

```python
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core.storage.docstore import SimpleDocumentStore

# 定义转换链
pipeline = IngestionPipeline(
    transformations=[
        # 1. 文档清洗
        DocCleaner(),
        
        # 2. 智能分块
        SentenceSplitter(
            chunk_size=512,
            chunk_overlap=20,
            separator="\n"
        ),
        
        # 3. 元数据提取
        MetadataExtractor(),
        
        # 4. Embedding 生成
        OpenAIEmbedding(),
    ],
    
    # 文档存储（用于去重）
    docstore=SimpleDocumentStore(),
    
    # 向量存储
    vector_store=vector_store,
)

# 运行管道
nodes = pipeline.run(documents=documents)
```

---

### 2.2 关键设计特点

#### （1）节点（Node）为中心

```python
# LlamaIndex 的核心抽象是 Node，不是 Document
class BaseNode:
    id_: str                      # 节点 ID
    text: str                     # 文本内容
    embedding: Optional[List[float]]  # 向量
    metadata: Dict[str, Any]      # 元数据
    relationships: Dict[NodeType, str]  # 关系（父子/兄弟）
    ref_doc_id: Optional[str]     # 来源文档 ID
```

**设计优势**：
- 统一的中间表示（Document → Node → Index）
- 支持细粒度追踪（每个 chunk 可追溯到源文档）
- 灵活的关系网络（父子/兄弟/引用）

#### （2）去重机制

```python
# Ingestion Pipeline 内置去重
pipeline = IngestionPipeline(
    transformations=[...],
    docstore=SimpleDocumentStore(),  # 关键：用于去重
)

# 去重逻辑：
# 1. 计算文档 hash（基于 doc_id + content hash）
# 2. 检查 docstore 中是否存在
# 3. 如果存在且 hash 未变 → 跳过
# 4. 如果存在但 hash 变了 → 更新（upsert）
# 5. 如果不存在 → 插入

nodes = pipeline.run(documents=documents)  # 自动去重
```

#### （3）可组合的 Transformations

```python
# Transformation 接口
class Transformation:
    def __call__(self, nodes: List[Node], **kwargs) -> List[Node]:
        pass

# 内置 Transformations
transformations = [
    # 分块
    SentenceSplitter(chunk_size=512),
    TokenTextSplitter(),
    SemanticSplitter(),  # 语义分块
    
    # 元数据
    TitleExtractor(),
    QuestionsAnsweredExtractor(),  # 自动生成问题
    SummaryExtractor(),  # 自动生成摘要
    
    # 嵌入
    OpenAIEmbedding(),
    HuggingFaceEmbedding(),
    
    # 自定义
    MyCustomTransformation(),
]
```

---

### 2.3 分块策略（Node Parsing）

```python
from llama_index.core.node_parser import (
    SentenceSplitter,          # 按句子分块
    TokenTextSplitter,         # 按 token 分块
    SemanticSplitter,          # 语义分块（基于 embedding）
    HierarchicalNodeParser,    # 分层分块
    MarkdownNodeParser,        # Markdown 感知
    HTMLNodeParser,            # HTML 感知
    JSONNodeParser,            # JSON 解析
)

# 分层分块示例（适合长文档）
parser = HierarchicalNodeParser.from_defaults(
    chunk_sizes=[8192, 4096, 2048]  # 从大到小三层
)

nodes = parser.get_nodes_from_documents(documents)

# 结果：每个文档生成三层 nodes
# - Level 0: 大块（8192 tokens）- 适合高层摘要
# - Level 1: 中块（4096 tokens）- 适合章节检索
# - Level 2: 小块（2048 tokens）- 适合细节检索
```

---

## 三、索引类型（Indexes）

LlamaIndex 提供多种索引策略，针对不同检索场景：

### 3.1 核心索引类型

| 索引类型 | 用途 | 检索方式 |
|---------|------|---------|
| **VectorStoreIndex** | 向量检索 | 相似度搜索 |
| **KeywordTableIndex** | 关键词检索 | BM25/TF-IDF |
| **ListIndex** | 顺序遍历 | 全部扫描 |
| **TreeIndex** | 分层摘要 | 自顶向下 |
| **KnowledgeGraphIndex** | 关系图谱 | 图遍历 |
| **MultiModalIndex** | 多模态 | 图像 + 文本 |

### 3.2 向量索引示例

```python
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.vector_stores.postgres import PGVectorStore

# 配置向量存储
vector_store = PGVectorStore(
    connection_string="postgresql://...",
    table_name="embeddings"
)

# 创建索引
storage_context = StorageContext.from_defaults(
    vector_store=vector_store
)

index = VectorStoreIndex(
    nodes=nodes,
    storage_context=storage_context,
    embed_model=OpenAIEmbedding()
)

# 查询
query_engine = index.as_query_engine()
response = query_engine.query("你的问题")
```

---

## 四、检索器（Retrievers）

### 4.1 检索策略

```python
from llama_index.core.retrievers import (
    VectorIndexRetriever,        # 向量检索
    KeywordNodeRetriever,        # 关键词检索
    FusionRetriever,             # 混合检索（RRF）
    RecursiveRetriever,          # 递归检索
    AutoMergingRetriever,        # 自动合并
)

# 混合检索示例
vector_retriever = index.as_retriever(similarity_top_k=5)
keyword_retriever = index.as_retriever(retriever_mode="keyword")

from llama_index.retrievers.bm25 import BM25Retriever
bm25_retriever = BM25Retriever.from_defaults(nodes, similarity_top_k=5)

# RRF 融合
from llama_index.core.retrievers import ReciprocalRerankFusionRetriever
fusion_retriever = ReciprocalRerankFusionRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    top_k=10
)
```

### 4.2 高级检索模式

#### （1）递归检索（Recursive Retrieval）

```python
# 场景：检索到段落后，自动获取其父章节
from llama_index.core.retrievers import RecursiveRetriever

retriever = RecursiveRetriever(
    root_retriever=vector_retriever,
    retriever_dict={
        "parent": parent_retriever,
        "sibling": sibling_retriever
    }
)
```

#### （2）自动合并（Auto-Merging）

```python
# 场景：多个小块命中时，自动合并为一个大块
from llama_index.core.retrievers import AutoMergingRetriever

merging_retriever = AutoMergingRetriever(
    vector_retriever,
    storage_context,
    verbose=True
)
```

---

## 五、Query Engine（查询引擎）

### 5.1 查询流程

```
用户查询 → 检索器 → 节点 → 响应合成 → 最终答案
              ↓
         向量/关键词/混合
```

### 5.2 响应合成策略

```python
from llama_index.core.response_synthesizers import (
    ResponseMode,
    get_response_synthesizer
)

# 合成模式
# - default: 简单拼接
# - compact: 压缩上下文
# - refine: 迭代优化
# - tree_summarize: 树形摘要
# - generation: 纯生成

query_engine = index.as_query_engine(
    response_mode=ResponseMode.REFINE,  # 迭代优化
    similarity_top_k=10,
)
```

---

## 六、LlamaParse（商业服务）

### 6.1 文档解析服务

LlamaIndex 提供商业解析服务 **LlamaParse**，支持 130+ 格式：

```python
from llama_parse import LlamaParse

# 解析 PDF
parser = LlamaParse(
    api_key="llx-...",
    result_type="markdown",  # 输出 Markdown
    verbose=True
)

documents = await parser.aload_data("complex_document.pdf")

# 特点：
# - 保留文档结构（标题/表格/列表）
# - 提取表格为 Markdown
# - OCR 支持（扫描件）
# - 多语言支持
```

**定价**：
- 免费版：1000 页/月
- 标准版：$0.003/页
- 企业版：定制

---

## 七、与我们的方案对比

### 7.1 架构对比

| 维度 | LlamaIndex | 我们的方案 |
|------|-----------|-----------|
| **定位** | RAG 框架（通用） | 企业级 RAG 系统（定制） |
| **文档处理** | Ingestion Pipeline | 自研管道 |
| **分块策略** | 多种内置（句子/token/语义） | 智能分块（中文优化） |
| **去重机制** | 内置（docstore） | 自研（Redis+hash） |
| **向量存储** | 支持 30+ 向量库 | PostgreSQL + pgvector |
| **检索策略** | 多种检索器 | 混合检索（向量+ES） |
| **溯源** | 基础（ref_doc_id） | Neo4j 图谱（多跳引用） |
| **外部集成** | 100+ 连接器 | 定制（Confluence/SharePoint） |
| **License** | MIT | 自研（MIT/Apache） |

---

### 7.2 优势对比

#### LlamaIndex 优势

1. **开箱即用** - 100+ 数据源连接器，快速原型
2. **生态丰富** - 30+ 向量库集成，社区活跃
3. **抽象优雅** - Node/Transformation/Index 设计清晰
4. **高级功能** - 递归检索/自动合并/多模态
5. **LlamaParse** - 商业解析服务（省心）

#### 我们的方案优势

1. **基础设施复用** - 基于现有 PostgreSQL/ES/Neo4j/Redis
2. **中文优化** - 分块/检索针对中文场景调优
3. **溯源能力** - Neo4j 图谱支持多跳引用追踪
4. **企业集成** - 深度定制 Confluence/SharePoint
5. **成本控制** - 无商业服务依赖，自建可控
6. **扩展性** - 针对百万级文档优化（pgvector HNSW）

---

### 7.3 劣势对比

#### LlamaIndex 劣势

1. **生产复杂度** - 框架抽象多，调试困难
2. **性能开销** - 通用框架有额外开销
3. **中文支持** - 分块/检索对中文不够优化
4. **商业依赖** - LlamaParse 收费（大规模成本高）
5. **学习曲线** - 概念多（Node/Index/Retriever/QueryEngine）

#### 我们的方案劣势

1. **开发成本** - 需要自研管道（2-3 人月）
2. **生态缺失** - 无社区支持，需自行维护
3. **功能单一** - 专注 RAG，无 Agent/Workflow 能力

---

## 八、借鉴建议

### 8.1 可借鉴的设计

#### （1）Transformation 链模式

```python
# 我们的方案可以借鉴
class Transformation:
    async def __call__(self, chunks: List[Chunk]) -> List[Chunk]:
        pass

# 使用
pipeline = DocumentPipeline(
    transformations=[
        DocCleaner(),
        SmartChunker(),
        QualityFilter(),
        EmbeddingGenerator(),
    ]
)
```

#### （2）Node 抽象

```python
# 统一中间表示
class Chunk:
    id: str
    content: str
    embedding: Optional[List[float]]
    metadata: Dict
    relationships: Dict  # 父子/兄弟关系
    ref_doc_id: str
```

#### （3）去重机制

```python
# 基于 doc_id + hash 的去重
async def should_process(doc_id: str, content: str) -> bool:
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    existing = await db.get_hash(doc_id)
    
    if existing is None:
        return True  # 新文档
    if existing != content_hash:
        return True  # 已更新
    return False  # 未变化，跳过
```

---

### 8.2 不建议借鉴的

#### （1）过度抽象

LlamaIndex 有过多抽象层（Document → Node → Index → Retriever → QueryEngine），对于企业级定制场景，**简单直接**更好。

#### （2）通用性优先

LlamaIndex 为了通用性牺牲了性能，我们的场景明确（企业内部 RAG），应该**场景优先**。

#### （3）商业服务依赖

LlamaParse 虽然方便，但大规模使用成本高（100 万页 ≈ $3000），建议自建解析管道。

---

## 九、推荐策略

### 9.1 混合方案

**建议**：核心架构自研，借鉴 LlamaIndex 的优秀设计。

```
┌─────────────────────────────────────────┐
│  借鉴 LlamaIndex                         │
│  - Transformation 链模式                 │
│  - Node 抽象                            │
│  - 去重机制                              │
│  - 混合检索策略                          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  自研核心                                │
│  - 文档处理管道（中文优化）              │
│  - pgvector 集成                        │
│  - Neo4j 溯源图谱                       │
│  - 企业数据源集成                        │
└─────────────────────────────────────────┘
```

### 9.2 实施建议

**Phase 1**：参考 LlamaIndex 设计自研管道
- 实现 Transformation 接口
- 实现 Node/Chunk 抽象
- 实现去重机制

**Phase 2**：针对中文场景优化
- 中文分块策略（按句子/段落）
- 中文检索优化（拼音/繁简）

**Phase 3**：企业级功能
- Neo4j 溯源图谱
- Confluence/SharePoint 集成
- 权限控制

---

## 十、代码示例

### 10.1 借鉴 LlamaIndex 的自研管道

```python
# src/pipeline.py
from typing import List, Protocol, AsyncIterator

class Chunk:
    """统一中间表示（借鉴 LlamaIndex Node）"""
    def __init__(
        self,
        content: str,
        metadata: dict = None,
        ref_doc_id: str = None,
        relationships: dict = None
    ):
        self.content = content
        self.metadata = metadata or {}
        self.ref_doc_id = ref_doc_id
        self.relationships = relationships or {}
        self.embedding: List[float] = None

class Transformation(Protocol):
    """转换接口（借鉴 LlamaIndex Transformation）"""
    async def __call__(self, chunks: List[Chunk]) -> List[Chunk]:
        pass

class DocumentPipeline:
    """文档处理管道"""
    def __init__(self, transformations: List[Transformation]):
        self.transformations = transformations
        self.docstore = None  # 用于去重
    
    async def run(
        self,
        documents: List[Document]
    ) -> AsyncIterator[Chunk]:
        # 初始转换：Document → Chunk
        chunks = [
            Chunk(
                content=doc.content,
                metadata=doc.metadata,
                ref_doc_id=doc.id
            )
            for doc in documents
        ]
        
        # 应用转换链
        for transform in self.transformations:
            chunks = await transform(chunks)
        
        # 去重检查
        for chunk in chunks:
            if await self.should_process(chunk):
                yield chunk
                await self.mark_processed(chunk)
    
    async def should_process(self, chunk: Chunk) -> bool:
        """检查是否需要处理（去重）"""
        if not self.docstore:
            return True
        
        chunk_hash = self._compute_hash(chunk)
        existing = await self.docstore.get(chunk.ref_doc_id)
        
        if existing is None:
            return True
        if existing['hash'] != chunk_hash:
            return True  # 已更新
        return False  # 未变化
    
    def _compute_hash(self, chunk: Chunk) -> str:
        import hashlib
        return hashlib.sha256(chunk.content.encode()).hexdigest()

# 使用示例
pipeline = DocumentPipeline(
    transformations=[
        DocCleaner(),
        SmartChunker(chunk_size=500),
        QualityFilter(),
        EmbeddingGenerator(),
    ]
)

async for chunk in pipeline.run(documents):
    await store_chunk(chunk)
```

---

## 十一、总结

### LlamaIndex 核心价值

1. **框架抽象** - Node/Transformation/Index 设计优雅
2. **生态丰富** - 100+ 连接器，30+ 向量库
3. **高级功能** - 递归检索/自动合并/多模态
4. **商业服务** - LlamaParse 解析服务

### 我们的选择

**不直接使用 LlamaIndex**，原因：
1. 基础设施已定（PostgreSQL/ES/Neo4j/Redis）
2. 中文场景需要定制优化
3. 企业集成需要深度定制
4. 成本控制（避免商业服务）

**但借鉴优秀设计**：
1. Transformation 链模式
2. Node 抽象
3. 去重机制
4. 混合检索策略

**最终**：自研核心 + 借鉴设计 = 最适合企业场景的 RAG 系统
