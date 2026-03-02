# MemoryBear 入口点普查报告

## 📊 项目概览

**项目名称**: MemoryBear  
**仓库**: https://github.com/qudi17/MemoryBear  
**扫描时间**: 2026-03-02 20:10 GMT+8  
**研究深度**: Level 5

---

## 🎯 14 种入口点类型扫描结果

### 1. API 入口 ✅ 活跃

**位置**: `api/app/controllers/` (44 个控制器文件)

**主要路由注册** (`api/app/main.py`):
```python
# 管理端 API (JWT 认证)
app.include_router(manager_router, prefix="/api")
# 服务端 API (API Key 认证)
app.include_router(service_router, prefix="/v1")
```

**核心 API 入口点**:

| 控制器 | 路由前缀 | 主要功能 |
|--------|---------|---------|
| `auth_controller.py` | `/api/auth` | 认证/Token/刷新/登出 |
| `memory_agent_controller.py` | `/api/memory/agent` | 记忆代理服务 |
| `memory_storage_controller.py` | `/api/memory/storage` | 记忆存储管理 |
| `memory_dashboard_controller.py` | `/api/memory/dashboard` | 记忆仪表盘 |
| `knowledge_controller.py` | `/api/knowledge` | 知识库管理 |
| `document_controller.py` | `/api/document` | 文档管理 |
| `chunk_controller.py` | `/api/chunk` | 文本块管理 |
| `file_controller.py` | `/api/file` | 文件上传/管理 |
| `upload_controller.py` | `/api/upload` | 上传接口 |
| `workspace_controller.py` | `/api/workspace` | 工作空间管理 |
| `user_memory_controllers.py` | `/api/user/memory` | 用户记忆分析 |
| `emotion_controller.py` | `/api/emotion` | 情感分析 |
| `ontology_controller.py` | `/api/ontology` | 本体论管理 |
| `multi_agent_controller.py` | `/api/multi-agent` | 多 Agent 协调 |
| `tool_controller.py` | `/api/tool` | 工具管理 |
| `model_controller.py` | `/api/model` | 模型管理 |
| `prompt_optimizer_controller.py` | `/api/prompt/optimizer` | Prompt 优化 |
| `workflow/*` | `/api/workflow` | 工作流引擎 |

**关键 API 入口示例** (`api/app/controllers/auth_controller.py`):
```python
@router.post("/token", response_model=ApiResponse)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """获取访问令牌"""
    
@router.post("/refresh", response_model=ApiResponse)
async def refresh_token(refresh_token: str = Form(...)):
    """刷新访问令牌"""
```

---

### 2. CLI 入口 ✅ 活跃

**位置**: 多个主入口文件

| 文件 | 用途 |
|------|------|
| `api/main.py` | API 服务主入口 |
| `api/app/main.py` | FastAPI 应用入口 |
| `sandbox/main.py` | 沙箱服务入口 |
| `api/app/core/rag/crawler/__main__.py` | 爬虫模块 CLI |
| `api/app/core/rag/integrations/feishu/__main__.py` | 飞书集成 CLI |
| `api/app/core/rag/integrations/yuque/__main__.py` | 语雀集成 CLI |

---

### 3. Cron 定时任务 ✅ 活跃

**位置**: `api/app/celery_app.py`

**定时任务配置**:
```python
# Celery Beat schedule for periodic tasks
memory_increment_schedule = timedelta(hours=settings.MEMORY_INCREMENT_INTERVAL_HOURS)
memory_cache_regeneration_schedule = timedelta(hours=settings.MEMORY_CACHE_REGENERATION_HOURS)
workspace_reflection_schedule = timedelta(seconds=30)  # 每 30 秒运行一次
forgetting_cycle_schedule = timedelta(hours=24)  # 每 24 小时运行一次遗忘周期

beat_schedule_config = {
    "workspace-reflection": {
        "task": "app.core.memory.agent.reflection.timer",
        "schedule": workspace_reflection_schedule,
    },
    "memory-cache-regeneration": {
        "task": "app.core.memory.agent.health.check_read_service",
        "schedule": memory_cache_regeneration_schedule,
    },
    "forgetting-cycle": {
        "task": "app.core.memory.forget.trigger_forgetting_cycle",
        "schedule": forgetting_cycle_schedule,
    },
}
celery_app.conf.beat_schedule = beat_schedule_config
```

**定时任务列表**:
- `workspace-reflection`: 工作空间反思（每 30 秒）
- `memory-cache-regeneration`: 记忆缓存再生（每小时）
- `forgetting-cycle`: 遗忘周期（每 24 小时）
- `write-total-memory`: 写入总记忆（可配置）

---

### 4. Celery 任务 ✅ 活跃

**位置**: `api/app/tasks.py`

**核心 Celery 任务**:

| 任务名 | 功能 |
|--------|------|
| `tasks.process_item` | 通用任务处理 |
| `app.core.rag.tasks.parse_document` | 文档解析/向量化 |
| `app.core.rag.tasks.build_graphrag_for_kb` | 构建 GraphRAG |
| `app.core.rag.tasks.sync_knowledge_for_kb` | 知识库同步 |
| `app.core.memory.agent.read_message` | 记忆读取 |
| `app.core.memory.agent.write_message` | 记忆写入 |
| `app.core.memory.agent.reflection.timer` | 反思定时器 |
| `app.controllers.memory_storage_controller.search_all` | 记忆搜索 |

**任务示例** (`api/app/tasks.py:48-60`):
```python
@celery_app.task(name="app.core.rag.tasks.parse_document")
def parse_document(file_path: str, document_id: uuid.UUID):
    """
    Document parsing, vectorization, and storage
    """
    db = next(get_db())
    db_document = db.query(Document).filter(Document.id == document_id).first()
    # 文档解析逻辑...
```

---

### 5. 事件触发器 ⚠️ 有限

**位置**: 未发现独立 events/signals 目录  
**实现方式**: 通过 Celery 任务和 FastAPI 事件生命周期管理

**FastAPI 生命周期事件** (`api/app/main.py`):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 应用启动事件
    if settings.DB_AUTO_UPGRADE:
        # 自动数据库升级
    if settings.LOAD_MODEL:
        # 加载预定义模型
    yield
    # 应用关闭事件
```

---

### 6. Webhook ⚠️ 有限

**位置**: 未发现独立 webhooks 目录  
**实现方式**: 通过 API 控制器处理外部集成

**外部集成**:
- 飞书集成 (`api/app/core/rag/integrations/feishu/`)
- 语雀集成 (`api/app/core/rag/integrations/yuque/`)

---

### 7. 消息队列 ✅ 活跃

**位置**: `api/app/celery_app.py`, Redis

**消息队列配置**:
```python
# Celery 配置
celery_app = Celery(
    "memorybear",
    broker=settings.CELERY_BROKER_URL,  # Redis
    backend=settings.CELERY_RESULT_BACKEND,
)
```

**Redis 使用**:
- Celery Broker/Backend
- 异步任务队列
- 缓存层

---

### 8. 上传接口 ✅ 活跃

**位置**: `api/app/controllers/file_controller.py`, `upload_controller.py`

**上传接口示例** (`api/app/controllers/file_controller.py:45-68`):
```python
@router.post("/upload", response_model=ApiResponse)
async def upload_file(
    kb_id: UUID = Query(..., description="Knowledge base ID"),
    parent_id: Optional[UUID] = Query(None, description="Parent folder ID"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传文件到知识库"""
    api_logger.info(f"upload file request: kb_id={kb_id}, filename={file.filename}")
    
    upload_file = file_schema.FileCreate(
        kb_id=kb_id,
        parent_id=parent_id,
        filename=file.filename,
        file_size=file.size,
        content_type=file.content_type,
    )
    
    db_file = file_service.create_file(db=db, file=upload_file, current_user=current_user)
```

---

### 9. GraphQL ❌ 未使用

**扫描结果**: 未发现 `.graphql` 文件或 `schema.py`  
**技术栈**: 纯 RESTful API (FastAPI)

---

### 10. WebSocket ❌ 未使用

**扫描结果**: 未发现 WebSocket 相关代码  
**通信方式**: HTTP REST API + Celery 异步任务

---

### 11. 中间件 ✅ 活跃

**位置**: `sandbox/app/middleware/`

**中间件列表**:
- `auth.py`: 沙箱认证中间件
- `concurrency.py`: 并发控制中间件

**沙箱中间件示例** (`sandbox/app/middleware/auth.py`):
```python
# 沙箱请求认证和权限验证
```

---

### 12. 插件系统 ✅ 活跃

**位置**: `api/app/plugins/`

**插件注册** (`api/app/plugins/__init__.py`):
```python
def register_plugins(app: FastAPI):
    """注册所有插件"""
    app.include_router(
        # 插件路由
    )
```

**插件目录结构**:
```
api/app/plugins/
├── __init__.py
└── [插件模块]
```

---

### 13. 管理命令 ✅ 活跃

**位置**: `api/migrations/` (Alembic), `api/app/core/management/`

**数据库迁移命令**:
```bash
alembic upgrade head
alembic revision --autogenerate
```

**迁移版本**: 20+ 个迁移脚本 (`api/migrations/versions/`)

---

### 14. 测试入口 ✅ 活跃

**位置**: `api/tests/`

**测试文件列表**:
```
api/tests/workflow/nodes/test_variable_aggregator_node.py
api/tests/workflow/nodes/test_question_classifier_node.py
api/tests/workflow/nodes/test_breaker_node.py
api/tests/workflow/nodes/test_ifelse_node.py
api/tests/workflow/nodes/test_start_node.py
api/tests/workflow/nodes/test_code.py
api/tests/workflow/nodes/test_end_node.py
api/tests/workflow/nodes/test_llm_node.py
api/tests/workflow/nodes/test_assigner_node.py
api/tests/workflow/nodes/test_parameter_extractor_node.py
api/tests/workflow/nodes/test_jinja_render_node.py
api/tests/workflow/executor/test_vairable_pool.py
```

**测试框架**: pytest

---

## 📈 入口点统计

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 活跃 | 10 | 71% |
| ⚠️ 有限 | 2 | 14% |
| ❌ 未使用 | 2 | 14% |

**活跃入口点**:
1. API 入口 (FastAPI)
2. CLI 入口 (多个主程序)
3. Cron 定时任务 (Celery Beat)
4. Celery 任务 (异步任务队列)
5. 消息队列 (Redis + Celery)
6. 上传接口 (文件/文档)
7. 中间件 (沙箱)
8. 插件系统
9. 管理命令 (Alembic)
10. 测试入口 (pytest)

---

## 🔍 核心架构特征

### 双服务架构
1. **API 服务** (`api/`): FastAPI + Celery + Redis
2. **沙箱服务** (`sandbox/`): 安全代码执行环境

### 记忆系统入口
- **记忆代理**: `memory_agent_controller.py`
- **记忆存储**: `memory_storage_controller.py`
- **记忆遗忘**: `memory_forget_controller.py`
- **记忆反思**: `memory_reflection_controller.py`
- **工作记忆**: `memory_working_controller.py`
- **短期记忆**: `memory_short_term_controller.py`
- **情景记忆**: `memory_episodic_controller.py`
- **外显记忆**: `memory_explicit_controller.py`
- **知觉记忆**: `memory_perceptual_controller.py`

### RAG 系统入口
- **文档解析**: `parse_document` (Celery 任务)
- **GraphRAG**: `build_graphrag_for_kb` (Celery 任务)
- **知识库同步**: `sync_knowledge_for_kb` (Celery 任务)
- **爬虫**: `api/app/core/rag/crawler/`

---

## 📁 关键文件路径

```
memorybear/
├── api/
│   ├── app/
│   │   ├── main.py              # FastAPI 主入口
│   │   ├── celery_app.py        # Celery 配置
│   │   ├── tasks.py             # Celery 任务定义
│   │   ├── controllers/         # API 控制器 (44 个文件)
│   │   ├── core/                # 核心模块
│   │   │   ├── memory/          # 记忆系统
│   │   │   ├── rag/             # RAG 引擎
│   │   │   ├── workflow/        # 工作流引擎
│   │   │   └── tools/           # 工具系统
│   │   └── middleware/          # 中间件
│   └── tests/                   # 测试目录
├── sandbox/
│   ├── main.py                  # 沙箱主入口
│   └── app/                     # 沙箱应用
└── web/                         # 前端应用
```

---

## ✅ 阶段 1 完成

**扫描完成时间**: 2026-03-02 20:15 GMT+8  
**入口点总数**: 14 种类型  
**活跃入口点**: 10 种  
**下一 stage**: 阶段 2 - 模块化分析
