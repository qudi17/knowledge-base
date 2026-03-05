# 研究项目标签体系

**版本**: v2.0
**创建日期**: 2026-03-04
**用途**: 为 GitHub 研究项目打标签，便于应用场景匹配和项目对比

---

## 🏷️ 标签体系（3 级）

### 一级标签：应用场景（9 个）

**用于项目对比分析** - 匹配到相同一级标签的项目会进行深度对比

| 标签 | 说明 | 判断标准 | 示例项目 |
|------|------|---------|---------|
| **RAG** | 检索增强生成 | 有数据导入→Chunking→向量化→检索→合成流程 | LlamaIndex, Dify, AnythingLLM |
| **Agent** | 智能体/Agent 系统 | 有 Agent Loop、工具调用、任务编排 | nanobot, AutoGPT, OpenHands |
| **Memory** | 记忆系统 | 有短期/长期记忆、记忆检索优化 | MemoryBear |
| **Workflow** | 工作流编排 | 有可视化/DSL 工作流定义和执行引擎 | Dify, claude-flow, n8n |
| **Data** | 数据处理/分析 | 有数据读取→转换→质量检查管道 | MarkItDown |
| **Voice** | 语音处理 | 有 STT/TTS/语音处理功能 | Qwen3-TTS, Whisper |
| **Image** | 图像处理 | 有图像理解/生成/处理功能 | Stable Diffusion, ComfyUI |
| **Code** | 代码生成/分析 | 有代码理解/生成/分析功能 | Cursor, Codeium |
| **Search** | 搜索/推荐 | 有索引构建/搜索算法/推荐系统 | txtai, Elasticsearch |

### 二级标签：产品形态（5 个）

**用于分析重点差异化** - 不同形态关注不同的分析维度

| 标签 | 说明 | 判断标准 | 示例项目 |
|------|------|---------|---------|
| **Platform** | 完整平台产品 | 有 UI/用户管理/部署方案/权限控制 | Dify, AnythingLLM, OpenHands |
| **Framework** | 开发框架 | 有 API 设计/扩展点/抽象层 | LlamaIndex, Haystack, LangGraph |
| **SDK/Library** | 开发库 | 可 pip/npm install，提供 API | nanobot, chromadb |
| **CLI** | 命令行工具 | 有命令行入口，支持终端交互 | nanobot (CLI 模式) |
| **Service** | 云服务 | 有 API 端点/SLA/计费模式 | Pinecone, Vercel AI |

### 三级标签：技术特性（动态生成）

**用于技术选型参考** - 根据项目实际使用的技术动态生成，不预先定义

| 类别 | 识别维度 | 动态标签示例 |
|------|---------|-------------|
| **数据库/存储** | 依赖项、导入语句 | `PostgreSQL`, `Redis`, `MongoDB`, `Elasticsearch`, `S3`, `SQLite` |
| **AI/ML 框架** | 依赖项、核心模块 | `PyTorch`, `TensorFlow`, `Transformers`, `LangChain`, `LlamaIndex` |
| **部署/运维** | 配置文件、脚本 | `Docker`, `Kubernetes`, `Helm`, `Terraform`, `GitHub Actions` |
| **前端技术** | 目录结构、依赖项 | `React`, `Vue`, `Next.js`, `Tailwind`, `TypeScript` |
| **后端技术** | 依赖项、框架导入 | `FastAPI`, `Django`, `Flask`, `Express`, `Spring Boot` |
| **消息/队列** | 依赖项、配置 | `Kafka`, `RabbitMQ`, `Celery`, `Redis Stream` |
| **认证/安全** | 依赖项、中间件 | `OAuth2`, `JWT`, `OIDC`, `Passport` |
| **云服务** | 依赖项、配置 | `AWS`, `GCP`, `Azure`, `Vercel`, `Supabase` |

**动态标签生成规则**：
1. 从 `pyproject.toml`/`package.json`/`requirements.txt` 提取主要依赖
2. 从目录结构识别技术栈（如 `docker/`, `k8s/`, `frontend/`）
3. 从代码导入语句识别关键库（如 `import torch`, `from fastapi import`）
4. 选择最具代表性的 3-5 个技术作为标签

---

## 📝 标签使用规则

### 标签识别流程

在研究过程中自动识别标签：

```
Round 1: GitHub API 获取项目基础信息
  ↓
Round 2: 根据 README 和技术栈初步判断标签
  ↓
Round 3: 分析核心代码模块确认标签
  ↓
Round 4: 最终标签判定并记录
```

### 标签判定标准

**一级标签（应用场景）判定**：
- 查看项目 README 定位描述
- 检查核心模块目录结构
- 分析主要功能实现

**二级标签（产品形态）判定**：
- Platform：检查是否有 `ui/`, `web/`, `frontend/` 目录
- Framework：检查是否有清晰的 API 层和扩展点
- SDK/Library：检查是否有 `pyproject.toml`/`package.json` 发布配置
- CLI：检查是否有命令行入口 (`__main__.py`, `bin/`, `cli/`)
- Service：检查是否有 API 端点定义和服务部署配置

**三级标签（技术特性）动态生成**：
1. 扫描依赖文件：`pyproject.toml`/`package.json`/`requirements.txt`
2. 分析目录结构：`docker/`, `k8s/`, `frontend/`, `mobile/`
3. 提取导入语句：`import torch`, `from fastapi import`
4. 选择 3-5 个最具代表性的技术作为标签

### 标签格式

```markdown
# 报告元数据

**应用场景标签**: RAG, Agent
**产品形态标签**: Framework, SDK/Library
**技术特性标签**: FastAPI, PyTorch, Docker, Redis, PostgreSQL
```

**注意**: 三级标签（技术特性）是动态生成的，每个项目的标签都不同。

---

## 🆚 对比规则

### 对比触发条件

- **一级标签 ≥1 个匹配** → 触发对比分析
- 二级、三级标签不参与对比判断，仅用于筛选

### 对比示例

```
项目 A 标签：RAG, Framework, [PyTorch, Transformers, Faiss]
项目 B 标签：RAG, Platform, [Docker, PostgreSQL, Redis]
项目 C 标签：Agent, SDK/Library, [FastAPI, SQLAlchemy]

A vs B: 一级标签匹配 RAG → 需要对比 ✅
A vs C: 一级标签无匹配 → 不对比 ❌

注意：三级标签是动态生成的，不同项目有不同的技术特性标签
```

### 对比文件组织

**文件命名**: `<一级标签>-comparison.md`

**位置**: `research-reports/comparisons/<一级标签>-comparison.md`

**更新策略**:
- 每完成一个项目研究，更新所有匹配一级标签的对比文件
- 例如：MemoryBear（`Memory`, `RAG`）完成研究后：
  - 更新 `Memory-comparison.md`
  - 更新 `RAG-comparison.md`

---

## 📊 标签索引示例

### RAG 相关
- LlamaIndex (`RAG`, `Framework`, [PyTorch, Transformers, Faiss])
- Dify (`RAG`, `Platform`, [Docker, PostgreSQL, Redis, Elasticsearch])
- AnythingLLM (`RAG`, `Platform`, [Node.js, React, SQLite])
- MemoryBear (`RAG`, `Memory`, [Neo4j, Elasticsearch, Python])

### Agent 相关
- nanobot (`Agent`, `SDK/Library`, `CLI`, [FastAPI, SQLAlchemy, WebSocket])
- AutoGPT (`Agent`, `Framework`, [Python, OpenAI API, Docker])
- OpenHands (`Agent`, `Platform`, [React, Python, Docker, Kubernetes])

### Memory 相关
- MemoryBear (`Memory`, `RAG`, [Neo4j, Elasticsearch, Python])

---

## 🎯 选型推荐矩阵

| 需求场景 | 推荐标签组合 | 典型技术特性 |
|---------|------------|-------------|
| 企业 RAG 平台 | RAG + Platform | Docker, PostgreSQL, Redis, Elasticsearch |
| 开发者 RAG 框架 | RAG + Framework | PyTorch, Transformers, Faiss |
| 轻量 Agent | Agent + SDK/Library + CLI | FastAPI, SQLAlchemy, WebSocket |
| 完整 Agent 平台 | Agent + Platform | React, Python, Docker, Kubernetes |
| 记忆系统 | Memory + Knowledge-Graph | Neo4j, Elasticsearch, Python |
| 文档处理管道 | Data + Multi-Modal | Python, OCR, Pillow |

**注意**: 三级标签（技术特性）是动态生成的，根据每个项目的实际技术栈自动生成。

---

## 📝 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-03-04 | 创建标签体系 v2.0（应用场景/产品形态/技术特性） |
| 2026-03-04 | v3.0: 三级标签改为动态生成，不再预定义固定标签 |

---

**版本**: v3.0
**最后更新**: 2026-03-04
**维护者**: github-deep-research
