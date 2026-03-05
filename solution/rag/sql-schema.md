# 数据库 Schema 设计

## PostgreSQL

### 01_extensions.sql

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 启用其他扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 用于模糊匹配
```

### 02_tables.sql

```sql
-- 文档主表
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(200),          -- 来源系统/文件路径
    doc_type VARCHAR(50),         -- 文档类型：manual/spec/faq/policy/etc
    mime_type VARCHAR(50),        -- 原始文件类型
    file_size BIGINT,             -- 文件大小（字节）
    
    -- 元数据（JSONB 支持灵活查询）
    metadata JSONB DEFAULT '{}',
    
    -- 业务字段
    department VARCHAR(100),      -- 所属部门
    tags TEXT[],                  -- 标签数组
    language VARCHAR(10) DEFAULT 'zh',
    
    -- 状态
    is_deleted BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    
    -- 审计
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 向量嵌入表
CREATE TABLE document_embeddings (
    doc_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    
    -- 向量（OpenAI text-embedding-3-large = 1536 维）
    embedding vector(1536),
    
    -- 用于增量更新检测
    content_hash VARCHAR(64),
    content_length INTEGER,
    
    -- Embedding 模型信息
    model_name VARCHAR(50) DEFAULT 'text-embedding-3-large',
    model_version VARCHAR(20),
    
    -- 时间戳
    embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文档章节表（支持细粒度检索）
CREATE TABLE document_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    -- 章节信息
    section_id VARCHAR(100),      -- 原始章节 ID
    title VARCHAR(500),
    content TEXT NOT NULL,
    
    -- 层级
    level INTEGER DEFAULT 1,      -- 章节层级（1=章，2=节，3=小节）
    parent_id UUID REFERENCES document_sections(id),
    order_index INTEGER,          -- 同级别中的顺序
    
    -- 向量嵌入
    embedding vector(1536),
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 查询历史表
CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100) NOT NULL,
    
    -- 查询内容
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    
    -- 结果
    result_count INTEGER,
    latency_ms INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    
    -- 反馈
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 引用反馈表（用于优化）
CREATE TABLE citation_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID REFERENCES query_history(id),
    doc_id UUID REFERENCES documents(id),
    
    -- 反馈类型
    feedback_type VARCHAR(20),    -- relevant/irrelevant/misleading
    
    -- 备注
    comment TEXT,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- 热门查询统计表
CREATE TABLE query_statistics (
    date DATE PRIMARY KEY,
    total_queries INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_latency_ms NUMERIC(10,2),
    cache_hit_rate NUMERIC(5,4),
    avg_rating NUMERIC(3,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 03_indexes.sql

```sql
-- pgvector HNSW 索引（核心）
CREATE INDEX ON document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 章节向量索引
CREATE INDEX ON document_sections 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 查询历史向量索引（用于相似查询推荐）
CREATE INDEX ON query_history 
USING hnsw (query_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 全文搜索索引
CREATE INDEX ON documents USING GIN (to_tsvector('simple', content));

-- JSONB 元数据索引
CREATE INDEX ON documents USING GIN (metadata);

-- 标签索引
CREATE INDEX ON documents USING GIN (tags);

-- 常用查询字段索引
CREATE INDEX idx_documents_type ON documents(doc_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_documents_department ON documents(department) WHERE is_deleted = FALSE;
CREATE INDEX idx_documents_published ON documents(is_published) WHERE is_deleted = FALSE;
CREATE INDEX idx_documents_created ON documents(created_at DESC);

-- 查询历史索引
CREATE INDEX idx_query_history_user ON query_history(user_id, created_at DESC);
CREATE INDEX idx_query_history_date ON query_history(created_at DESC);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_embeddings_updated_at
    BEFORE UPDATE ON document_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 04_views.sql

```sql
-- 文档统计视图
CREATE VIEW v_document_stats AS
SELECT 
    doc_type,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE is_published) AS published_count,
    AVG(LENGTH(content)) AS avg_content_length,
    MAX(created_at) AS latest_created
FROM documents
WHERE is_deleted = FALSE
GROUP BY doc_type;

-- 热门查询视图
CREATE VIEW v_popular_queries AS
SELECT 
    query_text,
    COUNT(*) AS query_count,
    COUNT(DISTINCT user_id) AS unique_users,
    AVG(rating) AS avg_rating
FROM query_history
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY query_text
HAVING COUNT(*) >= 5
ORDER BY query_count DESC
LIMIT 100;

-- 低质量文档视图（用于优化）
CREATE VIEW v_low_quality_docs AS
SELECT 
    d.id,
    d.title,
    d.content,
    COUNT(cf.id) AS irrelevant_count
FROM documents d
LEFT JOIN citation_feedback cf ON d.id = cf.doc_id 
    AND cf.feedback_type = 'irrelevant'
WHERE d.is_deleted = FALSE
GROUP BY d.id, d.title, d.content
HAVING COUNT(cf.id) >= 3
ORDER BY irrelevant_count DESC;
```

---

## Elasticsearch

### 索引映射

```json
PUT /documents
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "chinese_analyzer": {
          "type": "custom",
          "tokenizer": "ik_max_word",
          "filter": ["lowercase"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "doc_id": { "type": "keyword" },
      "title": { 
        "type": "text",
        "fields": { 
          "keyword": { "type": "keyword" }
        },
        "boost": 3,
        "analyzer": "chinese_analyzer"
      },
      "content": { 
        "type": "text",
        "analyzer": "chinese_analyzer"
      },
      "doc_type": { "type": "keyword" },
      "department": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "language": { "type": "keyword" },
      "is_published": { "type": "boolean" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  }
}
```

### 章节索引

```json
PUT /document_sections
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "section_id": { "type": "keyword" },
      "doc_id": { "type": "keyword" },
      "title": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "content": { "type": "text" },
      "level": { "type": "integer" },
      "parent_id": { "type": "keyword" },
      "order_index": { "type": "integer" }
    }
  }
}
```

---

## Neo4j

### 约束和索引

```cypher
-- 文档唯一约束
CREATE CONSTRAINT document_id IF NOT EXISTS
FOR (d:Document) REQUIRE d.id IS UNIQUE;

-- 章节唯一约束
CREATE CONSTRAINT section_id IF NOT EXISTS
FOR (s:Section) REQUIRE s.id IS UNIQUE;

-- 实体唯一约束
CREATE CONSTRAINT entity_name IF NOT EXISTS
FOR (e:Entity) REQUIRE e.name IS UNIQUE;

-- 索引
CREATE INDEX document_title IF NOT EXISTS FOR (d:Document) ON (d.title);
CREATE INDEX section_content IF NOT EXISTS FOR (s:Section) ON (s.content(256));
```

### 图谱模型

```cypher
// 节点类型
// - Document: 文档
// - Section: 章节
// - Entity: 实体（产品名、术语等）
// - User: 用户（用于权限）

// 关系类型
// - CONTAINS: Document -> Section
// - REFERENCES: Section -> Section
// - MENTIONS: Section -> Entity
// - HAS_ACCESS: User -> Document
```

---

## Redis

### Key 命名规范

```
# 查询缓存
rag:query:{md5_hash} → JSON  (TTL 24h)

# 会话历史
rag:session:{user_id} → JSON List  (TTL 1h)

# Embedding 缓存
rag:embedding:{content_hash} → Float32 Array  (永久)

# 热门查询
rag:hot_queries → ZSET  (TTL 7d)

# 速率限制
rag:ratelimit:{user_id} → Counter  (TTL 1min)

# 系统状态
rag:status:last_sync → Timestamp
rag:status:doc_count → Integer
```

---

## 数据同步

### 文档变更同步流程

```python
async def sync_document_change(doc_id: str, operation: str):
    """
    文档变更时同步到所有存储
    
    operation: create | update | delete
    """
    if operation == 'delete':
        # 1. 软删除标记
        await pg.execute("UPDATE documents SET is_deleted = TRUE WHERE id = $1", doc_id)
        
        # 2. 删除 ES 索引
        await es.delete(index="documents", id=doc_id)
        
        # 3. 删除 Neo4j 节点
        await neo4j.run("MATCH (d:Document {id: $id}) DETACH DELETE d", doc_id)
        
        # 4. 使缓存失效
        await redis.delete_pattern("rag:query:*")
        
    elif operation == 'create' or operation == 'update':
        # 1. 获取文档
        doc = await pg.fetchrow("SELECT * FROM documents WHERE id = $1", doc_id)
        
        # 2. 生成 embedding
        embedding = await generate_embedding(doc['content'])
        
        # 3. 存储到 pgvector
        await pg.execute("""
            INSERT INTO document_embeddings (doc_id, embedding, content_hash)
            VALUES ($1, $2, $3)
            ON CONFLICT (doc_id) DO UPDATE
            SET embedding = $2, content_hash = $3, embedded_at = NOW()
        """, doc_id, embedding, hashlib.sha256(doc['content'].encode()).hexdigest())
        
        # 4. 同步到 ES
        await es.index(index="documents", id=doc_id, document=doc)
        
        # 5. 创建/更新 Neo4j 节点
        await neo4j.run("""
            MERGE (d:Document {id: $id})
            SET d.title = $title, d.doc_type = $doc_type
        """, id=doc_id, title=doc['title'], doc_type=doc['doc_type'])
        
        # 6. 使缓存失效
        await redis.delete_pattern("rag:query:*")
```
