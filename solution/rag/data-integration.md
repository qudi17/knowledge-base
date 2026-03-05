# 外部数据集成与文档处理流程

## 概述

本文档描述两个关键扩展：

1. **外部数据集成** - 从企业现有系统同步文档
2. **文档处理流程** - PDF/Word/Excel 等商业文档的解析、分块、质量过滤

---

## 一、外部数据集成

### 1.1 支持的数据源

| 数据源 | 类型 | 集成方式 | 同步频率 | 优先级 |
|--------|------|----------|----------|--------|
| Confluence | Wiki | REST API | 实时（webhook） | P0 |
| SharePoint | 文档库 | Microsoft Graph API | 每日 | P0 |
| 文件系统 | 本地/NAS | 文件监听 | 实时 | P0 |
| 数据库 | 业务数据 | JDBC/查询 | 每日/实时 | P1 |
| 企业微信/钉钉 | 聊天记录 | API | 每日 | P2 |
| Email | 邮件归档 | IMAP/API | 每日 | P2 |
| Web 站点 | 公开文档 | 爬虫 | 每周 | P3 |

---

### 1.2 Confluence 集成

#### API 配置

```python
# src/integrations/confluence.py
import aiohttp
from typing import AsyncIterator

class ConfluenceSync:
    def __init__(self, base_url: str, username: str, api_token: str):
        self.base_url = base_url.rstrip('/')
        self.auth = aiohttp.BasicAuth(username, api_token)
        self.session = None
    
    async def connect(self):
        self.session = aiohttp.ClientSession(auth=self.auth)
    
    async def list_spaces(self) -> list[dict]:
        """获取所有空间"""
        url = f"{self.base_url}/rest/api/space"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return data['results']
    
    async def iter_pages(self, space_key: str) -> AsyncIterator[dict]:
        """迭代获取空间下的所有页面（分页）"""
        start = 0
        limit = 100
        
        while True:
            url = f"{self.base_url}/rest/api/content"
            params = {
                'spaceKey': space_key,
                'type': 'page',
                'expand': 'body.storage,version,ancestors',
                'start': start,
                'limit': limit
            }
            
            async with self.session.get(url, params=params) as resp:
                data = await resp.json()
                
                for page in data['results']:
                    yield {
                        'id': page['id'],
                        'title': page['title'],
                        'content': page['body']['storage']['value'],  # HTML
                        'version': page['version']['number'],
                        'ancestors': page.get('ancestors', []),
                        'source': f"confluence:{space_key}:{page['id']}"
                    }
                
                if data['_links'].get('next') is None:
                    break
                start += limit
    
    async def get_updates(self, space_key: str, since: str) -> AsyncIterator[dict]:
        """获取增量更新（基于 CQL）"""
        cql = f"space = '{space_key}' AND lastModified >= '{since}'"
        url = f"{self.base_url}/rest/api/search"
        params = {'cql': cql, 'expand': 'content.body.storage'}
        
        async with self.session.get(url, params=params) as resp:
            data = await resp.json()
            for result in data['results']:
                content = result['content']
                yield {
                    'id': content['id'],
                    'title': content['title'],
                    'content': content['body']['storage']['value'],
                    'source': f"confluence:{space_key}:{content['id']}"
                }
    
    async def close(self):
        if self.session:
            await self.session.close()
```

#### 同步流程

```python
async def sync_confluence():
    sync = ConfluenceSync(
        base_url="https://your-company.atlassian.net/wiki",
        username="api-user@company.com",
        api_token="your-api-token"
    )
    await sync.connect()
    
    spaces = await sync.list_spaces()
    
    for space in spaces:
        space_key = space['key']
        
        # 获取上次同步时间
        last_sync = await get_last_sync_time(f"confluence:{space_key}")
        
        if last_sync:
            # 增量同步
            async for page in sync.get_updates(space_key, last_sync):
                await process_document(page)
        else:
            # 全量同步
            async for page in sync.iter_pages(space_key):
                await process_document(page)
        
        await update_sync_time(f"confluence:{space_key}")
    
    await sync.close()
```

---

### 1.3 SharePoint 集成

#### Microsoft Graph API

```python
# src/integrations/sharepoint.py
from msal import ConfidentialClientApplication
import aiohttp

class SharePointSync:
    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        
        # 获取访问令牌
        app = ConfidentialClientApplication(
            client_id=client_id,
            client_credential=client_secret,
            authority=f"https://login.microsoftonline.com/{tenant_id}"
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        self.access_token = result['access_token']
        self.session = None
    
    async def connect(self):
        self.session = aiohttp.ClientSession(
            headers={'Authorization': f'Bearer {self.access_token}'}
        )
    
    async def list_drives(self) -> list[dict]:
        """获取所有文档库"""
        url = "https://graph.microsoft.com/v1.0/sites/root/drives"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return data['value']
    
    async def iter_files(self, drive_id: str, folder_path: str = "/") -> AsyncIterator[dict]:
        """迭代获取文件"""
        url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:{folder_path}:/children"
        
        while url:
            async with self.session.get(url) as resp:
                data = await resp.json()
                
                for item in data['value']:
                    if 'file' in item:  # 只处理文件
                        # 下载文件内容
                        content = await self.download_file(item['@microsoft.graph.downloadUrl'])
                        
                        yield {
                            'id': item['id'],
                            'name': item['name'],
                            'content': content,
                            'size': item['size'],
                            'modified': item['lastModifiedDateTime'],
                            'source': f"sharepoint:{drive_id}:{item['id']}"
                        }
                
                url = data.get('@odata.nextLink')
    
    async def download_file(self, download_url: str) -> bytes:
        """下载文件内容"""
        async with self.session.get(download_url) as resp:
            return await resp.read()
    
    async def close(self):
        if self.session:
            await self.session.close()
```

---

### 1.4 文件系统监听

```python
# src/integrations/file_watcher.py
import asyncio
from pathlib import Path
from watchfiles import awatch

class FileSystemSync:
    def __init__(self, root_path: str, patterns: list[str]):
        self.root = Path(root_path)
        self.patterns = patterns  # ['*.pdf', '*.docx', '*.xlsx']
        self.session = None
    
    async def watch(self):
        """监听文件变化"""
        async for changes in awatch(self.root, watch_filter=lambda c, p: any(p.endswith(ext) for ext in self.patterns)):
            for change_type, path_str in changes:
                path = Path(path_str)
                rel_path = path.relative_to(self.root)
                
                if change_type.name == 'deleted':
                    await self.handle_delete(rel_path)
                else:
                    await self.handle_file_change(change_type.name, path)
    
    async def handle_file_change(self, change_type: str, path: Path):
        """处理文件变更"""
        try:
            content = path.read_bytes()
            
            await process_document({
                'id': str(path),
                'title': path.stem,
                'content': content,
                'file_type': path.suffix,
                'size': path.stat().st_size,
                'modified': path.stat().st_mtime,
                'source': f"filesystem:{path}"
            })
        except Exception as e:
            print(f"Error processing {path}: {e}")
    
    async def handle_delete(self, rel_path: Path):
        """处理文件删除"""
        source = f"filesystem:{rel_path}"
        await mark_document_deleted(source)
```

---

### 1.5 统一同步调度器

```python
# src/integrations/scheduler.py
import asyncio
from datetime import datetime

class SyncScheduler:
    def __init__(self):
        self.tasks = {}
    
    def register(self, name: str, sync_func, schedule: str):
        """注册同步任务
        
        schedule: cron 表达式或间隔（如 'daily', 'hourly', '*/30m'）
        """
        self.tasks[name] = {
            'func': sync_func,
            'schedule': schedule,
            'last_run': None,
            'next_run': None
        }
    
    async def run_all(self):
        """运行所有同步任务"""
        tasks = []
        for name, task in self.tasks.items():
            tasks.append(self.run_task(name, task))
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def run_task(self, name: str, task: dict):
        """运行单个任务"""
        try:
            print(f"Starting sync: {name}")
            start = datetime.now()
            
            await task['func']()
            
            task['last_run'] = start
            print(f"Completed sync: {name} in {datetime.now() - start}")
        except Exception as e:
            print(f"Error in sync {name}: {e}")
    
    async def start_scheduler(self):
        """启动调度器"""
        while True:
            now = datetime.now()
            
            for name, task in self.tasks.items():
                if self.should_run(task['schedule'], now):
                    asyncio.create_task(self.run_task(name, task))
            
            await asyncio.sleep(60)  # 每分钟检查一次
    
    def should_run(self, schedule: str, now: datetime) -> bool:
        """判断是否应该运行"""
        # 简化实现，生产环境使用 APScheduler 或 croniter
        if schedule == 'daily':
            return now.hour == 2 and now.minute == 0
        elif schedule == 'hourly':
            return now.minute == 0
        return False
```

---

## 二、文档处理流程

### 2.1 整体流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  原始文档   │ →   │  文档解析   │ →   │  内容提取   │
│ PDF/Word/   │     │  Unstructured│    │  文本/表格  │
│ Excel       │     │  /Tika      │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  向量存储   │ ←   │  Embedding   │ ←   │  智能分块   │
│  PostgreSQL │     │  生成        │     │  质量过滤   │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

### 2.2 文档解析引擎

#### 方案选型

| 方案 | License | PDF | Word | Excel | 表格提取 | 中文支持 |
|------|---------|-----|------|-------|----------|----------|
| **Unstructured** | Apache 2.0 | ✅ | ✅ | ✅ | ⚠️ 一般 | ✅ |
| **Apache Tika** | Apache 2.0 | ✅ | ✅ | ✅ | ⚠️ 一般 | ✅ |
| **PyMuPDF** | AGPL | ✅ | ❌ | ❌ | ❌ | ✅ |
| **python-docx** | MIT | ❌ | ✅ | ❌ | ⚠️ | ✅ |
| **openpyxl** | MIT | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Camelot** | MIT | ✅ | ❌ | ❌ | ✅ 优秀 | ⚠️ |

**推荐**: Unstructured（统一接口）+ 专用库（高质量需求）

#### Unstructured 集成

```python
# src/processing/unstructured_parser.py
from unstructured.partition.auto import partition
from unstructured.documents.elements import Text, Table, Title
import io

class UnstructuredParser:
    def __init__(self):
        pass
    
    async def parse(self, file_bytes: bytes, filename: str) -> dict:
        """解析文档"""
        file_like = io.BytesIO(file_bytes)
        
        elements = partition(file=file_like, filename=filename)
        
        # 分类提取
        content = {
            'title': '',
            'sections': [],
            'tables': [],
            'metadata': {}
        }
        
        current_section = {'title': '', 'content': []}
        
        for elem in elements:
            if isinstance(elem, Title):
                # 保存之前的 section
                if current_section['content']:
                    content['sections'].append({
                        'title': current_section['title'],
                        'content': '\n'.join(current_section['content'])
                    })
                # 开始新 section
                current_section = {'title': str(elem), 'content': []}
            
            elif isinstance(elem, Table):
                content['tables'].append({
                    'html': elem.metadata.text_as_html,
                    'caption': getattr(elem.metadata, 'caption', None)
                })
            
            elif isinstance(elem, Text):
                current_section['content'].append(str(elem))
        
        # 保存最后一个 section
        if current_section['content']:
            content['sections'].append({
                'title': current_section['title'],
                'content': '\n'.join(current_section['content'])
            })
        
        # 提取元数据
        content['metadata'] = {
            'page_count': getattr(elements.metadata, 'page_number', None),
            'language': self.detect_language(elements),
            'word_count': sum(len(str(e).split()) for e in elements)
        }
        
        return content
    
    def detect_language(self, elements) -> str:
        """检测文档语言"""
        # 简单实现，生产环境用 langdetect 或 fasttext
        text = ' '.join(str(e) for e in elements[:10])
        if any('\u4e00' <= c <= '\u9fff' for c in text):
            return 'zh'
        return 'en'
```

#### 表格专项处理

```python
# src/processing/table_extractor.py
import camelot
import pandas as pd
import io

class TableExtractor:
    def __init__(self):
        pass
    
    def extract_from_pdf(self, pdf_bytes: bytes) -> list[dict]:
        """从 PDF 提取表格（Camelot）"""
        file_like = io.BytesIO(pdf_bytes)
        
        # 尝试 Lattice 模式（有框线）
        tables = camelot.read_pdf(file_like, pages='all', flavor='lattice')
        
        if len(tables) == 0:
            # 尝试 Stream 模式（无框线）
            tables = camelot.read_pdf(file_like, pages='all', flavor='stream')
        
        results = []
        for table in tables:
            results.append({
                'data': table.df.to_dict('records'),  # 转为 JSON
                'html': table.df.to_html(),
                'page': table.page,
                'accuracy': table.parsing_report.get('accuracy', 0),
                'bbox': table.bbox  # 表格位置
            })
        
        return results
    
    def extract_from_excel(self, excel_bytes: bytes) -> list[dict]:
        """从 Excel 提取表格"""
        df_dict = pd.read_excel(io.BytesIO(excel_bytes), sheet_name=None)
        
        results = []
        for sheet_name, df in df_dict.items():
            results.append({
                'data': df.to_dict('records'),
                'sheet_name': sheet_name,
                'row_count': len(df),
                'col_count': len(df.columns)
            })
        
        return results
```

---

### 2.3 智能分块策略

```python
# src/processing/chunker.py
from langchain.text_splitter import (
    RecursiveCharacterTextSplitter,
    TokenTextSplitter
)
from typing import List, Dict

class SmartChunker:
    def __init__(self):
        # 按字符分割（适合中文）
        self.char_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            length_function=len,
            separators=["\n\n", "\n", "。", "！", "？", "；", " ", ""]
        )
        
        # 按 token 分割（适合英文/代码）
        self.token_splitter = TokenTextSplitter(
            chunk_size=512,
            chunk_overlap=50
        )
    
    def chunk(self, content: str, language: str = 'zh') -> List[Dict]:
        """智能分块"""
        if language == 'zh':
            chunks = self.char_splitter.split_text(content)
        else:
            chunks = self.token_splitter.split_text(content)
        
        return [
            {
                'chunk_id': f"chunk_{i}",
                'content': chunk,
                'char_count': len(chunk),
                'order': i
            }
            for i, chunk in enumerate(chunks)
        ]
    
    def chunk_with_context(
        self,
        sections: List[Dict],
        title: str
    ) -> List[Dict]:
        """带上下文的分块（保留文档/章节标题）"""
        chunks = []
        
        for section in sections:
            # 在每块前加上标题上下文
            full_text = f"{title}\n{section['title']}\n{section['content']}"
            
            sub_chunks = self.chunk(full_text)
            
            for sub_chunk in sub_chunks:
                chunks.append({
                    **sub_chunk,
                    'section_title': section['title'],
                    'doc_title': title
                })
        
        return chunks
```

---

### 2.4 质量过滤

```python
# src/processing/quality_filter.py
import hashlib
import re
from typing import List, Dict

class QualityFilter:
    def __init__(self):
        self.seen_hashes = set()
    
    def filter(self, chunks: List[Dict]) -> List[Dict]:
        """应用所有过滤规则"""
        filtered = []
        
        for chunk in chunks:
            # 1. 去重
            if self.is_duplicate(chunk):
                continue
            
            # 2. 长度过滤
            if not self.length_check(chunk):
                continue
            
            # 3. 质量评分
            score = self.quality_score(chunk)
            if score < 0.3:  # 阈值可调
                continue
            
            # 4. 敏感信息过滤
            if self.contains_sensitive_info(chunk):
                chunk['content'] = self.redact_sensitive_info(chunk['content'])
            
            chunk['quality_score'] = score
            filtered.append(chunk)
        
        return filtered
    
    def is_duplicate(self, chunk: Dict) -> bool:
        """检测重复"""
        content_hash = hashlib.md5(chunk['content'].encode()).hexdigest()
        
        if content_hash in self.seen_hashes:
            return True
        
        self.seen_hashes.add(content_hash)
        return False
    
    def length_check(self, chunk: Dict) -> bool:
        """长度检查"""
        char_count = len(chunk['content'])
        
        # 太短（<20 字）或太长（>2000 字）都过滤
        return 20 <= char_count <= 2000
    
    def quality_score(self, chunk: Dict) -> float:
        """质量评分（0-1）"""
        content = chunk['content']
        score = 0.5  # 基础分
        
        # 有标题加分
        if chunk.get('section_title'):
            score += 0.1
        
        # 包含数字加分（可能是数据/规格）
        if re.search(r'\d+', content):
            score += 0.1
        
        # 特殊字符过多减分
        special_char_ratio = len(re.findall(r'[^\w\s\u4e00-\u9fff]', content)) / len(content)
        if special_char_ratio > 0.3:
            score -= 0.2
        
        # 英文单词占比过高减分（中文文档）
        english_ratio = len(re.findall(r'[a-zA-Z]+', content)) / len(content)
        if english_ratio > 0.5:
            score -= 0.1
        
        return max(0, min(1, score))
    
    def contains_sensitive_info(self, chunk: Dict) -> bool:
        """检测敏感信息"""
        content = chunk['content']
        
        patterns = [
            r'\b\d{16}\b',  # 信用卡号
            r'\b\d{3,4}-\d{6,8}\b',  # 电话
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # 邮箱
            r'\b\d{6}(19|20)\d{2}\d{2}\d{2}\d{3}[0-9Xx]\b',  # 身份证号
        ]
        
        for pattern in patterns:
            if re.search(pattern, content):
                return True
        
        return False
    
    def redact_sensitive_info(self, content: str) -> str:
        """脱敏敏感信息"""
        # 邮箱脱敏
        content = re.sub(
            r'([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})',
            r'\1***@\2',
            content
        )
        
        # 电话脱敏
        content = re.sub(
            r'(\d{3})\d{4,8}(\d{4})',
            r'\1****\2',
            content
        )
        
        return content
```

---

### 2.5 完整处理管道

```python
# src/processing/pipeline.py
import asyncio
from typing import AsyncIterator, Dict

class DocumentProcessingPipeline:
    def __init__(self):
        self.parser = UnstructuredParser()
        self.table_extractor = TableExtractor()
        self.chunker = SmartChunker()
        self.quality_filter = QualityFilter()
        self.embedding_generator = EmbeddingGenerator()
    
    async def process(
        self,
        doc_source: Dict
    ) -> AsyncIterator[Dict]:
        """
        完整处理流程
        
        doc_source: {
            'id': str,
            'title': str,
            'content': bytes,
            'file_type': str,
            'source': str
        }
        """
        doc_id = doc_source['id']
        file_type = doc_source['file_type']
        
        # Step 1: 文档解析
        if file_type in ['.pdf', '.docx', '.xlsx', '.pptx']:
            parsed = await self.parser.parse(
                doc_source['content'],
                doc_source['title'] + file_type
            )
        else:
            # 纯文本
            parsed = {
                'sections': [{'title': '', 'content': doc_source['content'].decode()}],
                'tables': [],
                'metadata': {}
            }
        
        # Step 2: 表格专项提取（如果是 PDF）
        if file_type == '.pdf':
            tables = self.table_extractor.extract_from_pdf(doc_source['content'])
            parsed['tables'].extend(tables)
        
        # Step 3: 智能分块
        chunks = self.chunker.chunk_with_context(
            parsed['sections'],
            doc_source['title']
        )
        
        # Step 4: 表格转为 chunks
        for table in parsed['tables']:
            chunks.append({
                'chunk_id': f"table_{len(chunks)}",
                'content': table['html'],  # 表格 HTML
                'is_table': True,
                'table_data': table['data']
            })
        
        # Step 5: 质量过滤
        filtered_chunks = self.quality_filter.filter(chunks)
        
        # Step 6: 生成 Embedding 并产出
        for chunk in filtered_chunks:
            embedding = await self.embedding_generator.generate(
                chunk['content']
            )
            
            yield {
                'doc_id': doc_id,
                'chunk_id': chunk['chunk_id'],
                'content': chunk['content'],
                'section_title': chunk.get('section_title', ''),
                'doc_title': chunk.get('doc_title', doc_source['title']),
                'embedding': embedding,
                'metadata': {
                    'source': doc_source['source'],
                    'file_type': file_type,
                    'is_table': chunk.get('is_table', False),
                    'quality_score': chunk.get('quality_score', 0.5),
                    'char_count': chunk.get('char_count', 0)
                }
            }
```

---

## 三、License 合规检查

| 组件 | License | 商业可用 | 备注 |
|------|---------|----------|------|
| Unstructured | Apache 2.0 | ✅ | 推荐 |
| Apache Tika | Apache 2.0 | ✅ | 备选 |
| Camelot | MIT | ✅ | 表格提取 |
| LangChain | MIT | ✅ | 分块 |
| LlamaIndex | MIT | ✅ | 分块 |
| python-docx | MIT | ✅ | Word 解析 |
| openpyxl | MIT | ✅ | Excel 解析 |
| PyMuPDF | AGPL | ⚠️ | 需注意（传染性） |
| watchfiles | Apache 2.0 | ✅ | 文件监听 |

**建议**: 全部使用 MIT/Apache 2.0 组件，避免 AGPL。

---

## 四、性能优化

### 4.1 并行处理

```python
async def batch_process(documents: List[Dict], batch_size: int = 10):
    """批量并行处理文档"""
    pipeline = DocumentProcessingPipeline()
    
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        
        tasks = [pipeline.process(doc) for doc in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 存储结果
        for result in results:
            if isinstance(result, Exception):
                print(f"Error: {result}")
            else:
                async for chunk in result:
                    await store_chunk(chunk)
```

### 4.2 增量处理

```python
async def incremental_sync(source: str):
    """增量同步（只处理变更）"""
    last_sync = await get_last_sync_time(source)
    
    # 获取变更列表
    changes = await get_changes_since(source, last_sync)
    
    for change in changes:
        if change['type'] == 'deleted':
            await delete_document(change['id'])
        else:
            async for chunk in pipeline.process(change['doc']):
                await store_chunk(chunk)
    
    await update_last_sync_time(source)
```

---

## 五、监控指标

```python
# 关键指标
metrics = {
    'doc_processing_total': Counter,  # 总处理文档数
    'doc_processing_failed': Counter,  # 失败数
    'doc_processing_latency': Histogram,  # 处理延迟
    'chunk_quality_avg': Gauge,  # 平均质量分
    'duplicate_rate': Gauge,  # 重复率
    'embedding_token_usage': Counter,  # Embedding token 消耗
}
```

---

## 六、下一步

1. 确认外部数据源优先级
2. 搭建文档处理测试环境
3. 小规模试点（1000 文档）
4. 性能调优
5. 全量上线
