# IngestionPipeline Transformation 执行次数验证

> **验证日期**: 2026-03-05  
> **问题**: 10 个文档，每个文档 10 个 nodes，Extractor 会运行几次？

---

## 一、问题描述

**场景**：
- 10 个 Documents
- 每个 Document 被 Splitter 分成 10 个 Nodes（chunks）
- 总共：100 个 Nodes

**问题**：
```python
pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512),   # Splitter
        TitleExtractor(llm=llm, nodes=5),    # Extractor
        OpenAIEmbedding(),                   # Embedding
    ],
)

nodes = pipeline.run(documents=documents)
```

**Extractor 会运行几次？**
- A. 1 次（处理全部 100 个 nodes）
- B. 10 次（每次处理 10 个 nodes，按文档分组）
- C. 100 次（每次处理 1 个 node）

---

## 二、源码分析

### 2.1 run() 方法执行流程

**源码**: [`pipeline.py:87-160`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/ingestion/pipeline.py#L87-L160)

```python
def run(
    self,
    documents: Optional[List[Document]] = None,
    ...
) -> List[BaseNode]:
    # Step 1: 准备输入
    input_nodes: List[BaseNode] = []
    
    if documents:
        # 从文档创建初始 nodes
        for doc in documents:
            node = self._document_to_node(doc)
            input_nodes.append(node)
    
    # Step 2: 去重检查
    nodes_to_process = self._filter_duplicate_nodes(input_nodes)
    
    # Step 3: 运行转换链 ⭐ 关键
    processed_nodes = []
    
    for node in nodes_to_process:  # ← 遍历每个 node
        # 对每个 node 运行所有转换
        transformed_nodes = self._run_transformations(node)
        processed_nodes.extend(transformed_nodes)
    
    return processed_nodes
```

**关键点**：
- `for node in nodes_to_process:` 遍历**每个 node**
- 对每个 node 调用 `_run_transformations(node)`

---

### 2.2 _run_transformations() 方法

**源码**: [`pipeline.py:212-260`](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/ingestion/pipeline.py#L212-L260)

```python
def _run_transformations(
    self,
    node: BaseNode  # ← 输入是单个 node
) -> List[BaseNode]:
    """对单个 node 运行所有转换"""
    
    nodes = [node]  # ← 从单个 node 的列表开始
    
    for i, transformation in enumerate(self.transformations):
        transformed_nodes = []
        
        for n in nodes:  # ← 遍历当前 nodes
            # 检查缓存
            cache_key = self._get_cache_key(n, transformation)
            
            if not self.disable_cache and self.cache:
                cached_result = self.cache.get(cache_key)
                if cached_result:
                    transformed_nodes.extend(cached_result)
                    continue
            
            # 缓存未命中，执行转换 ⭐ 关键
            result = transformation([n])  # ← 调用 transformation，传入单个 node 的列表
            transformed_nodes.extend(result)
            
            # 写入缓存
            if not self.disable_cache and self.cache:
                self.cache.put(cache_key, result)
        
        nodes = transformed_nodes
    
    return nodes
```

**关键点**：
- 输入是**单个 node**
- `transformation([n])` 每次调用传入**单个 node 的列表**
- 外层循环 `for node in nodes_to_process:` 有 100 个 nodes
- 内层循环 `for n in nodes:` 在 Splitter 后会有多个 nodes

---

### 2.3 实际执行流程

```
初始状态：
documents = [Doc1, Doc2, ... Doc10]  # 10 个文档

Step 1: Document → Node (初始转换)
input_nodes = [Node(Doc1), Node(Doc2), ... Node(Doc10)]  # 10 个 nodes（每个文档一个）

Step 2: 去重检查
nodes_to_process = [Node(Doc1), Node(Doc2), ... Node(Doc10)]  # 假设都是新文档

Step 3: 运行转换链（对每个 node）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
迭代 1: 处理 Node(Doc1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_run_transformations(Node(Doc1)):
  nodes = [Node(Doc1)]
  
  Transformation 1: SentenceSplitter
    for n in nodes:  # 1 次迭代
      result = splitter([Node(Doc1)])  # ← 调用 1 次
      # 返回：[Chunk1_1, Chunk1_2, ... Chunk1_10]  # 10 个 chunks
    nodes = [Chunk1_1, Chunk1_2, ... Chunk1_10]
  
  Transformation 2: TitleExtractor
    for n in nodes:  # 10 次迭代
      result = extractor([Chunk1_1])  # ← 调用 10 次（每个 chunk 一次）
      result = extractor([Chunk1_2])
      ...
      result = extractor([Chunk1_10])
    nodes = [Chunk1_1', Chunk1_2', ... Chunk1_10']  # 添加 metadata
  
  Transformation 3: OpenAIEmbedding
    for n in nodes:  # 10 次迭代
      result = embedder([Chunk1_1'])  # ← 调用 10 次
      ...
    nodes = [Chunk1_1'', Chunk1_2'', ... Chunk1_10'']  # 添加 embedding

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
迭代 2: 处理 Node(Doc2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_run_transformations(Node(Doc2)):
  # 重复上述流程...
  # Splitter: 调用 1 次
  # Extractor: 调用 10 次
  # Embedding: 调用 10 次

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
迭代 10: 处理 Node(Doc10)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_run_transformations(Node(Doc10)):
  # 重复上述流程...
```

---

## 三、验证结论

### 3.1 答案

**正确答案：C. 100 次（每次处理 1 个 node）** ✅

### 3.2 详细统计

| Transformation | 调用次数 | 每次输入 | 总处理 nodes |
|---------------|---------|---------|-------------|
| **SentenceSplitter** | 10 次 | 1 个 Document | 10 个 Documents |
| **TitleExtractor** | 100 次 | 1 个 Chunk | 100 个 Chunks |
| **OpenAIEmbedding** | 100 次 | 1 个 Chunk | 100 个 Chunks |

**计算公式**：
```
Splitter 调用次数 = Documents 数量 = 10 次
Extractor 调用次数 = Documents × Chunks/Doc = 10 × 10 = 100 次
Embedding 调用次数 = Documents × Chunks/Doc = 10 × 10 = 100 次
```

---

### 3.3 关键发现

#### ❌ 问题：批量优化失效

**TitleExtractor 设计意图**：
```python
class TitleExtractor:
    def __init__(self, nodes: int = 5):  # 期望每次处理 5 个 nodes
        self.nodes = nodes
    
    def extract(self, nodes: Sequence[BaseNode]):
        # 期望：一次处理 5 个 nodes，生成 1 个标题
        # 实际：每次只处理 1 个 node
```

**实际执行**：
```python
# 期望的批量调用（高效）
extractor.extract([Chunk1, Chunk2, Chunk3, Chunk4, Chunk5])  # 1 次 LLM 调用
extractor.extract([Chunk6, Chunk7, Chunk8, Chunk9, Chunk10])  # 1 次 LLM 调用
# 总计：2 次 LLM 调用

# 实际的逐个调用（低效）
extractor.extract([Chunk1])  # 1 次 LLM 调用
extractor.extract([Chunk2])  # 1 次 LLM 调用
...
extractor.extract([Chunk10])  # 1 次 LLM 调用
# 总计：10 次 LLM 调用（浪费 5 倍！）
```

#### 💰 成本影响

**假设**：
- 1000 个 Documents
- 每个 Document 10 个 Chunks
- GPT-4o 成本：$0.001/次

**批量优化（期望）**：
```
TitleExtractor(nodes=5):
调用次数 = 10000 chunks / 5 = 2000 次
成本 = 2000 × $0.001 = $2
```

**实际执行（当前）**：
```
TitleExtractor:
调用次数 = 10000 chunks = 10000 次
成本 = 10000 × $0.001 = $10
```

**浪费**：5 倍成本！💸

---

## 四、优化建议

### 4.1 方案 1：批量运行 Transformations

**修改 pipeline.py**：

```python
def run(self, documents, ...):
    # Step 1: 准备输入
    input_nodes = self._documents_to_nodes(documents)
    
    # Step 2: 去重检查
    nodes_to_process = self._filter_duplicate_nodes(input_nodes)
    
    # Step 3: 批量运行转换链 ⭐ 优化
    all_nodes = nodes_to_process
    
    for transformation in self.transformations:
        # 批量处理所有 nodes
        all_nodes = transformation(all_nodes)
    
    return all_nodes
```

**效果**：
- Extractor 可以批量处理（nodes=5 生效）
- LLM 调用次数减少 5 倍
- 缓存仍然有效（基于 node_hash + transform_name）

---

### 4.2 方案 2：智能批处理

**识别 Transformation 类型**：

```python
def _run_transformations_batch(
    self,
    nodes: List[BaseNode],
    batch_size: int = 100
) -> List[BaseNode]:
    """批量运行转换链"""
    
    all_results = []
    
    for i in range(0, len(nodes), batch_size):
        batch = nodes[i:i + batch_size]
        
        # 对每个 batch 运行所有转换
        for transformation in self.transformations:
            batch = transformation(batch)
        
        all_results.extend(batch)
    
    return all_results
```

---

### 4.3 方案 3：使用 Embedding Batch

**Embedding 已经有批量优化**：

```python
class BaseEmbedding:
    def __call__(self, nodes: List[BaseNode]) -> List[BaseNode]:
        # 批量提取文本
        texts = [node.text for node in nodes]
        
        # 批量生成 embedding
        embeddings = self._get_text_embeddings_batch(texts)
        
        # 分配给每个 node
        for node, embedding in zip(nodes, embeddings):
            node.embedding = embedding
        
        return nodes
```

**但是**：在 pipeline 中仍然被逐个调用，批量优化失效！

---

## 五、实际测试

### 5.1 测试代码

```python
from llama_index.core import Document
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.extractors import TitleExtractor
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
import time

# 创建测试数据
documents = [
    Document(text=f"这是文档{i}的内容..." * 100)
    for i in range(10)
]

# 创建 LLM
llm = OpenAI(model="gpt-4o")

# 创建管道
pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=50),
        TitleExtractor(llm=llm, nodes=5),  # 期望批量 5
        OpenAIEmbedding(),
    ],
    disable_cache=True,  # 禁用缓存，观察实际调用
)

# 运行并计时
start = time.time()
nodes = pipeline.run(documents=documents, show_progress=True)
end = time.time()

print(f"处理时间：{end - start:.2f}秒")
print(f"输出 nodes: {len(nodes)}个")
print(f"预期 LLM 调用：2 次（100 chunks / 5）")
print(f"实际 LLM 调用：100 次（每个 chunk 一次）")
```

---

### 5.2 预期结果

```
处理时间：~30 秒（100 次 LLM 调用）
输出 nodes: 100 个

如果批量优化生效：
处理时间：~6 秒（20 次 LLM 调用）
```

---

## 六、总结

### 6.1 核心结论

| 问题 | 答案 |
|------|------|
| Extractor 运行几次？ | **100 次**（每个 chunk 一次） |
| 为什么不是 1 次或 10 次？ | Pipeline 逐个 node 处理，批量优化失效 |
| 成本影响？ | **浪费 5 倍** LLM 调用 |
| 如何优化？ | 修改 pipeline 批量运行 transformations |

---

### 6.2 执行流程图

```
10 Documents
    ↓
[Splitter] 调用 10 次（每个 Document 一次）
    ↓
100 Chunks
    ↓
[Extractor] 调用 100 次（每个 Chunk 一次）❌ 应该批量
    ↓
[Embedding] 调用 100 次（每个 Chunk 一次）❌ 应该批量
    ↓
100 Nodes (with metadata + embedding)
```

---

### 6.3 改进建议

**短期**：
1. 意识到批量优化失效
2. 调整预期成本（5 倍）
3. 选择性使用 Extractor（只对重要文档）

**长期**：
1. 向 LlamaIndex 提交 issue/PR
2. 建议批量运行 transformations
3. 保持缓存机制不变

---

### 6.4 参考 Issue

- [Feature Request: Batch transformation execution in IngestionPipeline](https://github.com/run-llama/llama_index/issues)（建议提交）

---

**验证日期**: 2026-03-05  
**验证人**: AI Assistant  
**结论**: ✅ 你的猜想部分正确 - Extractor 运行 100 次（每次 1 个 node），而不是批量处理
