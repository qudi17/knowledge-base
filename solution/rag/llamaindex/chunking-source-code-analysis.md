# LlamaIndex 分块策略源码解析与对比

## 一、源码结构概览

### 1.1 目录结构

```
llama_index/
└── llama-index-core/
    └── llama_index/
        └── core/
            └── node_parser/
                ├── __init__.py              # 统一导出
                ├── base.py                  # 基类定义
                └── text/
                    ├── __init__.py
                    ├── sentence.py          # SentenceSplitter
                    ├── token.py             # TokenTextSplitter
                    ├── semantic.py          # SemanticSplitter
                    ├── sentence_window.py   # SentenceWindowNodeParser
                    └── hierarchical.py      # HierarchicalNodeParser
```

---

## 二、基类实现 (base.py)

### 2.1 NodeParser 基类

```python
# llama_index/core/node_parser/base.py
from abc import abstractmethod
from typing import List, Optional
from llama_index.core.schema import BaseNode, Document, MetadataMode

class NodeParser:
    """
    所有分块器的基类
    核心职责：将 Document 转换为 Node 列表
    """
    
    def __init__(
        self,
        include_metadata: bool = True,
        include_prev_next_rel: bool = True,
    ):
        self.include_metadata = include_metadata
        self.include_prev_next_rel = include_prev_next_rel
    
    def parse_typed_documents(
        self, documents: List[Document]
    ) -> List[BaseNode]:
        """主入口：解析类型化的文档"""
        return self.parse_documents(documents)
    
    def parse_documents(
        self, documents: List[Document]
    ) -> List[BaseNode]:
        """
        解析文档列表
        
        流程：
        1. 遍历每个文档
        2. 调用 _parse_document 获取原始文本块
        3. 为每个文本块创建 Node
        4. 添加元数据和关系
        """
        nodes: List[BaseNode] = []
        
        for document in documents:
            # 1. 获取文档的所有文本块
            chunks = self._parse_document(document)
            
            # 2. 为每个文本块创建 Node
            for chunk in chunks:
                # 创建 Node（核心）
                node = self._build_node_from_chunk(
                    chunk=chunk,
                    document=document,
                )
                nodes.append(node)
            
            # 3. 添加前后关系（用于递归检索）
            if self.include_prev_next_rel:
                self._add_prev_next_rel(nodes)
        
        return nodes
    
    @abstractmethod
    def _parse_document(self, document: Document) -> List[str]:
        """
        抽象方法：子类必须实现
        将文档解析为文本块列表
        """
        pass
    
    def _build_node_from_chunk(
        self,
        chunk: str,
        document: Document,
    ) -> BaseNode:
        """
        从文本块构建 Node
        
        核心逻辑：
        1. 生成唯一 ID
        2. 继承文档元数据
        3. 添加分块特定元数据
        """
        from llama_index.core.schema import TextNode
        from llama_index.core.utils import get_doc_id
        
        # 生成 Node ID（基于文档 ID + 块索引）
        node_id = get_doc_id(document) + f"_{len(nodes)}"
        
        # 构建元数据
        metadata = dict(document.metadata) if self.include_metadata else {}
        
        # 创建 Node
        node = TextNode(
            id_=node_id,
            text=chunk,
            metadata=metadata,
            ref_doc_id=document.doc_id,  # 引用文档 ID
        )
        
        return node
    
    def _add_prev_next_rel(self, nodes: List[BaseNode]):
        """
        添加前后节点关系（用于递归检索）
        
        关系类型：
        - NEXT: 指向下一个节点
        - PREVIOUS: 指向前一个节点
        """
        for i, node in enumerate(nodes):
            if i > 0:
                # 添加 PREVIOUS 关系
                node.relationships["PREVIOUS"] = nodes[i - 1].node_id
            if i < len(nodes) - 1:
                # 添加 NEXT 关系
                node.relationships["NEXT"] = nodes[i + 1].node_id
```

---

## 三、SentenceSplitter 实现

### 3.1 核心源码

```python
# llama_index/core/node_parser/text/sentence.py
from typing import List, Optional, Callable
import re

class SentenceSplitter(NodeParser):
    """
    按句子/段落分块
    
    核心策略：
    1. 先按段落分隔符分割
    2. 再按句子分割
    3. 合并到 chunk_size 限制
    """
    
    def __init__(
        self,
        chunk_size: int = 1024,        # 每块最大字符数
        chunk_overlap: int = 20,       # 重叠字符数
        separator: str = " ",          # 主要分隔符
        paragraph_separator: str = "\n\n\n",  # 段落分隔符
        secondary_chunking_regex: str = "[^,.;]+[,.;]?",  # 次级分割正则
        backup_tokenizer: Optional[Callable] = None,  # 备用分词器
    ):
        super().__init__()
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separator = separator
        self.paragraph_separator = paragraph_separator
        self.secondary_chunking_regex = secondary_chunking_regex
        self.backup_tokenizer = backup_tokenizer
    
    def _parse_document(self, document: Document) -> List[str]:
        """
        将文档解析为文本块
        
        完整流程：
        1. 按段落分割
        2. 对每个段落按句子分割
        3. 合并句子到 chunk_size 限制
        """
        text = document.text
        
        # Step 1: 按段落分割
        paragraphs = re.split(
            self.paragraph_separator,
            text
        )
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        # Step 2: 对每个段落按句子分割
        sentences = []
        for paragraph in paragraphs:
            paragraph_sentences = self._split_into_sentences(paragraph)
            sentences.extend(paragraph_sentences)
        
        # Step 3: 合并句子到 chunk_size 限制
        chunks = self._merge_sentences_into_chunks(sentences)
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """
        将文本分割为句子
        
        策略：
        1. 使用正则匹配句子边界
        2. 中文支持：。！？；
        3. 英文支持：. ! ?
        """
        # 句子边界正则（中英文）
        sentence_endings = r"(?<=[.!?!.!?;。！？；])\s+"
        
        sentences = re.split(sentence_endings, text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # 如果分割失败（没有句子边界），使用备用分词器
        if len(sentences) <= 1 and self.backup_tokenizer:
            sentences = self._split_with_tokenizer(text)
        
        return sentences
    
    def _merge_sentences_into_chunks(
        self, sentences: List[str]
    ) -> List[str]:
        """
        将句子合并为块（核心算法）
        
        贪心策略：
        1. 尽可能多地添加句子到当前块
        2. 不超过 chunk_size
        3. 添加 overlap（从前一块复制部分内容）
        """
        chunks = []
        current_chunk = []
        current_chunk_len = 0
        
        for sentence in sentences:
            sentence_len = len(sentence)
            
            # 检查添加这个句子是否会超限
            if current_chunk_len + sentence_len > self.chunk_size:
                # 当前块已满，保存并开始新块
                if current_chunk:
                    chunk_text = self.separator.join(current_chunk)
                    chunks.append(chunk_text)
                
                # 计算 overlap
                if self.chunk_overlap > 0 and chunks:
                    # 从前一块复制部分内容
                    overlap_text = self._get_overlap_from_chunk(
                        chunks[-1],
                        self.chunk_overlap
                    )
                    current_chunk = [overlap_text, sentence]
                    current_chunk_len = len(overlap_text) + sentence_len
                else:
                    current_chunk = [sentence]
                    current_chunk_len = sentence_len
            else:
                # 添加到当前块
                current_chunk.append(sentence)
                current_chunk_len += sentence_len
        
        # 添加最后一个块
        if current_chunk:
            chunk_text = self.separator.join(current_chunk)
            chunks.append(chunk_text)
        
        return chunks
    
    def _get_overlap_from_chunk(self, chunk: str, overlap_size: int) -> str:
        """
        从块中提取 overlap 部分
        
        策略：
        1. 从块末尾开始
        2. 找到完整的句子边界
        3. 返回至少 overlap_size 个字符
        """
        # 简单实现：直接取末尾 overlap_size 字符
        if len(chunk) <= overlap_size:
            return chunk
        
        # 优化实现：找到句子边界
        overlap_text = chunk[-overlap_size:]
        
        # 尝试在句子边界处切断
        sentence_boundary = re.search(
            r"[.!?!.!?;。！？；]",
            overlap_text
        )
        
        if sentence_boundary:
            # 在句子边界后切断
            overlap_text = overlap_text[:sentence_boundary.end()]
        
        return overlap_text
    
    def _split_with_tokenizer(self, text: str) -> List[str]:
        """使用备用分词器分割（当句子分割失败时）"""
        if self.backup_tokenizer:
            tokens = self.backup_tokenizer(text)
            # 将 tokens 转回文本
            return [self.separator.join(tokens[i:i+50]) 
                    for i in range(0, len(tokens), 50)]
        return [text]
```

### 3.2 使用示例

```python
from llama_index.core.node_parser import SentenceSplitter

# 中文优化配置
splitter = SentenceSplitter(
    chunk_size=512,                    # 中文句子较长
    chunk_overlap=50,                  # 10% 重叠
    separator="\n",                    # 换行优先
    paragraph_separator="\n\n\n",      # 段落分隔
    secondary_chunking_regex="[^,.!?;。！？；]+[,.!?;。！？；]?",  # 中文句子边界
)

nodes = splitter.get_nodes_from_documents(documents)
```

---

## 四、TokenTextSplitter 实现

### 4.1 核心源码

```python
# llama_index/core/node_parser/text/token.py
from typing import List, Callable, Optional
import tiktoken

class TokenTextSplitter(NodeParser):
    """
    按 Token 分块
    
    核心策略：
    1. 使用分词器将文本转为 token IDs
    2. 按 chunk_size 切分 token 列表
    3. 将 token 转回文本
    """
    
    def __init__(
        self,
        chunk_size: int = 512,         # 每块最大 token 数
        chunk_overlap: int = 50,       # 重叠 token 数
        separator: str = " ",          # 拼接分隔符
        backup_separators: List[str] = None,  # 备用分隔符
        tokenizer: Optional[Callable] = None,  # 分词器
    ):
        super().__init__()
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separator = separator
        self.backup_separators = backup_separators or ["\n", ".", "。"]
        
        # 默认使用 tiktoken (GPT-2)
        self.tokenizer = tokenizer or tiktoken.get_encoding("gpt2").encode
    
    def _parse_document(self, document: Document) -> List[str]:
        """
        按 token 分割文档
        
        流程：
        1. 文本 → token IDs
        2. 切分 token 列表
        3. token IDs → 文本
        """
        text = document.text
        
        # Step 1: 文本转 token IDs
        tokens = self.tokenizer(text)
        
        # Step 2: 切分 token 列表
        token_chunks = self._split_tokens(
            tokens,
            self.chunk_size,
            self.chunk_overlap
        )
        
        # Step 3: token IDs 转文本
        chunks = []
        for token_chunk in token_chunks:
            # 使用 tokenizer 解码
            chunk_text = tiktoken.get_encoding("gpt2").decode(token_chunk)
            chunks.append(chunk_text)
        
        return chunks
    
    def _split_tokens(
        self,
        tokens: List[int],
        chunk_size: int,
        chunk_overlap: int
    ) -> List[List[int]]:
        """
        切分 token 列表（核心算法）
        
        滑动窗口策略：
        1. 每次移动 (chunk_size - chunk_overlap) 个 token
        2. 确保相邻块有重叠
        """
        chunks = []
        step = chunk_size - chunk_overlap  # 步长
        
        for i in range(0, len(tokens), step):
            chunk = tokens[i:i + chunk_size]
            chunks.append(chunk)
            
            # 如果已经到末尾，退出
            if i + chunk_size >= len(tokens):
                break
        
        return chunks
```

### 4.2 与 SentenceSplitter 对比

```python
# 核心差异

# SentenceSplitter
# - 分割单位：句子/段落
# - 优点：保持语义完整性
# - 缺点：chunk_size 不精确（字符数）
# - 适用：通用文档、中文

# TokenTextSplitter
# - 分割单位：token
# - 优点：精确控制 token 数（成本可控）
# - 缺点：可能切断句子
# - 适用：英文、成本控制

# 示例对比
text = "这是一个测试句子。这是第二个句子。"

# SentenceSplitter
# → ["这是一个测试句子。", "这是第二个句子。"]
# 保持句子完整

# TokenTextSplitter (chunk_size=5)
# → ["这是一个测试", "句子。这是第二", "个句子。"]
# 可能切断句子
```

---

## 五、SemanticSplitter 实现

### 5.1 核心源码

```python
# llama_index/core/node_parser/text/semantic.py
from typing import List, Optional
import numpy as np

class SemanticSplitterNodeParser(NodeParser):
    """
    语义分块（基于 embedding 相似度）
    
    核心策略：
    1. 将文本分割为句子
    2. 计算每个句子的 embedding
    3. 计算相邻句子的余弦相似度
    4. 在相似度最低的点切分
    """
    
    def __init__(
        self,
        embed_model,                    # Embedding 模型
        buffer_size: int = 1,           # 缓冲区大小（句子数）
        breakpoint_percentile_threshold: int = 95,  # 切分阈值（百分位）
        sentence_splitter: Optional[Callable] = None,  # 句子分割器
    ):
        super().__init__()
        self.embed_model = embed_model
        self.buffer_size = buffer_size
        self.breakpoint_threshold = breakpoint_percentile_threshold
        self.sentence_splitter = sentence_splitter or self._default_sentence_split
    
    def _parse_document(self, document: Document) -> List[str]:
        """
        语义分块流程
        
        完整算法：
        1. 分割为句子
        2. 计算句子 embedding
        3. 计算相似度差异
        4. 找到切分点
        5. 合并为块
        """
        text = document.text
        
        # Step 1: 分割为句子
        sentences = self.sentence_splitter(text)
        
        if len(sentences) <= 1:
            return [text]
        
        # Step 2: 计算句子 embedding
        embeddings = self.embed_model.get_text_embedding_batch(sentences)
        embeddings = np.array(embeddings)
        
        # Step 3: 计算相邻句子的余弦相似度
        similarities = self._calculate_similarities(embeddings)
        
        # Step 4: 找到切分点（相似度最低的 5%）
        breakpoints = self._find_breakpoints(
            similarities,
            self.breakpoint_threshold
        )
        
        # Step 5: 在切分点处分割
        chunks = self._split_at_breakpoints(
            sentences,
            breakpoints
        )
        
        return chunks
    
    def _calculate_similarities(
        self,
        embeddings: np.ndarray
    ) -> List[float]:
        """
        计算相邻句子的余弦相似度
        
        公式：
        similarity = cos(θ) = (A·B) / (||A|| * ||B||)
        """
        similarities = []
        
        for i in range(len(embeddings) - 1):
            emb1 = embeddings[i]
            emb2 = embeddings[i + 1]
            
            # 余弦相似度
            similarity = np.dot(emb1, emb2) / (
                np.linalg.norm(emb1) * np.linalg.norm(emb2)
            )
            
            similarities.append(similarity)
        
        return similarities
    
    def _find_breakpoints(
        self,
        similarities: List[float],
        threshold_percentile: int
    ) -> List[int]:
        """
        找到切分点
        
        策略：
        1. 计算相似度差异（一阶导数）
        2. 找到差异最大的点（前 5%）
        """
        # 计算相似度差异
        differences = []
        for i in range(len(similarities) - 1):
            diff = abs(similarities[i] - similarities[i + 1])
            differences.append((i, diff))
        
        # 按差异排序
        differences.sort(key=lambda x: x[1], reverse=True)
        
        # 找到阈值（前 5%）
        threshold_idx = int(len(differences) * (100 - threshold_percentile) / 100)
        threshold = differences[threshold_idx][1] if threshold_idx < len(differences) else 0
        
        # 收集切分点
        breakpoints = [
            idx for idx, diff in differences
            if diff >= threshold
        ]
        
        breakpoints.sort()
        
        return breakpoints
    
    def _split_at_breakpoints(
        self,
        sentences: List[str],
        breakpoints: List[int]
    ) -> List[str]:
        """在切分点处分割句子"""
        chunks = []
        current_chunk = []
        breakpoint_set = set(breakpoints)
        
        for i, sentence in enumerate(sentences):
            current_chunk.append(sentence)
            
            # 检查是否应该切分
            if i in breakpoint_set:
                chunk_text = " ".join(current_chunk)
                chunks.append(chunk_text)
                current_chunk = []
        
        # 添加最后一个块
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        return chunks
    
    def _default_sentence_split(self, text: str) -> List[str]:
        """默认句子分割器"""
        import re
        sentences = re.split(r"(?<=[.!?!.!?;。！？；])\s+", text)
        return [s.strip() for s in sentences if s.strip()]
```

### 5.2 成本分析

```python
# SemanticSplitter 成本计算

# 假设：100 万文档，平均 50 句/文档
total_sentences = 1,000,000 * 50 = 50,000,000

# Embedding 成本（OpenAI text-embedding-3-large）
# $0.0001 / 1K tokens
# 假设每句 20 tokens
cost_per_sentence = 20 / 1000 * $0.0001 = $0.000002

total_cost = 50,000,000 * $0.000002 = $100

# 实际成本：$100-500（取决于文档长度）

# 建议：仅对高质量文档使用
```

---

## 六、HierarchicalNodeParser 实现

### 6.1 核心源码

```python
# llama_index/core/node_parser/text/hierarchical.py
from typing import List, Dict

class HierarchicalNodeParser(NodeParser):
    """
    分层分块（生成多层级节点）
    
    核心策略：
    1. 定义多个 chunk_size 层级
    2. 从大到小逐层分割
    3. 建立父子关系
    """
    
    def __init__(
        self,
        chunk_sizes: List[int] = None,  # 层级配置 [8192, 4096, 2048, 512]
        chunk_overlap: int = 0,
    ):
        super().__init__()
        self.chunk_sizes = chunk_sizes or [8192, 4096, 2048, 512]
        self.chunk_overlap = chunk_overlap
    
    def _parse_document(self, document: Document) -> List[BaseNode]:
        """
        分层分块流程
        
        完整算法：
        1. 从最大 chunk_size 开始
        2. 逐层分割
        3. 建立父子关系
        """
        text = document.text
        all_nodes = []
        
        # Step 1: 创建第一层（最大块）
        level_0_chunks = self._split_text(
            text,
            self.chunk_sizes[0],
            self.chunk_overlap
        )
        
        level_0_nodes = []
        for i, chunk in enumerate(level_0_chunks):
            node = self._create_node(chunk, document, level=0, index=i)
            level_0_nodes.append(node)
            all_nodes.append(node)
        
        # Step 2: 逐层细分
        parent_nodes = level_0_nodes
        
        for level in range(1, len(self.chunk_sizes)):
            chunk_size = self.chunk_sizes[level]
            child_nodes = []
            
            for parent_node in parent_nodes:
                # 分割父节点
                child_chunks = self._split_text(
                    parent_node.text,
                    chunk_size,
                    self.chunk_overlap
                )
                
                # 创建子节点
                for i, chunk in enumerate(child_chunks):
                    child_node = self._create_node(
                        chunk,
                        document,
                        level=level,
                        index=i,
                        parent_id=parent_node.node_id
                    )
                    child_nodes.append(child_node)
                    all_nodes.append(child_node)
            
            parent_nodes = child_nodes
        
        # Step 3: 建立父子关系
        self._build_parent_child_relationships(all_nodes)
        
        return all_nodes
    
    def _build_parent_child_relationships(self, nodes: List[BaseNode]):
        """
        建立父子关系（用于递归检索）
        
        关系类型：
        - CHILD: 指向子节点
        - PARENT: 指向父节点
        """
        # 按层级分组
        nodes_by_level = {}
        for node in nodes:
            level = node.metadata.get("level", 0)
            if level not in nodes_by_level:
                nodes_by_level[level] = []
            nodes_by_level[level].append(node)
        
        # 建立关系
        for level in range(max(nodes_by_level.keys())):
            parent_nodes = nodes_by_level.get(level, [])
            child_nodes = nodes_by_level.get(level + 1, [])
            
            for child_node in child_nodes:
                parent_id = child_node.metadata.get("parent_id")
                if parent_id:
                    # 添加 PARENT 关系
                    child_node.relationships["PARENT"] = parent_id
                    
                    # 添加 CHILD 关系（反向）
                    parent_node = next(
                        (n for n in parent_nodes if n.node_id == parent_id),
                        None
                    )
                    if parent_node:
                        if "CHILD" not in parent_node.relationships:
                            parent_node.relationships["CHILD"] = []
                        parent_node.relationships["CHILD"].append(child_node.node_id)
```

### 6.2 节点关系图

```
Level 0 (8192 tokens) - 文档级
├── Node_0 (整个文档)
│   └── CHILD: [Node_1, Node_2]
│
Level 1 (4096 tokens) - 章节级
├── Node_1 (前半部分)
│   ├── PARENT: Node_0
│   └── CHILD: [Node_3, Node_4]
├── Node_2 (后半部分)
│   ├── PARENT: Node_0
│   └── CHILD: [Node_5, Node_6]
│
Level 2 (2048 tokens) - 段落级
├── Node_3
│   └── PARENT: Node_1
├── Node_4
│   └── PARENT: Node_1
├── Node_5
│   └── PARENT: Node_2
└── Node_6
    └── PARENT: Node_2

Level 3 (512 tokens) - 细节级
└── ...
```

---

## 七、MarkdownNodeParser 实现

### 7.1 核心源码

```python
# llama_index/core/node_parser/file/markdown.py
from typing import List, Dict
import re

class MarkdownNodeParser(NodeParser):
    """
    Markdown 感知分块
    
    核心策略：
    1. 识别 Markdown 结构（标题/列表/代码块）
    2. 按标题层级分割
    3. 保留标题路径作为元数据
    """
    
    def __init__(
        self,
        include_metadata: bool = True,
        header_split_levels: List[int] = None,  # 标题分割层级 [1, 2, 3]
    ):
        super().__init__(include_metadata=include_metadata)
        self.header_split_levels = header_split_levels or [1, 2, 3]
    
    def _parse_document(self, document: Document) -> List[str]:
        """
        Markdown 分块流程
        
        完整算法：
        1. 解析 Markdown 结构
        2. 提取标题层级
        3. 按标题分割
        4. 保留标题路径
        """
        text = document.text
        lines = text.split("\n")
        
        # Step 1: 识别所有标题
        headers = []
        for i, line in enumerate(lines):
            match = re.match(r"^(#{1,6})\s+(.+)$", line)
            if match and len(match.group(1)) in self.header_split_levels:
                headers.append({
                    "level": len(match.group(1)),
                    "title": match.group(2),
                    "line_num": i
                })
        
        # Step 2: 按标题分割内容
        sections = []
        for i, header in enumerate(headers):
            # 获取当前标题的内容
            start_line = header["line_num"]
            end_line = headers[i + 1]["line_num"] if i + 1 < len(headers) else len(lines)
            
            section_text = "\n".join(lines[start_line:end_line])
            
            # 构建标题路径
            header_path = self._build_header_path(headers[:i+1])
            
            sections.append({
                "text": section_text,
                "header_path": header_path,
                "level": header["level"],
            })
        
        return sections
    
    def _build_header_path(self, headers: List[Dict]) -> str:
        """
        构建标题路径（用于元数据）
        
        示例：
        "# 安装指南 > ## 系统要求 > ### Windows"
        """
        path_parts = []
        for header in headers:
            prefix = "#" * header["level"]
            path_parts.append(f"{prefix} {header['title']}")
        
        return " > ".join(path_parts)
    
    def _build_node_from_chunk(
        self,
        chunk: Dict,
        document: Document,
    ) -> BaseNode:
        """重写：添加 Markdown 特定元数据"""
        node = super()._build_node_from_chunk(chunk["text"], document)
        
        # 添加 Markdown 元数据
        node.metadata["header_path"] = chunk["header_path"]
        node.metadata["header_level"] = chunk["level"]
        
        return node
```

---

## 八、完整对比表

### 8.1 实现复杂度对比

| 分块器 | 代码行数 | 算法复杂度 | 依赖 | 执行速度 |
|--------|---------|-----------|------|---------|
| **SentenceSplitter** | ~200 | O(n) | re | ⭐⭐⭐⭐⭐ |
| **TokenTextSplitter** | ~100 | O(n) | tiktoken | ⭐⭐⭐⭐⭐ |
| **SemanticSplitter** | ~250 | O(n²) | numpy + embed_model | ⭐⭐ |
| **HierarchicalNodeParser** | ~300 | O(n*m) | re | ⭐⭐⭐ |
| **MarkdownNodeParser** | ~200 | O(n) | re | ⭐⭐⭐⭐ |

### 8.2 功能对比

| 分块器 | 语义完整 | 成本可控 | 结构保留 | 递归检索 | 中文支持 |
|--------|---------|---------|---------|---------|---------|
| **SentenceSplitter** | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **TokenTextSplitter** | ❌ | ✅ | ❌ | ⚠️ | ⚠️ |
| **SemanticSplitter** | ✅✅ | ❌ | ⚠️ | ⚠️ | ✅ |
| **HierarchicalNodeParser** | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| **MarkdownNodeParser** | ✅ | ⚠️ | ✅✅ | ⚠️ | ✅ |

### 8.3 适用场景对比

| 分块器 | 最佳场景 | 不适用场景 | 推荐配置 |
|--------|---------|-----------|---------|
| **SentenceSplitter** | 通用文档、中文 | 代码、表格 | chunk_size=512, overlap=50 |
| **TokenTextSplitter** | 英文、成本控制 | 中文、长句子 | chunk_size=256-512 |
| **SemanticSplitter** | 会议纪要、访谈 | 成本敏感、短文档 | threshold=95, buffer=1 |
| **HierarchicalNodeParser** | 长文档、技术手册 | 短文档（<10 页） | [8192, 4096, 2048, 512] |
| **MarkdownNodeParser** | 技术文档、Wiki | 纯文本 | include_metadata=True |

---

## 九、源码级优化建议

### 9.1 SentenceSplitter 中文优化

```python
# 优化：更好的中文句子边界检测
class ChineseSentenceSplitter(SentenceSplitter):
    def __init__(self):
        super().__init__(
            chunk_size=512,
            chunk_overlap=50,
            separator="\n",
            paragraph_separator="\n\n\n",
            # 中文句子边界（更完整）
            secondary_chunking_regex="[^,.!?;:,.!?;:]+[,.!?;:,.!?;:]?",
        )
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """优化的中文句子分割"""
        # 中文句子边界
        sentence_endings = (
            r"(?<=[.!?!.!?;:,.!?;:,.!?;:,.!?;:])\s+"
        )
        
        sentences = re.split(sentence_endings, text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # 处理没有标点的长文本（按逗号分割）
        result = []
        for sentence in sentences:
            if len(sentence) > 200:  # 超长句子
                sub_sentences = sentence.split(",")
                result.extend([s.strip() for s in sub_sentences if s.strip()])
            else:
                result.append(sentence)
        
        return result
```

### 9.2 性能优化：批量 Embedding

```python
# SemanticSplitter 优化：批量计算 embedding
class OptimizedSemanticSplitter(SemanticSplitterNodeParser):
    def _parse_document(self, document: Document) -> List[str]:
        sentences = self.sentence_splitter(document.text)
        
        # 批量计算 embedding（而不是逐个）
        embeddings = self.embed_model.get_text_embedding_batch(
            sentences,
            batch_size=128  # 批量大小
        )
        
        # 后续处理...
        return self._split_by_similarity(sentences, embeddings)
```

---

## 十、总结

### 核心洞察

1. **SentenceSplitter** - 最通用，按句子/段落分割，保持语义完整
2. **TokenTextSplitter** - 最精确，按 token 分割，成本可控
3. **SemanticSplitter** - 最智能，基于 embedding 相似度，成本高
4. **HierarchicalNodeParser** - 最灵活，多层级分割，支持递归检索
5. **MarkdownNodeParser** - 最专业，Markdown 感知，保留结构

### 选型建议

```
场景 → 选择
│
├─ 通用文档 → SentenceSplitter(chunk_size=512, overlap=50)
├─ 英文文档 → TokenTextSplitter(chunk_size=256-512)
├─ 长文档 → HierarchicalNodeParser([8192, 4096, 2048, 512])
├─ Markdown → MarkdownNodeParser()
├─ 高质量要求 → SemanticSplitter()（成本高）
└─ 中文优化 → ChineseSentenceSplitter()（自定义）
```

### 自研参考

如果要自研分块器，参考 LlamaIndex 的设计：

```python
from llama_index.core.node_parser import NodeParser

class CustomNodeParser(NodeParser):
    def _parse_document(self, document: Document) -> List[str]:
        # 1. 实现分割逻辑
        chunks = self._split_text(document.text)
        return chunks
    
    def _split_text(self, text: str) -> List[str]:
        # 2. 自定义分割算法
        # ...
        return chunks
```
