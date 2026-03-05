# 分块策略选择指南

## 一、LlamaIndex 分块策略总览

LlamaIndex 提供 **7+ 种分块策略**，**不会自动选择**，需要开发者根据场景手动配置。

```python
from llama_index.core.node_parser import (
    # 基础分块
    SentenceSplitter,          # 按句子分块
    TokenTextSplitter,         # 按 token 分块
    
    # 智能分块
    SemanticSplitter,          # 语义分块（基于 embedding）
    HierarchicalNodeParser,    # 分层分块
    
    # 格式感知
    MarkdownNodeParser,        # Markdown 感知
    HTMLNodeParser,            # HTML 感知
    JSONNodeParser,            # JSON 解析
    CodeNodeParser,            # 代码解析
    
    # 特殊用途
    SentenceWindowNodeParser,  # 句子窗口（检索时扩展上下文）
    AutoMergingParser,         # 自动合并
)
```

---

## 二、分块策略详解

### 2.1 SentenceSplitter（按句子分块）⭐推荐

**原理**：按句子/段落切分，保持语义完整性。

```python
from llama_index.core.node_parser import SentenceSplitter

splitter = SentenceSplitter(
    chunk_size=512,           # 每块最大字符数
    chunk_overlap=20,         # 重叠字符数（避免切断上下文）
    separator="\n",           # 主要分隔符
    paragraph_separator="\n\n\n",  # 段落分隔符
    secondary_chunk_buffer_size=10,  # 句子缓冲区
)

nodes = splitter.get_nodes_from_documents(documents)
```

**适用场景**：
- ✅ **通用文本**（文章、文档、报告）
- ✅ **中文文档**（按句子/段落切分自然）
- ✅ **叙事性内容**（故事、案例、说明）

**不适用**：
- ❌ 代码
- ❌ 结构化数据（表格、JSON）
- ❌ 列表密集型文档

**参数调优**：
| 参数 | 推荐值 | 说明 |
|------|--------|------|
| chunk_size | 256-1024 | 中文建议 512，英文建议 256-512 |
| chunk_overlap | 10-50 | 越大上下文越好，但冗余越多 |
| 中文场景 | chunk_size=512, overlap=50 | 句子较长，需要更多重叠 |

---

### 2.2 TokenTextSplitter（按 Token 分块）

**原理**：严格按 token 数量切分，适合精确控制。

```python
from llama_index.core.node_parser import TokenTextSplitter

splitter = TokenTextSplitter(
    chunk_size=512,           # 每块最大 token 数
    chunk_overlap=50,         # 重叠 token 数
    separator=" ",            # 分隔符
    backup_separators=["\n", ".", "。"],  # 备用分隔符
)

nodes = splitter.get_nodes_from_documents(documents)
```

**适用场景**：
- ✅ **英文文档**（token 边界清晰）
- ✅ **精确成本控制**（按 token 计费）
- ✅ **代码片段**（token 数可预测）

**不适用**：
- ❌ 中文文档（token 切分不自然）
- ❌ 需要保持句子完整性的场景

**对比 SentenceSplitter**：
| 维度 | SentenceSplitter | TokenTextSplitter |
|------|-----------------|-------------------|
| 切分单位 | 句子/段落 | Token |
| 中文友好 | ✅ 优秀 | ⚠️ 一般 |
| 语义完整性 | ✅ 好 | ⚠️ 可能切断句子 |
| 成本可控 | ⚠️ 间接 | ✅ 直接 |

---

### 2.3 SemanticSplitter（语义分块）⭐高级

**原理**：基于 embedding 相似度，在语义边界处切分。

```python
from llama_index.core.node_parser import SemanticSplitter
from llama_index.embeddings.openai import OpenAIEmbedding

splitter = SemanticSplitter(
    embed_model=OpenAIEmbedding(),
    buffer_size=1,              # 缓冲区大小（句子数）
    breakpoint_percentile_threshold=95,  # 语义差异阈值
)

nodes = splitter.get_nodes_from_documents(documents)
```

**工作流程**：
```
1. 将文档按句子拆分
2. 计算每个句子的 embedding
3. 计算相邻句子的余弦相似度
4. 在相似度最低的 5% 处切分（阈值可调）
```

**适用场景**：
- ✅ **主题变化频繁的文档**（会议纪要、访谈记录）
- ✅ **高质量要求场景**（语义完整性优先）
- ✅ **长文档**（自动识别章节边界）

**不适用**：
- ❌ 成本敏感（需要大量 embedding 调用）
- ❌ 延迟敏感（处理速度慢）
- ❌ 短文档（<1000 字，没必要）

**成本估算**：
```
100 万文档 × 平均 50 句/文档 = 5000 万句子
5000 万 × $0.0001/句（embedding）= $5000

建议：仅对高质量文档使用
```

---

### 2.4 HierarchicalNodeParser（分层分块）⭐推荐

**原理**：生成多层级的块（大块→中块→小块），支持递归检索。

```python
from llama_index.core.node_parser import HierarchicalNodeParser

parser = HierarchicalNodeParser.from_defaults(
    chunk_sizes=[8192, 4096, 2048, 512]  # 从大到小 4 层
)

nodes = parser.get_nodes_from_documents(documents)

# 结果：每个文档生成 4 层 nodes
# Level 0: 8192 tokens - 文档级摘要
# Level 1: 4096 tokens - 章节级
# Level 2: 2048 tokens - 段落级
# Level 3: 512 tokens  - 细节级
```

**节点关系**：
```
Level 0 (大块)
  ├── Level 1 (中块 1)
  │     ├── Level 2 (小块 1-1)
  │     └── Level 2 (小块 1-2)
  └── Level 1 (中块 2)
        └── ...
```

**适用场景**：
- ✅ **长文档**（技术手册、法律合同、学术论文）
- ✅ **需要多粒度检索**（既查概要也查细节）
- ✅ **配合递归检索器**（RecursiveRetriever）

**检索示例**：
```python
from llama_index.core.retrievers import RecursiveRetriever

# 检索到小块后，自动获取父块（更多上下文）
retriever = RecursiveRetriever(
    root_retriever=vector_retriever,  # 从小块开始
    retriever_dict={
        "parent": parent_retriever,   # 获取中块
        "grandparent": gp_retriever,  # 获取大块
    }
)
```

---

### 2.5 MarkdownNodeParser（Markdown 感知）

**原理**：识别 Markdown 结构（标题/列表/代码块），按层级切分。

```python
from llama_index.core.node_parser import MarkdownNodeParser

parser = MarkdownNodeParser(
    include_metadata=True,  # 保留标题路径作为元数据
)

nodes = parser.get_nodes_from_documents(documents)

# 结果元数据示例：
# node.metadata = {
#     'header_path': '# 安装指南 > ## 系统要求',
#     'node_type': 'text',
# }
```

**适用场景**：
- ✅ **技术文档**（README、API 文档）
- ✅ **Wiki 页面**（Confluence、Notion 导出）
- ✅ **博客文章**

**优势**：
- 保留文档结构（标题层级）
- 代码块保持完整
- 列表项合理分组

---

### 2.6 HTMLNodeParser（HTML 感知）

**原理**：解析 HTML 标签，按 DOM 结构切分。

```python
from llama_index.core.node_parser import HTMLNodeParser

parser = HTMLNodeParser(
    tags=["div", "p", "table", "ul", "ol"],  # 关注的标签
)
```

**适用场景**：
- ✅ **网页抓取内容**
- ✅ **企业门户 HTML 文档**

---

### 2.7 JSONNodeParser（JSON 解析）

**原理**：解析 JSON 结构，按字段切分。

```python
from llama_index.core.node_parser import JSONNodeParser

parser = JSONNodeParser()

# 输入：{"name": "产品 A", "specs": {"cpu": "M1", "ram": "16G"}}
# 输出：
# - Node 1: "产品 A 的 CPU 是 M1"
# - Node 2: "产品 A 的内存是 16G"
```

**适用场景**：
- ✅ **API 响应**
- ✅ **配置文件**
- ✅ **结构化数据**

---

### 2.8 CodeNodeParser（代码解析）

**原理**：按代码结构（函数/类/模块）切分。

```python
from llama_index.core.node_parser import CodeNodeParser

parser = CodeNodeParser(
    language="python",  # 支持 python/java/js/go 等
)
```

**适用场景**：
- ✅ **代码库检索**
- ✅ **技术问答**

---

### 2.9 SentenceWindowNodeParser（句子窗口）⭐高级

**原理**：检索时动态扩展上下文（前后各 N 句）。

```python
from llama_index.core.node_parser import SentenceWindowNodeParser

parser = SentenceWindowNodeParser(
    window_size=3,  # 前后各扩展 3 句
    window_metadata_key="window",
)

# 存储时：只存单句
# 检索时：自动获取前后 3 句作为上下文
```

**适用场景**：
- ✅ **需要上下文但存储受限**
- ✅ **对话/访谈记录**
- ✅ **配合 AutoMergingRetriever**

---

### 2.10 AutoMergingParser（自动合并）

**原理**：检索时自动合并相邻的小块。

```python
from llama_index.core.node_parser import AutoMergingParser
from llama_index.core.retrievers import AutoMergingRetriever

# 存储：小块
# 检索：命中多个相邻小块时，自动合并为大块

retriever = AutoMergingRetriever(
    vector_retriever,
    storage_context,
)
```

**适用场景**：
- ✅ **细粒度存储，粗粒度检索**
- ✅ **提高召回率**

---

## 三、选择决策树

```
你的文档类型？
│
├─ 通用文本（文章/报告/邮件）
│   └─→ SentenceSplitter（chunk_size=512, overlap=50）⭐
│
├─ 英文文档
│   └─→ TokenTextSplitter（chunk_size=256-512）
│
├─ 长文档（>50 页）
│   └─→ HierarchicalNodeParser（多层级）⭐
│
├─ Markdown 文档（技术文档/Wiki）
│   └─→ MarkdownNodeParser ⭐
│
├─ HTML 网页
│   └─→ HTMLNodeParser
│
├─ 代码
│   └─→ CodeNodeParser
│
├─ JSON/结构化数据
│   └─→ JSONNodeParser
│
├─ 主题变化频繁（会议纪要/访谈）
│   └─→ SemanticSplitter（成本高，谨慎使用）
│
└─ 高质量要求 + 预算充足
    └─→ SemanticSplitter + HierarchicalNodeParser ⭐⭐
```

---

## 四、企业场景推荐

### 4.1 推荐配置（按文档类型）

| 文档类型 | 分块策略 | chunk_size | overlap | 备注 |
|---------|---------|-----------|---------|------|
| **产品手册** | HierarchicalNodeParser | [8192, 4096, 2048] | 256 | 多层级检索 |
| **技术文档** | MarkdownNodeParser | 512 | 50 | 保留结构 |
| **政策制度** | SentenceSplitter | 512 | 50 | 段落完整 |
| **会议纪要** | SemanticSplitter | - | - | 语义边界 |
| **财务报表** | SentenceSplitter + 表格提取 | 1024 | 100 | 大窗口 |
| **合同法律** | HierarchicalNodeParser | [4096, 2048, 512] | 256 | 条款追溯 |
| **培训材料** | SentenceSplitter | 512 | 50 | 通用 |
| **FAQ** | SentenceSplitter | 256 | 20 | 短块精确 |
| **邮件归档** | SentenceSplitter | 512 | 50 | 线程完整 |
| **代码文档** | CodeNodeParser | - | - | 函数级 |

---

### 4.2 混合策略（推荐）

**不要只用一种策略**，根据文档类型动态选择：

```python
from typing import Dict, Type
from llama_index.core.node_parser import (
    SentenceSplitter,
    MarkdownNodeParser,
    HierarchicalNodeParser,
    CodeNodeParser,
)

class SmartNodeParser:
    def __init__(self):
        self.parsers: Dict[str, object] = {
            'markdown': MarkdownNodeParser(),
            'code': CodeNodeParser(),
            'hierarchical': HierarchicalNodeParser.from_defaults(
                chunk_sizes=[8192, 4096, 2048]
            ),
            'default': SentenceSplitter(chunk_size=512, chunk_overlap=50),
        }
    
    def parse(self, document) -> list:
        # 根据文档类型选择解析器
        doc_type = document.metadata.get('type', 'default')
        file_ext = document.metadata.get('file_ext', '').lower()
        
        if file_ext in ['.md', '.mdx']:
            parser = self.parsers['markdown']
        elif file_ext in ['.py', '.js', '.java', '.go']:
            parser = self.parsers['code']
        elif document.metadata.get('is_long', False):
            parser = self.parsers['hierarchical']
        else:
            parser = self.parsers['default']
        
        return parser.get_nodes_from_documents([document])

# 使用
parser = SmartNodeParser()
nodes = parser.parse(document)
```

---

## 五、参数调优指南

### 5.1 Chunk Size 选择

| chunk_size | 适用场景 | 优点 | 缺点 |
|-----------|---------|------|------|
| **128-256** | FAQ、短查询 | 精确匹配 | 上下文不足 |
| **512** | 通用文档 | 平衡 | - |
| **1024-2048** | 技术文档、长段落 | 上下文完整 | 噪声多 |
| **4096+** | 章节级检索 | 高层语义 | 细节丢失 |

**建议**：从 512 开始，根据检索效果调整。

### 5.2 Overlap 选择

| overlap | 适用场景 |
|---------|---------|
| **10-20** | 短块（<256） |
| **50** | 通用（512） |
| **100-200** | 长块（>1024） |
| **256+** | 分层检索 |

**原则**：overlap ≈ chunk_size 的 10%

### 5.3 中文特殊调优

```python
# 中文文档推荐配置
SentenceSplitter(
    chunk_size=512,           # 中文句子较长
    chunk_overlap=50,         # 更多重叠
    separator="\n",           # 换行优先
    secondary_chunk_buffer_size=20,  # 更大的句子缓冲
)
```

**原因**：
- 中文句子平均长度 > 英文
- 中文没有天然空格分隔
- 段落边界更重要

---

## 六、测试与评估

### 6.1 评估指标

```python
# 关键指标
metrics = {
    'retrieval_precision': '检索精度（Top-K 相关性）',
    'retrieval_recall': '检索召回率',
    'answer_accuracy': '答案准确性',
    'latency': '检索延迟',
    'token_cost': 'Token 消耗',
}
```

### 6.2 A/B 测试

```python
# 对比不同分块策略
configs = [
    {'strategy': 'sentence', 'chunk_size': 512},
    {'strategy': 'sentence', 'chunk_size': 1024},
    {'strategy': 'hierarchical', 'chunk_sizes': [8192, 4096, 2048]},
    {'strategy': 'semantic'},
]

for config in configs:
    parser = create_parser(config)
    nodes = parser.parse(documents)
    
    # 检索测试
    results = evaluate_retrieval(nodes, test_queries)
    
    print(f"{config}: precision={results['precision']}, recall={results['recall']}")
```

### 6.3 推荐测试集

**至少准备 20-50 个测试查询**，覆盖：
- 事实检索（"产品 A 的 CPU 型号是什么？"）
- 分析检索（"对比产品 A 和 B 的优缺点"）
- 多跳检索（"产品 A 的兼容性如何？支持哪些操作系统？"）

---

## 七、常见陷阱

### ❌ 陷阱 1：Chunk Size 过大

```python
# 错误：太大，包含过多噪声
SentenceSplitter(chunk_size=4096)  # ❌

# 正确：从 512 开始测试
SentenceSplitter(chunk_size=512)  # ✅
```

**症状**：
- 检索精度高但召回率低
- LLM 生成时上下文过载
- Token 成本高

---

### ❌ 陷阱 2：Overlap 过小

```python
# 错误：切断了上下文
SentenceSplitter(chunk_size=512, chunk_overlap=0)  # ❌

# 正确：保留 10% 重叠
SentenceSplitter(chunk_size=512, chunk_overlap=50)  # ✅
```

**症状**：
- 关键信息被切断
- 跨块检索失败

---

### ❌ 陷阱 3：单一策略应对所有文档

```python
# 错误：所有文档用同一种策略
parser = SentenceSplitter()  # ❌

# 正确：根据文档类型选择
parser = SmartNodeParser()  # ✅
```

---

### ❌ 陷阱 4：忽略文档结构

```python
# 错误：Markdown 文档当纯文本处理
SentenceSplitter().parse(markdown_doc)  # ❌ 丢失结构

# 正确：使用 MarkdownNodeParser
MarkdownNodeParser().parse(markdown_doc)  # ✅ 保留标题层级
```

---

## 八、我们的方案推荐

基于企业场景（PDF/Word/Excel 为主），推荐：

### 8.1 基础配置

```python
# src/processing/smart_chunker.py
from llama_index.core.node_parser import (
    SentenceSplitter,
    MarkdownNodeParser,
    HierarchicalNodeParser,
)

class EnterpriseChunker:
    def __init__(self):
        self.default_splitter = SentenceSplitter(
            chunk_size=512,
            chunk_overlap=50,
            separator="\n",
        )
        
        self.markdown_parser = MarkdownNodeParser(
            include_metadata=True,
        )
        
        self.hierarchical_parser = HierarchicalNodeParser.from_defaults(
            chunk_sizes=[8192, 4096, 2048, 512],
        )
    
    def chunk(self, content: str, metadata: dict) -> list:
        # 根据文档类型选择
        doc_type = metadata.get('type', 'document')
        file_ext = metadata.get('file_ext', '')
        
        if file_ext in ['.md', '.mdx']:
            return self.markdown_parser.parse(content)
        elif metadata.get('page_count', 0) > 50:  # 长文档
            return self.hierarchical_parser.parse(content)
        else:
            return self.default_splitter.split_text(content)
```

### 8.2 高级配置（预算充足）

```python
# 对关键文档使用语义分块
if metadata.get('priority') == 'high':
    from llama_index.core.node_parser import SemanticSplitter
    
    semantic_splitter = SemanticSplitter(
        embed_model=embed_model,
        breakpoint_percentile_threshold=90,
    )
    nodes = semantic_splitter.parse(content)
```

---

## 九、总结

### 快速选择表

| 场景 | 首选策略 | 备选策略 |
|------|---------|---------|
| 通用文档 | SentenceSplitter (512) | TokenTextSplitter |
| 长文档 | HierarchicalNodeParser | SentenceSplitter (1024) |
| Markdown | MarkdownNodeParser | SentenceSplitter |
| 代码 | CodeNodeParser | TokenTextSplitter |
| 会议纪要 | SemanticSplitter | SentenceSplitter |
| 高质量要求 | Hierarchical + Semantic | Hierarchical |

### 核心原则

1. **从简单开始** - SentenceSplitter (512, 50) 适合 80% 场景
2. **按类型选择** - 不同文档用不同策略
3. **测试驱动** - A/B 测试选最优
4. **分层检索** - 长文档用 Hierarchical
5. **中文优化** - 更大的 chunk_size 和 overlap

### 下一步

1. 用测试集评估当前配置
2. 根据文档类型实现 SmartChunker
3. 监控检索效果，持续调优
