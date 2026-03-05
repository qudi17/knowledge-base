# LlamaIndex 文档处理流程详解

## 一、整体流程概览

```
┌─────────────────────────────────────────────────────────────────┐
│              LlamaIndex 文档处理完整流程                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. 文档加载  │ →   │  2. 文档解析  │ →   │  3. 内容分块  │
│  (Loaders)   │     │  (Parsers)   │     │  (Splitters) │
└──────────────┘     └──────────────┘     └──────────────┘
                              │                    │
                              ▼                    ▼
                       ┌──────────────┐     ┌──────────────┐
                       │  4. 元数据   │     │  5. Embedding│
                       │  提取        │     │  生成        │
                       └──────────────┘     └──────────────┘
                              │                    │
                              ▼                    ▼
                       ┌──────────────┐     ┌──────────────┐
                       │  6. 索引构建  │ →   │  7. 检索查询  │
                       │  (Indexes)   │     │  (Query)     │
                       └──────────────┘     └──────────────┘
```

---

## 二、文档加载（Document Loaders）

### 2.1 SimpleDirectoryReader（推荐）

**最常用**的加载器，自动识别文件格式并调用对应解析器。

```python
from llama_index.core import SimpleDirectoryReader

# 加载整个目录
documents = SimpleDirectoryReader(
    input_dir="./data",  # 目录路径
    recursive=True,      # 递归子目录
    required_exts=[".pdf", ".docx", ".xlsx"],  # 只加载这些扩展名
).load_data()

# 结果：List[Document]
for doc in documents:
    print(f"文件：{doc.metadata['file_name']}")
    print(f"类型：{doc.metadata['file_type']}")
    print(f"大小：{doc.metadata['file_size']} bytes")
    print(f"内容预览：{doc.text[:200]}...")
```

**自动识别的文件格式**：
- ✅ PDF (.pdf)
- ✅ Word (.docx, .doc)
- ✅ Excel (.xlsx, .xls)
- ✅ PowerPoint (.pptx)
- ✅ Markdown (.md)
- ✅ HTML (.html)
- ✅ 文本 (.txt)
- ✅ JSON (.json)
- ✅ CSV (.csv)
- ✅ 图片 (.jpg, .png) - 需要 OCR

---

### 2.2 单独加载器

#### （1）PDF 加载器

```python
from llama_index.core import SimpleDirectoryReader

# 方式 1：SimpleDirectoryReader（推荐）
documents = SimpleDirectoryReader(
    input_files=["document.pdf"]
).load_data()

# 方式 2：PDFReader（底层）
from llama_index.readers.file import PDFReader

reader = PDFReader()
documents = reader.load_data(file=Path("document.pdf"))

# 方式 3：LlamaParse（商业服务，效果更好）
from llama_parse import LlamaParse

parser = LlamaParse(
    api_key="llx-...",
    result_type="markdown",  # 输出 Markdown 格式
    verbose=True,
    language="en",  # 或 "zh"
)
documents = parser.load_data("document.pdf")
```

#### （2）Word 加载器

```python
from llama_index.core import SimpleDirectoryReader

# 方式 1：SimpleDirectoryReader（推荐）
documents = SimpleDirectoryReader(
    input_files=["document.docx"]
).load_data()

# 方式 2：DocxReader（底层）
from llama_index.readers.file import DocxReader

reader = DocxReader()
documents = reader.load_data(file=Path("document.docx"))
```

#### （3）Excel 加载器

```python
from llama_index.core import SimpleDirectoryReader

# 方式 1：SimpleDirectoryReader（推荐）
documents = SimpleDirectoryReader(
    input_files=["spreadsheet.xlsx"]
).load_data()

# 方式 2：PandasExcelReader（底层，更灵活）
from llama_index.readers.file import PandasExcelReader

reader = PandasExcelReader(
    pandas_config={"engine": "openpyxl"},  # 使用 openpyxl 引擎
)
documents = reader.load_data(file=Path("spreadsheet.xlsx"))

# 方式 3：LlamaParse（表格提取效果更好）
from llama_parse import LlamaParse

parser = LlamaParse(
    api_key="llx-...",
    result_type="markdown",
)
documents = parser.load_data("spreadsheet.xlsx")
```

---

## 三、文档解析（Document Parsers）

### 3.1 解析流程详解

```python
# SimpleDirectoryReader 内部流程
def load_data(self):
    for file_path in self.files:
        # 1. 检测文件类型
        file_ext = file_path.suffix.lower()
        
        # 2. 选择对应解析器
        if file_ext == '.pdf':
            parser = PDFParser()
        elif file_ext == '.docx':
            parser = DocxParser()
        elif file_ext == '.xlsx':
            parser = ExcelParser()
        else:
            parser = TextParser()
        
        # 3. 解析文件
        text, metadata = parser.parse(file_path)
        
        # 4. 创建 Document 对象
        doc = Document(
            text=text,
            metadata={
                'file_name': file_path.name,
                'file_type': file_ext,
                'file_size': file_path.stat().st_size,
                'file_path': str(file_path),
                **metadata
            }
        )
        
        documents.append(doc)
    
    return documents
```

---

### 3.2 PDF 解析详解

#### （1）标准解析（免费）

```python
from llama_index.readers.file import PDFReader

reader = PDFReader()
documents = reader.load_data(file=Path("document.pdf"))

# 内部使用 PyMuPDF (fitz) 解析
# 提取内容：
# - 文本（按页面）
# - 基础元数据（页数、作者等）

# 限制：
# - 表格提取效果一般
# - 复杂布局可能错乱
# - 扫描件需要 OCR
```

#### （2）LlamaParse 解析（商业）⭐推荐

```python
from llama_parse import LlamaParse

parser = LlamaParse(
    api_key="llx-...",  # 免费额度：1000 页/月
    
    # 输出格式
    result_type="markdown",  # 或 "text" 或 "structured"
    
    # 解析选项
    prompt="Extract all tables and figures with captions",  # 自定义指令
    gpt4o_mode=True,  # 使用 GPT-4o 增强解析
    gpt4o_api_key="sk-...",
    
    # 语言
    language="zh",  # 或 "en"
    
    # 调试
    verbose=True,
)

# 解析单个文件
documents = parser.load_data("complex_document.pdf")

# 解析多个文件
documents = parser.load_data(["doc1.pdf", "doc2.pdf", "doc3.pdf"])

# 异步解析
documents = await parser.aload_data("document.pdf")

# 输出内容：
# - 保留标题层级（# H1, ## H2, ### H3）
# - 表格转为 Markdown
# - 图片提取为 base64（可选）
# - 公式保留 LaTeX 格式
```

**LlamaParse 优势**：
- ✅ 表格提取准确率高（90%+）
- ✅ 保留文档结构
- ✅ 支持复杂布局
- ✅ OCR 内置（扫描件）
- ✅ 多语言支持

**成本**：
- 免费版：1000 页/月
- 标准版：$0.003/页（≈ ¥0.02/页）
- 100 万页 ≈ $3000

---

### 3.3 Word 解析详解

```python
from llama_index.readers.file import DocxReader

reader = DocxReader()
documents = reader.load_data(file=Path("document.docx"))

# 提取内容：
# - 正文文本（保留段落）
# - 标题层级（Heading 1/2/3）
# - 表格（转为文本或 HTML）
# - 图片（可选提取）
# - 元数据（作者、创建时间等）

# 内部使用 python-docx 库
# 限制：
# - .doc 格式支持有限（需要额外库）
# - 复杂表格可能丢失格式
```

**Word 文档结构示例**：
```python
# 解析后的 Document.text 内容：
"""
# 标题 1

这是第一段内容...

## 标题 2

这是第二段内容...

| 表格列 1 | 表格列 2 |
|---------|---------|
| 数据 1   | 数据 2   |
"""
```

---

### 3.4 Excel 解析详解

#### （1）标准解析

```python
from llama_index.readers.file import PandasExcelReader

reader = PandasExcelReader(
    pandas_config={"engine": "openpyxl"},
)
documents = reader.load_data(file=Path("spreadsheet.xlsx"))

# 提取内容：
# - 每个 Sheet 转为一个 Document
# - 表格数据转为 Markdown 或 CSV 格式
# - 元数据包含 Sheet 名称

# 内部使用 pandas + openpyxl
```

**输出示例**：
```python
# Document 1 (Sheet: "销售数据")
text = """
| 日期 | 产品 | 销售额 | 数量 |
|------|------|--------|------|
| 2024-01 | 产品 A | 10000 | 100 |
| 2024-01 | 产品 B | 15000 | 150 |
"""

# Document 2 (Sheet: "库存数据")
text = """
| 产品 | 库存量 | 仓库 |
|------|--------|------|
| 产品 A | 500 | 北京 |
| 产品 B | 300 | 上海 |
"""
```

#### （2）LlamaParse 解析（表格复杂时推荐）

```python
from llama_parse import LlamaParse

parser = LlamaParse(
    api_key="llx-...",
    result_type="markdown",
    do_not_cache=True,  # 不缓存，每次都重新解析
)

documents = parser.load_data("complex_spreadsheet.xlsx")

# 优势：
# - 多页表格合并
# - 复杂表头识别
# - 合并单元格处理
# - 图表提取（可选）
```

---

## 四、内容分块（Node Parsing）

### 4.1 分块流程

```python
from llama_index.core.node_parser import SentenceSplitter

# 1. 创建分块器
parser = SentenceSplitter(
    chunk_size=512,
    chunk_overlap=50,
)

# 2. 将 Document 转为 Node
nodes = parser.get_nodes_from_documents(documents)

# 3. 每个 Node 包含：
# - text: 文本内容
# - metadata: 元数据（继承自 Document + 分块信息）
# - ref_doc_id: 引用文档 ID
# - relationships: 节点关系（父子/兄弟）

# 示例
for node in nodes:
    print(f"Node ID: {node.node_id}")
    print(f"内容：{node.text[:100]}...")
    print(f"来源文档：{node.ref_doc_id}")
    print(f"元数据：{node.metadata}")
```

---

### 4.2 不同格式的分块策略

#### （1）PDF 分块

```python
from llama_index.core.node_parser import (
    SentenceSplitter,
    MarkdownNodeParser,  # 如果用 LlamaParse 解析
)

# 场景 1：标准 PDF 解析
if used_llamaparse:
    # LlamaParse 输出 Markdown，用 MarkdownNodeParser
    parser = MarkdownNodeParser(
        include_metadata=True,  # 保留标题路径
    )
else:
    # 标准解析，用 SentenceSplitter
    parser = SentenceSplitter(
        chunk_size=512,
        chunk_overlap=50,
    )

nodes = parser.get_nodes_from_documents(documents)
```

#### （2）Word 分块

```python
# Word 文档通常有清晰的标题结构
parser = SentenceSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separator="\n",  # 按段落分隔
)

nodes = parser.get_nodes_from_documents(documents)
```

#### （3）Excel 分块

```python
# Excel 通常不需要分块（每个 Sheet 已经是一个块）
# 但如果 Sheet 很大，可以按行分块

from llama_index.core.node_parser import TokenTextSplitter

parser = TokenTextSplitter(
    chunk_size=1024,  # 表格数据可以大一些
    chunk_overlap=0,  # 表格不需要重叠
)

nodes = parser.get_nodes_from_documents(documents)
```

---

## 五、完整流程示例

### 5.1 基础示例

```python
from llama_index.core import (
    SimpleDirectoryReader,
    VectorStoreIndex,
    StorageContext,
)
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding

# Step 1: 加载文档
documents = SimpleDirectoryReader(
    input_dir="./data",
    required_exts=[".pdf", ".docx", ".xlsx"],
).load_data()

print(f"加载了 {len(documents)} 个文档")

# Step 2: 分块
from llama_index.core.node_parser import SentenceSplitter

parser = SentenceSplitter(chunk_size=512, chunk_overlap=50)
nodes = parser.get_nodes_from_documents(documents)

print(f"分块后得到 {len(nodes)} 个节点")

# Step 3: 配置向量存储
vector_store = PGVectorStore(
    connection_string="postgresql://user:pass@localhost/rag_db",
    table_name="embeddings",
)

storage_context = StorageContext.from_defaults(
    vector_store=vector_store
)

# Step 4: 构建索引
index = VectorStoreIndex(
    nodes=nodes,
    storage_context=storage_context,
    embed_model=OpenAIEmbedding(model="text-embedding-3-large"),
)

# Step 5: 查询
query_engine = index.as_query_engine()
response = query_engine.query("产品 A 的技术参数是什么？")

print(response)
```

---

### 5.2 企业级示例（含 LlamaParse）

```python
from llama_parse import LlamaParse
from llama_index.core import (
    VectorStoreIndex,
    Settings,
)
from llama_index.core.node_parser import MarkdownNodeParser
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
import asyncio

# 配置全局设置
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-large")
Settings.llm = OpenAI(model="gpt-4o")

async def process_enterprise_documents():
    # Step 1: 使用 LlamaParse 解析（适合复杂文档）
    parser = LlamaParse(
        api_key="llx-...",
        result_type="markdown",
        language="zh",
        verbose=True,
    )
    
    # 解析多个文件
    file_paths = [
        "product_manual.pdf",
        "technical_spec.docx",
        "sales_data.xlsx",
    ]
    
    documents = await parser.aload_data(file_paths)
    
    print(f"解析了 {len(documents)} 个文档")
    
    # Step 2: Markdown 感知分块（保留结构）
    node_parser = MarkdownNodeParser(
        include_metadata=True,
    )
    
    nodes = node_parser.get_nodes_from_documents(documents)
    
    print(f"分块后得到 {len(nodes)} 个节点")
    
    # Step 3: 构建索引
    index = VectorStoreIndex(nodes=nodes)
    
    # Step 4: 持久化
    index.storage_context.persist(persist_dir="./storage")
    
    # Step 5: 查询
    query_engine = index.as_query_engine(
        similarity_top_k=10,
        response_mode="refine",  # 迭代优化答案
    )
    
    response = await query_engine.aquery("对比产品 A 和 B 的技术参数")
    
    print(f"答案：{response}")
    print(f"引用：{response.source_nodes}")
    
    return index

# 运行
index = asyncio.run(process_enterprise_documents())
```

---

### 5.3 混合解析示例（免费 + 付费）

```python
from llama_index.core import SimpleDirectoryReader
from llama_parse import LlamaParse
from pathlib import Path

def smart_load_documents(data_dir: str):
    """
    智能加载：
    - 简单文档用免费解析
    - 复杂文档用 LlamaParse
    """
    documents = []
    
    # 分类文件
    simple_files = []
    complex_files = []
    
    for file_path in Path(data_dir).glob("*"):
        if file_path.suffix.lower() in ['.txt', '.md', '.json']:
            simple_files.append(str(file_path))
        elif file_path.suffix.lower() in ['.pdf', '.docx']:
            # 大文件用 LlamaParse
            if file_path.stat().st_size > 1024 * 1024:  # >1MB
                complex_files.append(str(file_path))
            else:
                simple_files.append(str(file_path))
        else:
            simple_files.append(str(file_path))
    
    # 加载简单文档
    if simple_files:
        simple_docs = SimpleDirectoryReader(
            input_files=simple_files
        ).load_data()
        documents.extend(simple_docs)
        print(f"加载了 {len(simple_docs)} 个简单文档")
    
    # 加载复杂文档（LlamaParse）
    if complex_files:
        parser = LlamaParse(
            api_key="llx-...",
            result_type="markdown",
        )
        complex_docs = parser.load_data(complex_files)
        documents.extend(complex_docs)
        print(f"加载了 {len(complex_docs)} 个复杂文档")
    
    return documents

# 使用
documents = smart_load_documents("./data")
```

---

## 六、Ingestion Pipeline（生产级）

### 6.1 管道配置

```python
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.vector_stores.postgres import PGVectorStore

# 创建管道
pipeline = IngestionPipeline(
    transformations=[
        # 1. 文档清洗（可选）
        # DocCleaner(),
        
        # 2. 分块
        SentenceSplitter(chunk_size=512, chunk_overlap=50),
        
        # 3. Embedding 生成
        OpenAIEmbedding(model="text-embedding-3-large"),
    ],
    
    # 文档存储（用于去重）
    docstore=SimpleDocumentStore(),
    
    # 向量存储
    vector_store=PGVectorStore(
        connection_string="postgresql://...",
        table_name="embeddings",
    ),
)

# 运行管道
documents = SimpleDirectoryReader("./data").load_data()

# 第一次运行
nodes = pipeline.run(documents=documents)

# 第二次运行（自动去重）
new_documents = SimpleDirectoryReader("./new_data").load_data()
nodes = pipeline.run(documents=new_documents)  # 只处理新文档
```

---

### 6.2 增量更新

```python
# Ingestion Pipeline 内置去重机制
# 基于 document.doc_id 和 content hash

# 场景 1：文档更新
doc = documents[0]
doc.text = "更新后的内容"  # 修改内容

# 重新运行管道
nodes = pipeline.run(documents=[doc])
# 检测到 hash 变化 → 自动更新

# 场景 2：文档删除
# 需要手动处理
await vector_store.delete(doc_id="xxx")
await docstore.delete(doc_id="xxx")
```

---

## 七、性能优化

### 7.1 批量处理

```python
# 大批量文档处理
documents = SimpleDirectoryReader("./large_dataset").load_data()

# 分批处理
batch_size = 100
for i in range(0, len(documents), batch_size):
    batch = documents[i:i+batch_size]
    
    nodes = pipeline.run(documents=batch)
    
    print(f"处理了 {i+len(batch)}/{len(documents)} 个文档")
```

---

### 7.2 异步处理

```python
from llama_parse import LlamaParse
import asyncio

async def process_batch(file_paths: list[str]):
    parser = LlamaParse(
        api_key="llx-...",
        result_type="markdown",
    )
    
    # 并发解析
    tasks = [parser.aload_data(f) for f in file_paths]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    documents = []
    for result in results:
        if isinstance(result, Exception):
            print(f"解析失败：{result}")
        else:
            documents.extend(result)
    
    return documents

# 运行
documents = asyncio.run(process_batch(["doc1.pdf", "doc2.pdf", "doc3.pdf"]))
```

---

### 7.3 缓存优化

```python
# LlamaParse 默认缓存解析结果
parser = LlamaParse(
    api_key="llx-...",
    use_cache=True,  # 启用缓存（默认开启）
    cache_dir="./llamaparse_cache",
)

# 相同文件不会重复解析
documents = parser.load_data("document.pdf")  # 第一次：调用 API
documents = parser.load_data("document.pdf")  # 第二次：使用缓存
```

---

## 八、常见问题

### Q1: PDF 解析后乱码？

**原因**：字体编码问题或扫描件。

**解决**：
```python
# 使用 LlamaParse（内置 OCR）
parser = LlamaParse(
    api_key="llx-...",
    language="zh",  # 指定语言
)
```

---

### Q2: 表格提取不完整？

**原因**：标准解析器表格识别能力有限。

**解决**：
```python
# 使用 LlamaParse
parser = LlamaParse(
    api_key="llx-...",
    result_type="markdown",  # 表格转为 Markdown
)

# 或使用 Camelot 专门提取
import camelot
tables = camelot.read_pdf("document.pdf", pages="all")
```

---

### Q3: 处理速度慢？

**优化**：
```python
# 1. 并发解析
documents = await parser.aload_data(file_paths)  # 异步

# 2. 批量处理
for batch in batches:
    pipeline.run(documents=batch)

# 3. 使用缓存
parser = LlamaParse(use_cache=True)
```

---

### Q4: 中文支持如何？

**LlamaIndex 中文支持**：
- ✅ 加载：完全支持
- ✅ 分块：SentenceSplitter 支持中文
- ⚠️ 解析：标准 PDF 解析对中文一般，建议用 LlamaParse
- ✅ Embedding：使用多语言模型（如 text-embedding-3-large）

**推荐配置**：
```python
# 中文分块优化
parser = SentenceSplitter(
    chunk_size=512,      # 中文句子较长
    chunk_overlap=50,    # 更多重叠
    separator="\n",      # 段落优先
)

# 中文 Embedding
from llama_index.embeddings.dashscope import DashscopeEmbedding
embed_model = DashscopeEmbedding(model_name="text-embedding-v2")
```

---

## 九、成本估算

### 9.1 免费方案

```
组件：
- SimpleDirectoryReader: 免费
- SentenceSplitter: 免费
- pgvector: 免费
- Embedding: Dashscope（¥0.002/千 token）

100 万文档成本：
- 解析：¥0
- Embedding: ¥2000-4000（取决于文档长度）
- 存储：¥500/月（云服务器）

总计：¥2500-4500（一次性）+ ¥500/月
```

---

### 9.2 LlamaParse 方案

```
组件：
- LlamaParse: $0.003/页
- 其他：同上

100 万文档成本（假设平均 5 页/文档）：
- 解析：500 万页 × $0.003 = $15000（≈¥108,000）
- Embedding: ¥2000-4000
- 存储：¥500/月

总计：¥110,000-112,000（一次性）+ ¥500/月
```

**建议**：
- 内部文档：免费方案
- 关键文档（合同/财报）：LlamaParse
- 混合使用：智能路由

---

## 十、总结

### LlamaIndex 文档处理流程

```
1. 加载 (Loaders)
   └─ SimpleDirectoryReader（自动识别格式）

2. 解析 (Parsers)
   ├─ 免费：PyMuPDF (PDF) / python-docx (Word) / pandas (Excel)
   └─ 付费：LlamaParse（效果更好）

3. 分块 (Splitters)
   ├─ SentenceSplitter（通用）
   ├─ MarkdownNodeParser（Markdown 感知）
   └─ HierarchicalNodeParser（分层）

4. Embedding
   └─ OpenAI / Dashscope / HuggingFace

5. 索引
   └─ VectorStoreIndex / 其他索引类型

6. 检索
   └─ Query Engine / Retrievers
```

### 推荐配置（企业场景）

```python
# 加载
documents = SimpleDirectoryReader(
    input_dir="./data",
    required_exts=[".pdf", ".docx", ".xlsx"],
).load_data()

# 解析（关键文档用 LlamaParse）
# 分块
parser = SentenceSplitter(chunk_size=512, chunk_overlap=50)
nodes = parser.get_nodes_from_documents(documents)

# 管道
pipeline = IngestionPipeline(
    transformations=[parser, OpenAIEmbedding()],
    docstore=SimpleDocumentStore(),
    vector_store=PGVectorStore(...),
)

# 运行
pipeline.run(documents=documents)
```
