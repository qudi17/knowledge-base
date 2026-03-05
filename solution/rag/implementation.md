# 混合 RAG 实施指南

## 环境准备

### 1. 安装 pgvector

```bash
# macOS (Homebrew)
brew install postgresql@15
brew install pgvector

# 或者从源码编译
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# 验证安装
psql -c "CREATE EXTENSION vector;"
```

### 2. PostgreSQL 配置

```ini
# postgresql.conf
shared_preload_libraries = 'vector'

# 内存优化（根据服务器配置调整）
work_mem = 256MB
maintenance_work_mem = 2GB
effective_cache_size = 12GB

# 连接池（推荐 pgBouncer）
max_connections = 200
```

### 3. Python 依赖

```bash
pip install \
    psycopg2-binary \
    elasticsearch \
    neo4j \
    redis \
    openai \
    langchain \
    langchain-community \
    tiktoken \
    asyncpg \
    httpx
```

---

## 实施步骤

### 阶段一：基础设置（Week 1-2）

#### Step 1: 数据库初始化

```bash
# 执行 SQL 脚本
psql -U postgres -d knowledge_base -f sql/01_extensions.sql
psql -U postgres -d knowledge_base -f sql/02_tables.sql
psql -U postgres -d knowledge_base -f sql/03_indexes.sql
```

#### Step 2: Embedding 管道

```python
# src/embedding_pipeline.py
import asyncio
import asyncpg
from openai import AsyncOpenAI
import hashlib

class EmbeddingPipeline:
    def __init__(self):
        self.openai = AsyncOpenAI()
        self.pg_pool = None
    
    async def connect(self):
        self.pg_pool = await asyncpg.create_pool(
            "postgresql://user:pass@localhost/knowledge_base",
            max_size=20
        )
    
    async def embed_and_store(self, doc_id: str, content: str):
        # 计算内容 hash
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        
        # 检查是否已存在
        existing = await self.pg_pool.fetchrow(
            "SELECT embedded_at FROM document_embeddings WHERE doc_id = $1",
            doc_id
        )
        
        if existing:
            print(f"Document {doc_id} already embedded")
            return
        
        # 调用 OpenAI 生成 embedding
        response = await self.openai.embeddings.create(
            model="text-embedding-3-large",
            input=content[:8191]  # 限制 token
        )
        embedding = response.data[0].embedding
        
        # 存储到 PostgreSQL
        await self.pg_pool.execute(
            """
            INSERT INTO document_embeddings (doc_id, embedding, content_hash)
            VALUES ($1, $2, $3)
            ON CONFLICT (doc_id) DO UPDATE
            SET embedding = $2, content_hash = $3, embedded_at = NOW()
            """,
            doc_id, embedding, content_hash
        )
    
    async def batch_embed(self, documents: list[dict], batch_size: int = 100):
        """批量处理文档"""
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i+batch_size]
            tasks = [
                self.embed_and_store(doc['id'], doc['content'])
                for doc in batch
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
            print(f"Processed batch {i//batch_size + 1}")
    
    async def close(self):
        await self.pg_pool.close()

# 使用示例
async def main():
    pipeline = EmbeddingPipeline()
    await pipeline.connect()
    
    # 从现有系统导入文档
    documents = await load_documents_from_source()
    await pipeline.batch_embed(documents)
    
    await pipeline.close()

if __name__ == "__main__":
    asyncio.run(main())
```

#### Step 3: 基础检索服务

```python
# src/retrieval_service.py
from elasticsearch import AsyncElasticsearch
import asyncpg
import redis.asyncio as redis

class HybridRetriever:
    def __init__(self):
        self.pg_pool = None
        self.es = None
        self.redis = None
    
    async def connect(self):
        self.pg_pool = await asyncpg.create_pool("postgresql://...")
        self.es = AsyncElasticsearch("http://localhost:9200")
        self.redis = redis.from_url("redis://localhost")
    
    async def vector_search(self, query_embedding: list[float], top_k: int = 300):
        """pgvector 向量检索"""
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
        
        rows = await self.pg_pool.fetch(
            f"""
            SELECT d.id, d.title, d.content, d.metadata,
                   1 - (de.embedding <=> $1::vector) AS similarity
            FROM documents d
            JOIN document_embeddings de ON d.id = de.doc_id
            WHERE d.is_deleted = FALSE
            ORDER BY de.embedding <=> $1::vector
            LIMIT $2
            """,
            embedding_str, top_k
        )
        
        return [dict(row) for row in rows]
    
    async def es_search(self, query: str, top_k: int = 300):
        """Elasticsearch BM25 检索"""
        response = await self.es.search(
            index="documents",
            body={
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "content", "keywords"],
                        "type": "best_fields",
                        "fuzziness": "AUTO"
                    }
                },
                "size": top_k
            }
        )
        
        return [
            {
                'id': hit['_source']['doc_id'],
                'title': hit['_source']['title'],
                'content': hit['_source']['content'],
                'metadata': hit['_source'],
                'score': hit['_score']
            }
            for hit in response['hits']['hits']
        ]
    
    def reciprocal_rank_fusion(self, vector_results, es_results, k=60):
        """RRF 融合"""
        from collections import defaultdict
        
        scores = defaultdict(float)
        all_docs = {}
        
        for rank, doc in enumerate(vector_results):
            scores[doc['id']] += 1.0 / (k + rank + 1)
            all_docs[doc['id']] = doc
        
        for rank, doc in enumerate(es_results):
            scores[doc['id']] += 1.0 / (k + rank + 1)
            all_docs[doc['id']] = doc
        
        ranked_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
        
        for doc_id in ranked_ids:
            all_docs[doc_id]['rrf_score'] = scores[doc_id]
        
        return [all_docs[doc_id] for doc_id in ranked_ids]
    
    async def search(self, query: str, query_embedding: list[float], top_k: int = 100):
        """混合检索主入口"""
        # 并行执行两路检索
        vector_results, es_results = await asyncio.gather(
            self.vector_search(query_embedding, top_k=300),
            self.es_search(query, top_k=300)
        )
        
        # 融合
        fused = self.reciprocal_rank_fusion(vector_results, es_results)
        
        return fused[:top_k]
```

#### Step 4: Redis 缓存层

```python
# src/cache_layer.py
import json
import hashlib
import redis.asyncio as redis

class RAGCache:
    def __init__(self):
        self.redis = None
    
    async def connect(self):
        self.redis = redis.from_url("redis://localhost")
    
    def _query_hash(self, query: str) -> str:
        return hashlib.md5(query.encode()).hexdigest()
    
    async def get(self, query: str) -> dict | None:
        key = f"rag:query:{self._query_hash(query)}"
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None
    
    async def set(self, query: str, result: dict, ttl: int = 86400):
        key = f"rag:query:{self._query_hash(query)}"
        await self.redis.setex(key, ttl, json.dumps(result))
    
    async def invalidate(self, doc_ids: list[str]):
        """文档更新时使缓失效（简化：清空所有）"""
        # 生产环境应该更精细地管理
        pattern = "rag:query:*"
        async for key in self.redis.scan_iter(pattern):
            await self.redis.delete(key)
```

---

### 阶段二：溯源图谱（Week 3-4）

#### Step 5: Neo4j 图谱构建

```python
# src/graph_builder.py
from neo4j import AsyncGraphDatabase

class KnowledgeGraph:
    def __init__(self):
        self.driver = None
    
    async def connect(self):
        self.driver = AsyncGraphDatabase.driver(
            "bolt://localhost:7687",
            auth=("neo4j", "password")
        )
    
    async def create_document(self, doc: dict):
        """创建文档节点"""
        async with self.driver.session() as session:
            await session.run("""
                MERGE (d:Document {id: $id})
                SET d.title = $title,
                    d.doc_type = $doc_type,
                    d.source = $source,
                    d.updated_at = datetime()
            """, **doc)
    
    async def create_section(self, section: dict):
        """创建章节节点"""
        async with self.driver.session() as session:
            await session.run("""
                MERGE (s:Section {id: $id})
                SET s.title = $title,
                    s.content = $content,
                    s.order = $order
            """, **section)
            
            # 创建 CONTAINS 关系
            await session.run("""
                MATCH (d:Document {id: $doc_id})
                MATCH (s:Section {id: $section_id})
                MERGE (d)-[:CONTAINS]->(s)
            """, doc_id=section['doc_id'], section_id=section['id'])
    
    async def get_references(self, section_id: str, max_depth: int = 3):
        """获取引用链"""
        async with self.driver.session() as session:
            result = await session.run("""
                MATCH (s:Section {id: $section_id})
                OPTIONAL MATCH path = (s)-[:REFERENCES*0..$max_depth]->(related:Section)
                RETURN 
                    s.title AS source_title,
                    [node IN nodes(path) | {
                        id: node.id,
                        title: node.title,
                        doc_id: node.doc_id
                    }] AS reference_chain
            """, section_id=section_id, max_depth=max_depth)
            
            record = await result.single()
            return record['reference_chain'] if record else []
    
    async def close(self):
        await self.driver.close()
```

---

### 阶段三：生成服务（Week 5-6）

#### Step 6: LLM 生成服务

```python
# src/generation_service.py
from openai import AsyncOpenAI

class AnswerGenerator:
    def __init__(self):
        self.openai = AsyncOpenAI()
    
    def build_prompt(self, query: str, context: str) -> str:
        return f"""
你是一个企业内部知识库的智能助手。基于以下上下文回答问题。

## 上下文
{context}

## 问题
{query}

## 回答要求
1. **优先使用上下文信息** - 不要编造上下文中没有的内容
2. **标注引用来源** - 每个关键信息后标注 [引用 X]
3. **承认信息不足** - 如果上下文不足以回答问题，明确说明
4. **引用格式** - [引用 X: 文档名]
5. **简洁清晰** - 优先给出直接答案，再补充细节

## 回答
"""
    
    async def generate(self, query: str, context: str) -> str:
        prompt = self.build_prompt(query, context)
        
        response = await self.openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
```

---

### 阶段四：API 服务（Week 7-8）

#### Step 7: FastAPI 服务

```python
# src/api/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import time

app = FastAPI(title="RAG API")

class QueryRequest(BaseModel):
    query: str
    user_id: str
    top_k: int = 10
    use_cache: bool = True

class QueryResponse(BaseModel):
    answer: str
    references: list[dict]
    latency_ms: int
    cache_hit: bool

@app.post("/api/v1/rag/query", response_model=QueryResponse)
async def query_knowledge(request: QueryRequest):
    start_time = time.time()
    
    # 初始化服务（生产环境应该用依赖注入）
    retriever = HybridRetriever()
    await retriever.connect()
    
    cache = RAGCache()
    await cache.connect()
    
    # 检查缓存
    if request.use_cache:
        cached = await cache.get(request.query)
        if cached:
            return QueryResponse(
                **cached,
                latency_ms=int((time.time() - start_time) * 1000),
                cache_hit=True
            )
    
    # 生成 embedding
    embedding = await generate_embedding(request.query)
    
    # 检索
    results = await retriever.search(request.query, embedding, top_k=request.top_k)
    
    # 生成答案
    generator = AnswerGenerator()
    context = build_context(results)
    answer = await generator.generate(request.query, context)
    
    # 构建响应
    response_data = {
        "answer": answer,
        "references": build_references(results)
    }
    
    # 写入缓存
    await cache.set(request.query, response_data)
    
    return QueryResponse(
        **response_data,
        latency_ms=int((time.time() - start_time) * 1000),
        cache_hit=False
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 测试验证

### 性能测试

```bash
# 使用 wrk 进行压力测试
wrk -t4 -c100 -d60s http://localhost:8000/api/v1/rag/query \
    -H "Content-Type: application/json" \
    -d '{"query":"测试查询","user_id":"test"}'
```

### 质量评估

```python
# 人工评估脚本
def evaluate_answer(answer, references, expected_answer):
    """
    评估维度：
    1. 准确性 - 答案是否正确
    2. 完整性 - 是否覆盖关键点
    3. 引用质量 - 引用是否相关
    """
    pass
```

---

## 部署配置

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: knowledge_base
      POSTGRES_USER: rag_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - esdata:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
  
  neo4j:
    image: neo4j:5.14
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
    volumes:
      - neo4jdata:/data
    ports:
      - "7474:7474"
      - "7687:7687"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  rag-api:
    build: .
    environment:
      - DATABASE_URL=postgresql://rag_user:${DB_PASSWORD}@postgres/knowledge_base
      - ES_URL=http://elasticsearch:9200
      - NEO4J_URL=bolt://neo4j:7687
      - REDIS_URL=redis://redis
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - elasticsearch
      - neo4j
      - redis

volumes:
  pgdata:
  esdata:
  neo4jdata:
```

---

## 运维监控

### Prometheus 指标

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'rag-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
```

### Grafana 面板

关键看板：
- 查询延迟 P50/P95/P99
- 缓存命中率
- LLM Token 消耗
- 错误率趋势

---

## 成本估算

### 一次性成本

| 项目 | 费用 |
|------|------|
| 100 万文档 Embedding | $1,000-2,000 |
| 开发人力（2 人月） | ¥60,000-100,000 |

### 月度成本

| 项目 | 费用 |
|------|------|
| 服务器（4 核 8G×3） | ¥1,500 |
| LLM API（1 万查询/天） | ¥3,000-5,000 |
| 运维人力 | ¥10,000 |

**总计**: 约 ¥15,000-20,000/月

---

## 下一步

1. 评审本方案
2. 确认资源投入
3. 启动开发环境
4. 开始 Week 1 任务
