# LlamaIndex Data Loader 代码示例

**配套文档**: [data-loader-analysis.md](./data-loader-analysis.md)

---

## 📁 1. 文件系统 Reader

### 1.1 基础文件加载

```python
from llama_index.core.readers import SimpleDirectoryReader

# 加载整个目录
reader = SimpleDirectoryReader(
    input_dir="./data",
    recursive=True  # 递归子目录
)
documents = reader.load_data()
```

### 1.2 指定文件格式

```python
# 只加载特定扩展名的文件
reader = SimpleDirectoryReader(
    input_dir="./data",
    required_exts=[".pdf", ".docx", ".md"]
)
documents = reader.load_data()
```

### 1.3 自定义文件提取器

```python
from llama_index.readers.file import PyMuPDFReader, ImageVisionLLMReader

# 为特定格式指定自定义 Reader
file_extractor = {
    ".pdf": PyMuPDFReader(),  # 使用 PyMuPDF 解析 PDF
    ".jpg": ImageVisionLLMReader(),  # 使用 VLM 理解图片
    ".png": ImageVisionLLMReader(),
}

reader = SimpleDirectoryReader(
    input_dir="./mixed_docs",
    file_extractor=file_extractor
)
documents = reader.load_data()
```

### 1.4 自定义元数据

```python
def custom_metadata_func(file_path: str) -> dict:
    return {
        "file_path": file_path,
        "category": file_path.split("/")[-2],
        "author": "Eddy",
        "version": "1.0"
    }

reader = SimpleDirectoryReader(
    input_dir="./data",
    file_metadata=custom_metadata_func
)
documents = reader.load_data()
```

### 1.5 并行加载

```python
# 使用多进程加速加载
reader = SimpleDirectoryReader(
    input_dir="./large_dataset",
    num_workers=4  # 使用 4 个 worker
)
documents = reader.load_data(show_progress=True)
```

### 1.6 懒加载（流式处理）

```python
reader = SimpleDirectoryReader(input_dir="./large_dataset")

# 逐批处理，节省内存
for doc_batch in reader.lazy_load_data():
    for doc in doc_batch:
        process(doc)  # 处理每个文档
```

### 1.7 异步加载

```python
import asyncio

reader = SimpleDirectoryReader(input_dir="./data")

async def load_docs():
    documents = await reader.aload_data()
    return documents

docs = asyncio.run(load_docs())
```

---

## 🌐 2. 网页 Reader

### 2.1 简单网页加载

```python
from llama_index.readers.web import SimpleWebPageReader

reader = SimpleWebPageReader(html_to_text=True)
documents = reader.load_data(
    urls=["https://example.com/page1", "https://example.com/page2"]
)
```

### 2.2 RSS 订阅

```python
from llama_index.readers.web import RSSReader

reader = RSSReader()
documents = reader.load_data(
    urls=[
        "https://techcrunch.com/feed/",
        "https://www.theverge.com/rss/index.xml"
    ]
)
```

### 2.3 整站爬取

```python
from llama_index.readers.web import WholeSiteReader

reader = WholeSiteReader(
    prefix="https://docs.example.com",
    max_depth=2  # 最大爬取深度
)
documents = reader.load_data(
    url="https://docs.example.com/getting-started"
)
```

### 2.4 使用 Firecrawl（专业爬虫服务）

```python
from llama_index.readers.web import FirecrawlReader

reader = FirecrawlReader(api_key="fc_xxx")
documents = reader.load_data(
    url="https://example.com",
    mode="scrape"  # 或 "crawl"
)
```

---

## 📚 3. 云服务 Reader

### 3.1 AWS S3

```python
from llama_index.readers.s3 import S3Reader

reader = S3Reader(
    bucket="my-documents",
    prefix="docs/",  # 可选，指定前缀
    aws_access_key_id="AKIAXXX",
    aws_secret_access_key="secret"
)
documents = reader.load_data()
```

### 3.2 Google Cloud Storage

```python
from llama_index.readers.gcs import GCSReader

reader = GCSReader(
    bucket="my-gcs-bucket",
    prefix="documents/"
)
documents = reader.load_data()
```

### 3.3 Notion

```python
from llama_index.readers.notion import NotionPageReader

reader = NotionPageReader(integration_token="secret_xxx")

# 加载指定页面
documents = reader.load_data(
    page_ids=["page_id_1", "page_id_2"]
)

# 或查询数据库
documents = reader.query_database(database_id="db_xxx")
```

### 3.4 Confluence

```python
from llama_index.readers.confluence import ConfluenceReader

reader = ConfluenceReader(
    base_url="https://company.atlassian.net",
    username="user@company.com",
    api_token="api_token"
)

# 加载指定空间
documents = reader.load_data(
    space_keys=["ENG", "PROD"],
    limit=50
)
```

### 3.5 GitHub

```python
from llama_index.readers.github import GitHubRepositoryReader

reader = GitHubRepositoryReader(
    github_token="ghp_xxx",
    owner="run-llama",
    repo="llama_index"
)

# 加载整个仓库
documents = reader.load_data()

# 或只加载特定分支
documents = reader.load_data(branch="main")
```

### 3.6 Slack

```python
from llama_index.readers.slack import SlackReader

reader = SlackReader(token="xoxb_xxx")

# 列出所有频道
channels = reader.list_resources()

# 加载指定频道历史
documents = reader.load_data(
    channel_ids=["C0123456789", "C9876543210"],
    oldest="1609459200"  # 2021-01-01 之后的消息
)
```

---

## 💾 4. 数据库 Reader

### 4.1 SQL 数据库

```python
from llama_index.readers.database import DatabaseReader

reader = DatabaseReader(
    scheme="postgresql",
    host="localhost",
    port=5432,
    user="postgres",
    password="password",
    dbname="mydb"
)

# 执行查询
documents = reader.load_data(
    query="SELECT id, content FROM documents WHERE status = 'published'"
)
```

### 4.2 MongoDB

```python
from llama_index.readers.mongodb import SimpleMongoReader

reader = SimpleMongoReader(
    uri="mongodb://localhost:27017",
    db_name="mydb",
    collection_name="documents"
)

documents = reader.load_data(
    query_filter={"status": "published"}
)
```

### 4.3 Elasticsearch

```python
from llama_index.readers.elasticsearch import ElasticsearchReader

reader = ElasticsearchReader(
    endpoint="http://localhost:9200",
    index="documents"
)

documents = reader.load_data(
    query={"match": {"content": "AI"}}
)
```

---

## 🎬 5. 媒体 Reader

### 5.1 YouTube 字幕

```python
from llama_index.readers.youtube_transcript import YoutubeTranscriptReader

reader = YoutubeTranscriptReader()
documents = reader.load_data(
    video_ids=["dQw4w9WgXcQ", "jNQXAC9IVRw"]
)
```

### 5.2 音频/视频文件

```python
from llama_index.readers.file import VideoAudioReader

reader = VideoAudioReader()
documents = reader.load_data(
    file="./meeting_recording.mp3"
)
```

### 5.3 图片理解（VLM）

```python
from llama_index.readers.file import ImageVisionLLMReader

reader = ImageVisionLLMReader()
documents = reader.load_data(
    file="./chart.png"
)
# 返回图片的文字描述
```

---

## 🔄 6. 高级用法

### 6.1 多源数据合并

```python
from llama_index.core.readers import SimpleDirectoryReader
from llama_index.readers.notion import NotionPageReader
from llama_index.readers.web import SimpleWebPageReader

# 1. 本地文件
file_reader = SimpleDirectoryReader(input_dir="./docs")
file_docs = file_reader.load_data()

# 2. Notion
notion_reader = NotionPageReader(integration_token="secret")
notion_docs = notion_reader.load_data(page_ids=["page1"])

# 3. 网页
web_reader = SimpleWebPageReader(html_to_text=True)
web_docs = web_reader.load_data(urls=["https://example.com"])

# 合并所有文档
all_docs = file_docs + notion_docs + web_docs
```

### 6.2 并发加载多个数据源

```python
import asyncio
from llama_index.readers.notion import NotionPageReader
from llama_index.readers.web import SimpleWebPageReader

async def load_all():
    notion_reader = NotionPageReader(integration_token="secret")
    web_reader = SimpleWebPageReader(html_to_text=True)
    
    # 并发加载
    results = await asyncio.gather(
        notion_reader.aload_data(page_ids=["page1", "page2"]),
        web_reader.aload_data(urls=["https://example.com"]),
        return_exceptions=True
    )
    
    # 合并结果
    all_docs = []
    for result in results:
        if isinstance(result, list):
            all_docs.extend(result)
    
    return all_docs

docs = asyncio.run(load_all())
```

### 6.3 增量加载（避免重复）

```python
from llama_index.core.readers import SimpleDirectoryReader
import json
import os

HISTORY_FILE = "./loaded_files.json"

def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return set(json.load(f))
    return set()

def save_history(loaded_files):
    with open(HISTORY_FILE, "w") as f:
        json.dump(list(loaded_files), f)

# 加载历史记录
loaded_files = load_history()

reader = SimpleDirectoryReader(
    input_dir="./incoming_data",
    filename_as_id=True  # 使用文件名作为 ID
)

new_docs = []
for doc_batch in reader.lazy_load_data():
    for doc in doc_batch:
        if doc.id_ not in loaded_files:
            new_docs.append(doc)
            loaded_files.add(doc.id_)

# 保存新历史
save_history(loaded_files)

print(f"新加载 {len(new_docs)} 个文档")
```

### 6.4 自定义 Reader

```python
from llama_index.core.readers.base import BasePydanticReader
from llama_index.core.schema import Document
from typing import List

class CustomAPIReader(BasePydanticReader):
    """自定义 API Reader"""
    
    is_remote: bool = True
    api_url: str
    api_key: str
    
    @classmethod
    def class_name(cls) -> str:
        return "CustomAPIReader"
    
    def load_data(self, query: str) -> List[Document]:
        import requests
        
        response = requests.get(
            self.api_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            params={"q": query}
        )
        data = response.json()
        
        return [
            Document(
                text=item["content"],
                metadata={"source": "custom_api", "id": item["id"]}
            )
            for item in data["results"]
        ]

# 使用
reader = CustomAPIReader(
    api_url="https://api.example.com/search",
    api_key="xxx"
)
documents = reader.load_data(query="AI")
```

### 6.5 错误处理与重试

```python
from llama_index.core.readers import SimpleDirectoryReader
import logging

logging.basicConfig(level=logging.INFO)

reader = SimpleDirectoryReader(
    input_dir="./data",
    raise_on_error=False,  # 出错时跳过文件
    required_exts=[".pdf"]
)

try:
    documents = reader.load_data()
    print(f"成功加载 {len(documents)} 个文档")
except Exception as e:
    logging.error(f"加载失败：{e}")
```

---

## 📊 7. 性能优化

### 7.1 批处理

```python
from llama_index.core.readers import SimpleDirectoryReader

reader = SimpleDirectoryReader(input_dir="./large_dataset")

# 批处理：每批 100 个文档
batch_size = 100
batch = []

for doc in reader.lazy_load_data():
    batch.extend(doc)
    
    if len(batch) >= batch_size:
        process_batch(batch)  # 处理一批
        batch = []  # 清空

# 处理最后一批
if batch:
    process_batch(batch)
```

### 7.2 内存优化

```python
# 使用生成器避免一次性加载
def lazy_load_and_process(reader):
    for doc_batch in reader.lazy_load_data():
        for doc in doc_batch:
            yield doc  # 逐个生成

reader = SimpleDirectoryReader(input_dir="./huge_dataset")

for doc in lazy_load_and_process(reader):
    process(doc)  # 处理每个文档
    # 内存占用始终很低
```

### 7.3 缓存机制

```python
from functools import lru_cache
from llama_index.core.readers import SimpleDirectoryReader

@lru_cache(maxsize=100)
def get_cached_documents(directory: str):
    reader = SimpleDirectoryReader(input_dir=directory)
    return tuple(reader.load_data())  # 转为 tuple 以便缓存

# 首次加载
docs1 = get_cached_documents("./data")

# 再次调用直接返回缓存
docs2 = get_cached_documents("./data")
```

---

## 🔧 8. 调试与日志

### 8.1 启用详细日志

```python
import logging

logging.basicConfig(level=logging.DEBUG)

reader = SimpleDirectoryReader(
    input_dir="./data",
    verbose=True
)
documents = reader.load_data()
```

### 8.2 检查加载的文件

```python
reader = SimpleDirectoryReader(input_dir="./data")

# 列出所有将要加载的文件
print(f"将要加载 {len(reader.input_files)} 个文件:")
for file_path in reader.input_files:
    print(f"  - {file_path}")
```

### 8.3 文档元数据检查

```python
reader = SimpleDirectoryReader(input_dir="./data")
documents = reader.load_data()

for doc in documents[:5]:  # 检查前 5 个文档
    print(f"文件：{doc.metadata.get('file_name')}")
    print(f"大小：{doc.metadata.get('file_size')} bytes")
    print(f"文本长度：{len(doc.text)} chars")
    print(f"排除的嵌入元数据：{doc.excluded_embed_metadata_keys}")
    print("---")
```

---

## 📝 总结

这些示例覆盖了 LlamaIndex Data Loader 的主要使用场景：

- ✅ 文件系统加载（18 种格式）
- ✅ 网页抓取（RSS、整站、API）
- ✅ 云服务（S3、GCS、Notion、Confluence）
- ✅ 数据库（SQL、MongoDB、Elasticsearch）
- ✅ 媒体处理（YouTube、音频、视频、图片）
- ✅ 高级用法（多源合并、并发、增量、自定义）
- ✅ 性能优化（批处理、内存、缓存）
- ✅ 调试技巧

**完整文档**: [data-loader-analysis.md](./data-loader-analysis.md)
