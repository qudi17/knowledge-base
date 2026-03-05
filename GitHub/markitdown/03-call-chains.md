# MarkItDown 调用链追踪

**研究日期**: 2026-03-03  
**阶段**: 阶段 3/14  
**方法**: GSD 波次执行（3 波次）

---

## 📊 波次执行总览

### 波次 1: CLI 入口追踪
**入口**: `__main__.py:main()` → `MarkItDown.convert()`

### 波次 2: API 入口追踪  
**入口**: `MarkItDown.convert()` → 转换器调度

### 波次 3: 转换器执行追踪
**入口**: `PdfConverter.convert()` → Markdown 生成

---

## 🔍 波次 1: CLI 入口调用链

### 完整调用链

```
用户执行：markitdown file.pdf
    ↓
__main__.py:main()
    ↓ (解析参数)
    ↓
MarkItDown.__init__(enable_plugins=args.use_plugins)
    ↓
    ├─→ enable_builtins()
    │   ├─→ register_converter(PlainTextConverter, priority=10.0)
    │   ├─→ register_converter(ZipConverter, priority=10.0)
    │   ├─→ register_converter(HtmlConverter, priority=10.0)
    │   ├─→ register_converter(PdfConverter, priority=0.0)
    │   └─→ ... (注册 24 个转换器)
    │
    └─→ enable_plugins() (如果 --use-plugins)
        └─→ _load_plugins()
            └─→ entry_points(group="markitdown.plugin")
    
    ↓
MarkItDown.convert(args.filename)
    ↓
MarkItDown.convert_local(path)
    ↓
    ├─→ 构建 StreamInfo
    │   ├─→ extension = ".pdf"
    │   └─→ filename = "file.pdf"
    │
    └─→ _get_stream_info_guesses(file_stream, base_guess)
        ├─→ mimetypes.guess_type()
        └─→ magika.identify_stream()
    
    ↓
MarkItDown._convert(file_stream, stream_info_guesses)
    ↓
    ├─→ sorted_registrations = sorted(converters, key=priority)
    │
    └─→ for stream_info in stream_info_guesses:
        └─→ for converter in sorted_registrations:
            ├─→ converter.accepts(file_stream, stream_info)
            │   └─→ PdfConverter.accepts() → True (匹配.pdf)
            │
            └─→ converter.convert(file_stream, stream_info)
                └─→ PdfConverter.convert()
                    ├─→ pdfplumber.open(pdf_bytes)
                    ├─→ for page in pdf.pages:
                    │   ├─→ _extract_form_content_from_words(page)
                    │   └─→ page.extract_text()
                    │
                    ├─→ _merge_partial_numbering_lines(markdown)
                    └─→ DocumentConverterResult(markdown=markdown)
    
    ↓
_handle_output(args, result)
    ↓
    ├─→ if args.output: 写入文件
    └─→ else: print 到 stdout
```

### 关键代码位置

**CLI 参数解析** (`__main__.py:24-100`):
```python
def main():
    parser = argparse.ArgumentParser(...)
    parser.add_argument("-o", "--output", ...)
    parser.add_argument("-x", "--extension", ...)
    parser.add_argument("-d", "--use-docintel", ...)
    parser.add_argument("-p", "--use-plugins", ...)
    args = parser.parse_args()
    
    # 创建 MarkItDown 实例
    if args.use_docintel:
        markitdown = MarkItDown(docintel_endpoint=args.endpoint)
    else:
        markitdown = MarkItDown(enable_plugins=args.use_plugins)
    
    # 执行转换
    if args.filename is None:
        result = markitdown.convert_stream(sys.stdin.buffer)
    else:
        result = markitdown.convert(args.filename)
    
    _handle_output(args, result)
```

---

## 🔍 波次 2: API 入口调用链

### Python API 调用链

```python
from markitdown import MarkItDown

md = MarkItDown(enable_plugins=False)
result = md.convert("test.xlsx")
print(result.markdown)
```

### 详细调用链

```
MarkItDown.__init__(enable_plugins=False)
    ↓
    ├─→ self._requests_session = requests.Session()
    ├─→ self._magika = magika.Magika()
    ├─→ self._converters = []
    └─→ enable_builtins()
        └─→ register_converter(...)  # 注册 24 个转换器
    
    ↓
MarkItDown.convert("test.xlsx")
    ↓ (source 是 str，不以 http://开头)
    ↓
MarkItDown.convert_local("test.xlsx")
    ↓
    ├─→ base_guess = StreamInfo(
    │       local_path="test.xlsx",
    │       extension=".xlsx",
    │       filename="test.xlsx"
    │   )
    │
    └─→ _get_stream_info_guesses(file_stream, base_guess)
        ├─→ mimetypes.guess_type("placeholder.xlsx")
        │   └─→ mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        │
        └─→ magika.identify_stream(file_stream)
            └─→ 返回文件类型识别结果
    
    ↓
MarkItDown._convert(file_stream, stream_info_guesses)
    ↓
    ├─→ sorted_registrations = sorted(self._converters, key=lambda x: x.priority)
    │   # 优先级 0.0 的转换器先尝试（PdfConverter, XlsxConverter 等）
    │   # 优先级 10.0 的转换器后尝试（PlainTextConverter, HtmlConverter 等）
    │
    └─→ 遍历转换器:
        ├─→ XlsxConverter.accepts() → True (匹配.xlsx)
        └─→ XlsxConverter.convert()
            ├─→ openpyxl.load_workbook(file_stream)
            ├─→ for sheet in workbook.sheetnames:
            │   ├─→ worksheet = workbook[sheet]
            │   └─→ 遍历行和列，生成 Markdown 表格
            │
            └─→ DocumentConverterResult(markdown=markdown)
    
    ↓
返回 DocumentConverterResult
```

### 转换器优先级机制

```python
# _markitdown.py:599-629
def register_converter(self, converter, *, priority=PRIORITY_SPECIFIC_FILE_FORMAT):
    """
    Register a DocumentConverter with a given priority.
    
    Priorities work as follows:
    - Lower priority values are tried first
    - PRIORITY_SPECIFIC_FILE_FORMAT = 0.0 (e.g., .docx, .pdf)
    - PRIORITY_GENERIC_FILE_FORMAT = 10.0 (e.g., PlainTextConverter)
    """
    self._converters.insert(
        0, ConverterRegistration(converter=converter, priority=priority)
    )

# _markitdown.py:474-490
def _convert(self, *, file_stream, stream_info_guesses, **kwargs):
    # 按优先级排序（小的先尝试）
    sorted_registrations = sorted(self._converters, key=lambda x: x.priority)
    
    for stream_info in stream_info_guesses:
        for converter_registration in sorted_registrations:
            converter = converter_registration.converter
            
            # 检查是否接受
            if converter.accepts(file_stream, stream_info):
                try:
                    res = converter.convert(file_stream, stream_info, **kwargs)
                    if res is not None:
                        return res  # 成功转换，立即返回
                except Exception:
                    # 记录失败，继续尝试下一个
                    pass
```

---

## 🔍 波次 3: 转换器执行追踪

### PDF 转换器详细调用链

```
PdfConverter.accepts(file_stream, stream_info)
    ↓
    ├─→ mimetype = stream_info.mimetype or ""
    ├─→ extension = stream_info.extension or ""
    └─→ 检查:
        ├─→ extension in [".pdf"] → True
        └─→ mimetype.startswith("application/pdf") → True
    
    ↓ (返回 True)
    
PdfConverter.convert(file_stream, stream_info)
    ↓
    ├─→ 检查依赖：pdfplumber, pdfminer
    │
    ├─→ pdf_bytes = io.BytesIO(file_stream.read())
    │
    ├─→ with pdfplumber.open(pdf_bytes) as pdf:
    │   └─→ for page in pdf.pages:
    │       ├─→ _extract_form_content_from_words(page)
    │       │   ├─→ page.extract_words()  # 提取词位置
    │       │   ├─→ 按 Y 位置分组（行）
    │       │   ├─→ 分析 X 位置（列边界）
    │       │   ├─→ 检测表格行 vs 段落
    │       │   └─→ 生成 Markdown 表格
    │       │
    │       └─→ 如果 form extraction 返回 None:
    │           └─→ page.extract_text()  # 使用 pdfplumber 基础提取
    │
    ├─→ 如果 plain_pages > form_pages:
    │   └─→ markdown = pdfminer.high_level.extract_text(pdf_bytes)
    │
    ├─→ _merge_partial_numbering_lines(markdown)
    │   └─→ 合并 MasterFormat 风格的编号行
    │
    └─→ DocumentConverterResult(markdown=markdown)
```

### HTML 转换器调用链

```
HtmlConverter.accepts(file_stream, stream_info)
    ↓
    └─→ mimetype == "text/html" or extension in [".html", ".htm"]
    
    ↓ (返回 True)

HtmlConverter.convert(file_stream, stream_info)
    ↓
    ├─→ html_content = file_stream.read().decode()
    │
    ├─→ 使用 markdownify 转换:
    │   └─→ markdown = markdownify.markdownify(html_content)
    │
    └─→ DocumentConverterResult(markdown=markdown)
```

### 图片转换器调用链

```
ImageConverter.accepts(file_stream, stream_info)
    ↓
    └─→ mimetype.startswith("image/")
    
    ↓ (返回 True)

ImageConverter.convert(file_stream, stream_info)
    ↓
    ├─→ 使用 Pillow 打开图片:
    │   └─→ image = Image.open(file_stream)
    │
    ├─→ 提取 EXIF 元数据:
    │   └─→ exif_data = image._getexif()
    │
    ├─→ 如果提供 LLM 客户端:
    │   └─→ _llm_caption.image_to_markdown(image, llm_client, llm_model)
    │       └─→ 调用 GPT-4V 等模型生成描述
    │
    └─→ DocumentConverterResult(
            markdown=f"![Image]({stream_info.filename})\n\n{exif_data}"
        )
```

---

## 📊 调用链统计

### 调用深度

| 调用链 | 深度 | 关键节点数 |
|--------|------|-----------|
| CLI → 转换 | 8 层 | 15+ |
| API → 转换 | 7 层 | 12+ |
| 转换器执行 | 5-10 层 | 20+ (PDF 最复杂) |

### 关键决策点

1. **源类型判断** (`convert()` 方法) - 5 种类型分支
2. **流信息推断** (`_get_stream_info_guesses()`) - Magika + mimetypes
3. **转换器选择** (`_convert()` 循环) - 优先级排序 + accepts() 检查
4. **表格提取策略** (PDF 转换器) - form-style vs plain text

---

## ✅ 阶段 3 完成检查

- [x] CLI 入口调用链追踪完成
- [x] API 入口调用链追踪完成
- [x] 转换器执行追踪完成（PDF/HTML/Image）
- [x] 优先级机制分析完成
- [x] 关键决策点识别

---

**下一阶段**: 阶段 4 - 知识链路完整性检查  
**预计时间**: 30 分钟
