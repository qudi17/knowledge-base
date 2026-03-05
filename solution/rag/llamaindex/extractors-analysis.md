# LlamaIndex Extractors 深度解析

> **源码版本**: LlamaIndex v0.12.x (main branch)  
> **GitHub**: https://github.com/run-llama/llama_index  
> **核心文件**: [`llama-index-core/llama_index/core/extractors/`](https://github.com/run-llama/llama_index/tree/main/llama-index-core/llama_index/core/extractors)

---

## 一、Extractor 核心定位

### 1.1 什么是 Extractor？

**Extractor（提取器）** 是 LlamaIndex 中用于**从文档/节点中提取元数据**的组件，通过 LLM 或规则自动 enrich 节点信息。

**核心价值**：
- 📌 **增强检索** - 提取的元数据可用于过滤/加权
- 🏷️ **自动标签** - 为文档生成标题/关键词/问题
- 🔍 **提升精度** - 元数据辅助检索，提高相关性

---

### 1.2 与 Transformation 的区别

| 特性 | Transformation | Extractor |
|------|---------------|-----------|
| **目的** | 转换节点（分块/Embedding） | 提取元数据 |
| **输出** | 新节点列表 | 元数据字典 |
| **修改** | 可创建/删除节点 | 仅添加 metadata |
| **典型用途** | SentenceSplitter, Embedding | TitleExtractor, KeywordExtractor |

**流程对比**：
```
Transformation:
Document → [Splitter] → [Node1, Node2, Node3]

Extractor:
Node → [TitleExtractor] → Node + metadata={'title': '...'}
```

---

### 1.3 在 IngestionPipeline 中的使用

**源码**: [`pipeline.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/ingestion/pipeline.py)

```python
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.extractors import TitleExtractor, QuestionsAnsweredExtractor
from llama_index.embeddings.openai import OpenAIEmbedding

# Extractor 作为 Transformation 使用
pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=50),
        TitleExtractor(nodes=5),           # Extractor 1
        QuestionsAnsweredExtractor(questions=3),  # Extractor 2
        OpenAIEmbedding(),
    ],
)

nodes = pipeline.run(documents=documents)

# 结果：每个 node 的 metadata 包含：
# - title: 章节标题
# - questions: 该节点能回答的问题列表
```

---

## 二、BaseExtractor 接口

### 2.1 基础接口定义

**源码**: [`interface.py`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/interface.py)

```python
# 源码位置：llama-index-core/llama_index/core/extractors/interface.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/interface.py

from abc import abstractmethod
from typing import List, Dict, Sequence, Any
from llama_index.core.schema import BaseNode

class BaseExtractor:
    """
    Extractor 基类
    
    所有提取器必须实现此接口
    """
    
    @abstractmethod
    def extract(self, nodes: Sequence[BaseNode]) -> List[Dict[str, Any]]:
        """
        从节点列表提取元数据
        
        参数：
        - nodes: 节点序列
        
        返回：
        - 每个节点对应的元数据字典列表
        """
        pass
    
    async def aextract(self, nodes: Sequence[BaseNode]) -> List[Dict[str, Any]]:
        """异步版本"""
        return await asyncio.get_event_loop().run_in_executor(
            None, self.extract, nodes
        )
    
    def __call__(
        self,
        nodes: Sequence[BaseNode],
        in_place: bool = False
    ) -> Sequence[BaseNode]:
        """
        便捷调用：提取元数据并添加到节点
        
        参数：
        - nodes: 节点列表
        - in_place: 是否原地修改（默认 False）
        
        返回：
        - 添加了 metadata 的节点列表
        """
        if not in_place:
            nodes = [node.copy() for node in nodes]
        
        # 提取元数据
        metadata_list = self.extract(nodes)
        
        # 合并到节点 metadata
        for node, metadata in zip(nodes, metadata_list):
            node.metadata.update(metadata)
        
        return nodes
```

---

## 三、Core Extractors 详解

### 3.1 TitleExtractor（标题提取）⭐推荐

**源码**: [`metadata_extractors.py:TitleExtractor`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L15-L120)

**功能**：为文档/章节生成简洁的标题

**使用场景**：
- ✅ 文档没有明确标题
- ✅ 需要为每个 chunk 生成上下文标题
- ✅ 检索结果展示需要标题

```python
# 源码位置：llama-index-core/llama_index/core/extractors/metadata_extractors.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L15-L120

from llama_index.core.extractors.interface import BaseExtractor
from llama_index.core.llms.llm import LLM
from llama_index.core.prompts import PromptTemplate
from llama_index.core.schema import BaseNode

class TitleExtractor(BaseExtractor):
    """
    标题提取器
    
    使用 LLM 为节点生成简洁的标题
    """
    
    def __init__(
        self,
        llm: Optional[LLM] = None,
        nodes: int = 5,  # 每次处理的节点数（用于上下文）
        prompt_template: Optional[str] = None,
    ):
        self.llm = llm
        self.nodes = nodes
        self.prompt_template = prompt_template or self._default_prompt()
    
    def _default_prompt(self) -> PromptTemplate:
        """默认提示词"""
        return PromptTemplate("""
根据以下上下文，为文档生成一个简洁的标题（不超过 10 个字）。

上下文：
{context}

标题：
""")
    
    def extract(self, nodes: Sequence[BaseNode]) -> List[Dict[str, Any]]:
        """
        提取标题
        
        策略：
        1. 合并 N 个节点作为上下文
        2. 调用 LLM 生成标题
        3. 为每个节点分配标题
        """
        results = []
        
        # 批量处理（每次处理 self.nodes 个节点）
        for i in range(0, len(nodes), self.nodes):
            batch = nodes[i:i + self.nodes]
            
            # 合并上下文
            context = "\n\n".join([node.text for node in batch])
            
            # 调用 LLM
            prompt = self.prompt_template.format(context=context)
            title = self.llm.complete(prompt).text.strip()
            
            # 为批次中每个节点分配相同标题
            for _ in batch:
                results.append({"title": title})
        
        return results

# 使用示例
from llama_index.core.extractors import TitleExtractor
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

title_extractor = TitleExtractor(
    llm=OpenAI(model="gpt-4o"),
    nodes=5,  # 每 5 个节点生成一个标题
)

# 在 IngestionPipeline 中使用
pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512),
        title_extractor,  # 添加标题
        OpenAIEmbedding(),
    ],
)
```

**效果对比**：
```
提取前 metadata: {}
提取后 metadata: {'title': '产品安装指南'}
```

---

### 3.2 QuestionsAnsweredExtractor（问题提取）⭐推荐

**源码**: [`metadata_extractors.py:QuestionsAnsweredExtractor`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L122-L220)

**功能**：为节点生成"这个问题可以被该节点回答"的问题列表

**使用场景**：
- ✅ 用户问题匹配度提升
- ✅ 检索时直接匹配问题
- ✅ FAQ 场景

```python
# 源码位置：llama-index-core/llama_index/core/extractors/metadata_extractors.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L122-L220

class QuestionsAnsweredExtractor(BaseExtractor):
    """
    问题提取器
    
    使用 LLM 生成"该节点可以回答哪些问题"
    """
    
    def __init__(
        self,
        llm: Optional[LLM] = None,
        questions: int = 3,  # 每个节点生成的问题数
        prompt_template: Optional[str] = None,
    ):
        self.llm = llm
        self.questions = questions
        self.prompt_template = prompt_template or self._default_prompt()
    
    def _default_prompt(self) -> PromptTemplate:
        """默认提示词"""
        return PromptTemplate("""
阅读以下文本，生成{num_questions}个可以被这段文本回答的问题。

文本：
{text}

生成的问题（每行一个）：
""")
    
    def extract(self, nodes: Sequence[BaseNode]) -> List[Dict[str, Any]]:
        """
        提取问题
        
        流程：
        1. 对每个节点调用 LLM
        2. 生成 N 个问题
        3. 解析问题列表
        """
        results = []
        
        for node in nodes:
            prompt = self.prompt_template.format(
                text=node.text,
                num_questions=self.questions
            )
            
            response = self.llm.complete(prompt).text.strip()
            
            # 解析问题（按行分割）
            questions = [
                q.strip() for q in response.split("\n")
                if q.strip() and q.strip().startswith(("什么", "如何", "为什么", "哪些", "how", "what", "why"))
            ]
            
            results.append({
                "questions": "\n".join(questions[:self.questions])
            })
        
        return results

# 使用示例
from llama_index.core.extractors import QuestionsAnsweredExtractor

qa_extractor = QuestionsAnsweredExtractor(
    llm=OpenAI(model="gpt-4o"),
    questions=3,  # 每个节点生成 3 个问题
)

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512),
        qa_extractor,  # 添加问题
        OpenAIEmbedding(),
    ],
)

# 效果
# 提取前 metadata: {}
# 提取后 metadata: {
#   'questions': '如何安装产品？\n支持哪些操作系统？\n安装需要多长时间？'
# }
```

---

### 3.3 SummaryExtractor（摘要提取）

**源码**: [`metadata_extractors.py:SummaryExtractor`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L222-L300)

**功能**：为节点生成简洁摘要

**使用场景**：
- ✅ 长文档快速预览
- ✅ 检索结果展示摘要
- ✅ 减少 token 消耗

```python
# 源码位置：llama-index-core/llama_index/core/extractors/metadata_extractors.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L222-L300

class SummaryExtractor(BaseExtractor):
    """
    摘要提取器
    
    使用 LLM 生成节点的简洁摘要
    """
    
    def __init__(
        self,
        llm: Optional[LLM] = None,
        max_length: int = 200,  # 摘要最大长度
        prompt_template: Optional[str] = None,
    ):
        self.llm = llm
        self.max_length = max_length
        self.prompt_template = prompt_template or self._default_prompt()
    
    def _default_prompt(self) -> PromptTemplate:
        """默认提示词"""
        return PromptTemplate("""
用不超过{max_length}个字总结以下文本的核心内容。

文本：
{text}

摘要：
""")
    
    def extract(self, nodes: Sequence[BaseNode]) -> List[Dict[str, Any]]:
        """提取摘要"""
        results = []
        
        for node in nodes:
            prompt = self.prompt_template.format(
                text=node.text,
                max_length=self.max_length
            )
            
            summary = self.llm.complete(prompt).text.strip()
            
            results.append({"summary": summary})
        
        return results

# 使用示例
summary_extractor = SummaryExtractor(
    llm=OpenAI(model="gpt-4o"),
    max_length=100,  # 100 字摘要
)
```

---

### 3.4 KeywordExtractor（关键词提取）

**源码**: [`metadata_extractors.py:KeywordExtractor`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L302-L380)

**功能**：提取关键词用于标签/过滤

**使用场景**：
- ✅ 文档分类
- ✅ 标签过滤
- ✅ 相关推荐

```python
# 源码位置：llama-index-core/llama_index/core/extractors/metadata_extractors.py
# https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py#L302-L380

class KeywordExtractor(BaseExtractor):
    """
    关键词提取器
    
    使用 LLM 提取关键词
    """
    
    def __init__(
        self,
        llm: Optional[LLM] = None,
        keywords: int = 5,  # 关键词数量
        prompt_template: Optional[str] = None,
    ):
        self.llm = llm
        self.keywords = keywords
        self.prompt_template = prompt_template or self._default_prompt()
    
    def _default_prompt(self) -> PromptTemplate:
        """默认提示词"""
        return PromptTemplate("""
从以下文本中提取{num_keywords}个最重要的关键词，用逗号分隔。

文本：
{text}

关键词：
""")
    
    def extract(self, nodes: Sequence[BaseNode]) -> List[Dict[str, Any]]:
        """提取关键词"""
        results = []
        
        for node in nodes:
            prompt = self.prompt_template.format(
                text=node.text,
                num_keywords=self.keywords
            )
            
            response = self.llm.complete(prompt).text.strip()
            
            # 解析关键词
            keywords = [
                kw.strip() for kw in response.split(",")
                if kw.strip()
            ]
            
            results.append({
                "keywords": ", ".join(keywords[:self.keywords])
            })
        
        return results

# 使用示例
keyword_extractor = KeywordExtractor(
    llm=OpenAI(model="gpt-4o"),
    keywords=5,  # 提取 5 个关键词
)
```

---

### 3.5 MetadataExtractor（通用元数据提取）

**功能**：自定义提取任意元数据字段

**使用场景**：
- ✅ 提取特定字段（如产品型号、价格）
- ✅ 结构化信息抽取
- ✅ 业务特定元数据

```python
from llama_index.core.extractors import MetadataExtractor
from llama_index.core.prompts import PromptTemplate

# 自定义提取多个字段
metadata_extractor = MetadataExtractor(
    prompt_template=PromptTemplate("""
从以下文本中提取以下信息：
1. 产品名称
2. 版本号
3. 发布日期
4. 主要功能（3 个）

文本：
{text}

提取结果（JSON 格式）：
{{
    "product_name": "...",
    "version": "...",
    "release_date": "...",
    "features": ["...", "...", "..."]
}}
""")
)
```

---

## 四、Entity Extractor（实体提取）

### 4.1 实体提取器

**源码**: [`llama-index-extractors-entity`](https://github.com/run-llama/llama_index/tree/main/llama-index-integrations/extractors/llama-index-extractors-entity)

**功能**：提取命名实体（人名/地名/组织名等）

**依赖**：
```bash
pip install llama-index-extractors-entity
pip install span_marker  # NER 模型
```

**使用示例**：

```python
from llama_index.extractors.entity import EntityExtractor

entity_extractor = EntityExtractor(
    model_name="tomaarsen/span-marker-bert-base-fewnerd-fine-super",
    entities=[
        "person",      # 人名
        "organization", # 组织
        "location",    # 地点
        "product",     # 产品
    ],
)

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(),
        entity_extractor,  # 提取实体
        OpenAIEmbedding(),
    ],
)

# 效果
# metadata: {
#   'entities': {
#     'person': ['张三', '李四'],
#     'organization': ['ABC 公司'],
#     'location': ['北京']
#   }
# }
```

---

## 五、自定义 Extractor

### 5.1 实现 BaseExtractor

```python
from llama_index.core.extractors.interface import BaseExtractor
from llama_index.core.schema import BaseNode
from typing import List, Dict, Sequence, Any

class CustomExtractor(BaseExtractor):
    """
    自定义 Extractor 示例
    
    提取文本中的邮箱地址
    """
    
    def __init__(self):
        import re
        self.email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    
    def extract(self, nodes: Sequence[BaseNode]) -> List[Dict[str, Any]]:
        """提取邮箱"""
        results = []
        
        for node in nodes:
            emails = re.findall(self.email_pattern, node.text)
            
            results.append({
                "emails": ", ".join(emails)
            })
        
        return results

# 使用
custom_extractor = CustomExtractor()

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(),
        custom_extractor,  # 自定义提取器
        OpenAIEmbedding(),
    ],
)
```

---

### 5.2 异步 Extractor

```python
class AsyncExtractor(BaseExtractor):
    """异步 Extractor 示例"""
    
    async def aextract(
        self,
        nodes: Sequence[BaseNode]
    ) -> List[Dict[str, Any]]:
        """异步提取"""
        import aiohttp
        
        results = []
        
        async with aiohttp.ClientSession() as session:
            tasks = [self._extract_single(node, session) for node in nodes]
            results = await asyncio.gather(*tasks)
        
        return results
    
    async def _extract_single(
        self,
        node: BaseNode,
        session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """提取单个节点"""
        # 调用外部 API
        async with session.post(
            "https://api.example.com/extract",
            json={"text": node.text}
        ) as resp:
            data = await resp.json()
            return data
```

---

## 六、完整示例

### 6.1 多 Extractor 组合

```python
from llama_index.core import Document
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.extractors import (
    TitleExtractor,
    QuestionsAnsweredExtractor,
    SummaryExtractor,
    KeywordExtractor,
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

# 创建 LLM
llm = OpenAI(model="gpt-4o")

# 创建 Extractors
title_extractor = TitleExtractor(llm=llm, nodes=5)
qa_extractor = QuestionsAnsweredExtractor(llm=llm, questions=3)
summary_extractor = SummaryExtractor(llm=llm, max_length=100)
keyword_extractor = KeywordExtractor(llm=llm, keywords=5)

# 创建管道
pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=50),
        title_extractor,      # 1. 提取标题
        qa_extractor,         # 2. 提取问题
        summary_extractor,    # 3. 提取摘要
        keyword_extractor,    # 4. 提取关键词
        OpenAIEmbedding(),    # 5. 生成 Embedding
    ],
)

# 运行
documents = [Document.example() for _ in range(10)]
nodes = pipeline.run(documents=documents, show_progress=True)

# 查看结果
for node in nodes[:3]:
    print(f"文本：{node.text[:100]}...")
    print(f"元数据：{node.metadata}")
    print("---")
```

**输出示例**：
```
文本：产品安装指南。第一步：下载安装包...
元数据：{
    'title': '产品安装指南',
    'questions': '如何安装产品？\n支持哪些系统？\n安装需要多久？',
    'summary': '本文档介绍产品的安装步骤，支持 Windows/Mac/Linux 系统',
    'keywords': '安装，Windows, Mac, Linux, 步骤'
}
---
```

---

### 6.2 检索时使用元数据过滤

```python
# 使用提取的元数据进行过滤检索
from llama_index.core import VectorStoreIndex

index = VectorStoreIndex(nodes)

# 过滤检索（只检索包含特定关键词的节点）
query_engine = index.as_query_engine(
    filters=MetadataFilters(
        filters=[
            MetadataFilter(key="keywords", value="安装", operator="contains"),
        ]
    )
)

response = query_engine.query("如何安装产品？")
```

---

## 七、性能与成本

### 7.1 LLM 调用次数

| Extractor | 调用策略 | 1000 节点成本 |
|-----------|---------|-------------|
| **TitleExtractor** | 每 N 节点 1 次 | 200 次（N=5） |
| **QuestionsAnsweredExtractor** | 每节点 1 次 | 1000 次 |
| **SummaryExtractor** | 每节点 1 次 | 1000 次 |
| **KeywordExtractor** | 每节点 1 次 | 1000 次 |

**成本估算**（OpenAI GPT-4o）：
- TitleExtractor: 200 次 × $0.001 = $0.2
- QuestionsAnsweredExtractor: 1000 次 × $0.001 = $1.0
- **总计**: ~$1-2 / 1000 节点

---

### 7.2 优化策略

#### （1）批量处理

```python
# TitleExtractor 已经批量（nodes=5）
title_extractor = TitleExtractor(nodes=5)  # 减少 80% 调用
```

#### （2）选择性使用

```python
# 只对重要文档使用 Extractor
if document.metadata.get('priority') == 'high':
    pipeline = IngestionPipeline(
        transformations=[
            SentenceSplitter(),
            TitleExtractor(),
            QuestionsAnsweredExtractor(),
            OpenAIEmbedding(),
        ],
    )
else:
    pipeline = IngestionPipeline(
        transformations=[
            SentenceSplitter(),
            OpenAIEmbedding(),  # 跳过 Extractor
        ],
    )
```

#### （3）使用小模型

```python
# 使用便宜模型提取元数据
from llama_index.llms.openai import OpenAI

# 元数据提取用 GPT-3.5
llm = OpenAI(model="gpt-3.5-turbo")  # $0.0005/1K tokens

# Embedding 用好的模型
embed_model = OpenAIEmbedding(model="text-embedding-3-large")
```

---

## 八、源码索引

### 核心文件

| 文件 | GitHub 链接 | 说明 |
|------|-----------|------|
| `interface.py` | [源码](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/interface.py) | BaseExtractor 基类 |
| `metadata_extractors.py` | [源码](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py) | Title/Questions/Summary/Keyword Extractor |

### 集成 Extractors

| 包名 | GitHub 链接 | 说明 |
|------|-----------|------|
| `llama-index-extractors-entity` | [源码](https://github.com/run-llama/llama_index/tree/main/llama-index-integrations/extractors/llama-index-extractors-entity) | 实体提取器 |

---

## 九、总结

### Extractor 核心价值

1. **增强检索** - 元数据用于过滤/加权，提升精度
2. **自动标签** - 为文档生成标题/关键词/问题
3. **提升体验** - 检索结果展示更友好（标题 + 摘要）

### 推荐配置

| 场景 | 推荐 Extractor |
|------|--------------|
| **通用文档** | TitleExtractor + KeywordExtractor |
| **FAQ/客服** | QuestionsAnsweredExtractor |
| **长文档** | SummaryExtractor |
| **人名/地名** | EntityExtractor |
| **业务特定** | CustomExtractor |

### 成本优化

1. ✅ **批量处理** - TitleExtractor(nodes=5)
2. ✅ **选择性使用** - 只对重要文档使用
3. ✅ **小模型提取** - GPT-3.5 提取，GPT-4 生成答案

### 自研建议

1. ✅ **借鉴接口设计** - BaseExtractor 抽象
2. ✅ **批量优化** - 减少 LLM 调用
3. ✅ **中文优化** - 提示词适配中文场景
4. ✅ **业务定制** - 提取特定业务字段
