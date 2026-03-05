# 文档 Parser 底层实现详解

## 一、PDF Parser

### 1.1 PyMuPDF (fitz) 实现原理

**LlamaIndex 默认使用 PyMuPDF**，这是最快、最流行的 PDF 解析库。

#### 核心依赖

```python
# 安装
pip install pymupdf

# 底层依赖
# - MuPDF C 库（C 语言编写）
# - Python 绑定（pybind11）
```

#### 底层实现

```python
# pymupdf 核心流程
import fitz  # PyMuPDF

class PDFParser:
    def parse(self, file_path: str) -> str:
        # 1. 打开 PDF 文件
        doc = fitz.open(file_path)
        
        text_content = []
        
        # 2. 逐页提取
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # 3. 提取文本（按块）
            # PyMuPDF 使用"块 (Block)"概念
            # 每个块是一个连续的文本区域
            blocks = page.get_text("blocks")
            
            for block in blocks:
                # block 结构：
                # (x0, y0, x1, y1, "文本内容", block_no, block_type)
                x0, y0, x1, y1, text, block_no, block_type = block
                
                # block_type: 0=文本，1=图片
                if block_type == 0:  # 文本块
                    text_content.append(text)
            
            # 4. 提取元数据
            metadata = {
                'page_count': len(doc),
                'author': doc.metadata.get('author'),
                'title': doc.metadata.get('title'),
                'creator': doc.metadata.get('creator'),
                'creation_date': doc.metadata.get('creationDate'),
            }
        
        doc.close()
        
        return "\n\n".join(text_content), metadata
```

#### PyMuPDF 的文本提取算法

```python
# PyMuPDF 使用多种策略提取文本

# 策略 1：按块提取（默认）
blocks = page.get_text("blocks")
# 优点：保持空间布局
# 缺点：可能打乱阅读顺序

# 策略 2：按行提取
lines = page.get_text("lines")
# 结构：
# {
#   'dir': (1, 0),  # 文字方向
#   'wmode': 0,     # 书写模式
#   'spans': [{
#       'text': '文本内容',
#       'font': 'Arial',
#       'size': 12,
#       'color': 0x000000,
#   }]
# }

# 策略 3：按字符提取（最细粒度）
chars = page.get_text("dict")["blocks"][0]["lines"][0]["spans"][0]["chars"]
# 每个字符包含：
# - c: 字符本身
# - origin: (x, y) 原点坐标
# - bbox: 边界框

# 策略 4：HTML 格式
html = page.get_text("html")
# 保留样式和布局

# 策略 5：XHTML 格式
xhtml = page.get_text("xhtml")
# 更适合后续处理
```

#### 文本排序问题

**问题**：PDF 中文本块可能按绘制顺序而非阅读顺序存储。

**解决方案**：

```python
def extract_text_sorted(page):
    """按阅读顺序（从上到下，从左到右）排序"""
    blocks = page.get_text("blocks")
    
    # 只保留文本块
    text_blocks = [b for b in blocks if b[6] == 0]
    
    # 按 Y 坐标排序（从上到下）
    # 使用容差处理同一行的情况
    def sort_key(block):
        y0 = block[1]  # 块的顶部 Y 坐标
        # 将 Y 坐标分组（容差 10 像素）
        return round(y0 / 10) * 10, block[0]  # 然后按 X 坐标
    
    text_blocks.sort(key=sort_key)
    
    return "\n".join([b[4] for b in text_blocks])
```

---

### 1.2 pdfplumber 实现原理

**更精确的表格提取**，基于 pdfminer.six。

```python
import pdfplumber

class PDFPlumberParser:
    def parse(self, file_path: str):
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                # 1. 提取文本
                text = page.extract_text()
                
                # 2. 提取表格
                tables = page.extract_tables()
                
                # 3. 提取线条（用于检测表格结构）
                lines = page.lines
                rects = page.rects
                
                # 4. 分析布局
                layout = self.analyze_layout(page)
    
    def analyze_layout(self, page):
        """分析页面布局"""
        # pdfplumber 使用"对象图"概念
        # 每个元素（文本、线条、矩形）都是图中的一个节点
        
        # 1. 检测水平线和垂直线
        h_lines = [l for l in page.lines if abs(l['slope']) < 0.1]
        v_lines = [l for l in page.lines if abs(l['slope']) > 10]
        
        # 2. 检测矩形（可能是表格单元格）
        cells = page.rects
        
        # 3. 构建表格结构
        tables = self.reconstruct_tables(h_lines, v_lines, cells)
        
        return tables
```

#### 表格重建算法

```python
def reconstruct_tables(self, h_lines, v_lines, cells):
    """
    从线条重建表格结构
    """
    tables = []
    
    # 1. 找到所有线条交点
    intersections = []
    for h_line in h_lines:
        for v_line in v_lines:
            # 计算交点
            if self.lines_intersect(h_line, v_line):
                x = v_line['x0']
                y = h_line['y0']
                intersections.append((x, y))
    
    # 2. 将交点分组为表格
    # 同一表格的交点 X/Y 坐标应该相近
    table_groups = self.cluster_intersections(intersections)
    
    # 3. 对每个表格，提取单元格内容
    for group in table_groups:
        table = {
            'rows': len(set(y for x, y in group)),
            'cols': len(set(x for x, y in group)),
            'cells': []
        }
        
        # 4. 将文本映射到单元格
        for cell in cells:
            cell_text = self.get_cell_text(cell)
            table['cells'].append({
                'row': self.find_row(cell, group),
                'col': self.find_col(cell, group),
                'text': cell_text
            })
        
        tables.append(table)
    
    return tables
```

---

### 1.3 LlamaParse 实现原理（商业）

**基于 GPT-4V 的视觉解析**，不是传统 OCR。

```python
# LlamaParse 工作流程（推测）

class LlamaParseImpl:
    def parse(self, file_path: str):
        # 1. PDF 转为图片
        images = self.pdf_to_images(file_path)
        
        # 2. GPT-4V 视觉分析
        results = []
        for image in images:
            prompt = """
            分析这张文档图片，提取：
            1. 文档结构（标题层级）
            2. 所有文本内容
            3. 表格（转为 Markdown）
            4. 图表说明
            5. 公式（转为 LaTeX）
            
            输出 Markdown 格式。
            """
            
            response = gpt4v_api.call(
                image=image,
                prompt=prompt
            )
            
            results.append(response)
        
        # 3. 后处理
        markdown = self.post_process(results)
        
        return markdown
```

#### 关键优势

```python
# 传统 OCR vs LlamaParse

# 传统 OCR（Tesseract）
# 1. 二值化 → 2. 字符分割 → 3. 字符识别 → 4. 后处理
# 问题：复杂布局、手写体、低质量扫描效果差

# LlamaParse（GPT-4V）
# 1. 视觉理解 → 2. 语义分析 → 3. 结构化输出
# 优势：
# - 理解文档结构（标题/段落/表格）
# - 处理复杂布局（多栏、混排）
# - 识别手写体
# - 提取表格结构
# - 公式转 LaTeX
```

---

## 二、Word Parser (DOCX)

### 2.1 python-docx 实现原理

**LlamaIndex 默认使用 python-docx**，解析 Office Open XML 格式。

#### DOCX 文件结构

```
document.docx 实际上是一个 ZIP 压缩包：

document.docx
├── [Content_Types].xml      # 文件类型定义
├── _rels/
│   └── .rels                # 关系定义
├── word/
│   ├── document.xml         # 主文档内容
│   ├── styles.xml           # 样式定义
│   ├── numbering.xml        # 编号定义
│   ├── media/               # 嵌入的图片
│   └── _rels/
│       └── document.xml.rels
└── docProps/
    ├── core.xml             # 元数据
    └── app.xml
```

#### 底层解析

```python
from docx import Document
import zipfile
import xml.etree.ElementTree as ET

class DocxParser:
    def parse(self, file_path: str):
        # 1. 解压 DOCX（本质是 ZIP）
        with zipfile.ZipFile(file_path) as zip_file:
            # 2. 读取主文档 XML
            document_xml = zip_file.read('word/document.xml')
            
            # 3. 解析 XML
            root = ET.fromstring(document_xml)
            
            # 4. 定义 XML 命名空间
            ns = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
            }
            
            # 5. 提取正文
            body = root.find('.//w:body', ns)
            content = []
            
            for element in body:
                if element.tag.endswith('p'):  # 段落
                    paragraph = self.parse_paragraph(element, ns)
                    content.append(paragraph)
                
                elif element.tag.endswith('tbl'):  # 表格
                    table = self.parse_table(element, ns)
                    content.append(table)
        
        return "\n\n".join(content)
    
    def parse_paragraph(self, p_element, ns):
        """解析段落"""
        # 提取所有文本节点
        texts = []
        for run in p_element.findall('.//w:r', ns):
            text_elem = run.find('w:t', ns)
            if text_elem is not None and text_elem.text:
                texts.append(text_elem.text)
        
        # 提取样式
        style_elem = p_element.find('w:pPr/w:pStyle', ns)
        style_name = style_elem.get('{%s}val' % ns['w']) if style_elem is not None else None
        
        # 判断标题层级
        if style_name and style_name.startswith('Heading'):
            level = int(style_name[-1])
            heading = f"{'#' * level} {''.join(texts)}"
            return heading
        else:
            return ''.join(texts)
    
    def parse_table(self, tbl_element, ns):
        """解析表格"""
        rows = []
        for row in tbl_element.findall('w:tr', ns):
            cells = []
            for cell in row.findall('w:tc', ns):
                cell_text = self.parse_cell(cell, ns)
                cells.append(cell_text)
            rows.append(cells)
        
        # 转为 Markdown 表格
        return self.rows_to_markdown(rows)
    
    def rows_to_markdown(self, rows):
        """转为 Markdown 格式"""
        if not rows:
            return ""
        
        # 表头
        header = "| " + " | ".join(rows[0]) + " |"
        separator = "| " + " | ".join(["---"] * len(rows[0])) + " |"
        
        # 数据行
        data_rows = []
        for row in rows[1:]:
            data_rows.append("| " + " | ".join(row) + " |")
        
        return "\n".join([header, separator] + data_rows)
```

#### 处理复杂格式

```python
def parse_complex_format(self, p_element, ns):
    """处理复杂格式（粗体、斜体、下划线等）"""
    formatted_text = []
    
    for run in p_element.findall('.//w:r', ns):
        text = run.find('w:t', ns)
        if text is None or not text.text:
            continue
        
        # 检查格式
        rPr = run.find('w:rPr', ns)
        
        is_bold = rPr.find('w:b', ns) is not None if rPr is not None else False
        is_italic = rPr.find('w:i', ns) is not None if rPr is not None else False
        is_underline = rPr.find('w:u', ns) is not None if rPr is not None else False
        
        # 应用 Markdown 格式
        formatted = text.text
        if is_underline:
            formatted = f"<u>{formatted}</u>"  # Markdown 不支持下划线
        if is_italic:
            formatted = f"*{formatted}*"
        if is_bold:
            formatted = f"**{formatted}**"
        
        formatted_text.append(formatted)
    
    return ''.join(formatted_text)
```

---

### 2.2 处理旧格式 (.doc)

**.doc 是二进制格式**，需要使用不同解析器。

```python
# 方案 1：使用 antiword（命令行工具）
import subprocess

def parse_old_doc(file_path: str):
    result = subprocess.run(
        ['antiword', file_path],
        capture_output=True,
        text=True
    )
    return result.stdout

# 方案 2：使用 LibreOffice 转换
def convert_doc_to_docx(file_path: str):
    subprocess.run([
        'libreoffice',
        '--headless',
        '--convert-to', 'docx',
        file_path
    ])
    return file_path.replace('.doc', '.docx')

# 方案 3：使用 comtypes（Windows 专用，调用 Word COM）
import comtypes.client

def parse_with_word(file_path: str):
    word = comtypes.client.CreateObject("Word.Application")
    doc = word.Documents.Open(file_path)
    content = doc.Content.Text
    doc.Close()
    word.Quit()
    return content
```

---

## 三、Excel Parser

### 3.1 openpyxl 实现原理

**LlamaIndex 默认使用 pandas + openpyxl**。

#### XLSX 文件结构

```
spreadsheet.xlsx 也是 ZIP 压缩包：

spreadsheet.xlsx
├── [Content_Types].xml
├── _rels/
│   └── .rels
├── xl/
│   ├── workbook.xml         # 工作簿定义
│   ├── styles.xml           # 样式
│   ├── sharedStrings.xml    # 共享字符串（文本去重）
│   ├── worksheets/
│   │   ├── sheet1.xml       # Sheet 1 数据
│   │   ├── sheet2.xml       # Sheet 2 数据
│   │   └── ...
│   └── _rels/
└── docProps/
```

#### 底层解析

```python
from openpyxl import load_workbook
import xml.etree.ElementTree as ET
import zipfile

class ExcelParser:
    def parse(self, file_path: str):
        # 方法 1：使用 openpyxl（推荐）
        return self.parse_with_openpyxl(file_path)
        
        # 方法 2：直接解析 XML（底层）
        # return self.parse_xml_directly(file_path)
    
    def parse_with_openpyxl(self, file_path: str):
        wb = load_workbook(file_path, data_only=True)  # data_only=True 获取计算结果
        
        sheets_content = []
        
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            
            # 提取数据
            rows = []
            for row in ws.iter_rows(values_only=True):
                rows.append(row)
            
            # 转为 Markdown
            markdown_table = self.rows_to_markdown(rows)
            
            sheets_content.append(f"## {sheet_name}\n\n{markdown_table}")
        
        return "\n\n".join(sheets_content)
    
    def parse_xml_directly(self, file_path: str):
        """直接解析 XLSX 内部 XML（深入理解原理）"""
        with zipfile.ZipFile(file_path) as zip_file:
            # 1. 读取共享字符串表
            strings_xml = zip_file.read('xl/sharedStrings.xml')
            strings_root = ET.fromstring(strings_xml)
            
            ns = {'si': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            shared_strings = []
            for si in strings_root.findall('si:si', ns):
                t = si.find('si:t', ns)
                shared_strings.append(t.text if t is not None else '')
            
            # 2. 读取工作表
            worksheets_xml = zip_file.read('xl/worksheets/sheet1.xml')
            ws_root = ET.fromstring(worksheets_xml)
            
            ns = {'sheet': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            rows = []
            for row in ws_root.findall('sheet:row', ns):
                cells = []
                for cell in row.findall('sheet:c', ns):
                    # 获取单元格类型
                    t = cell.get('t', 'n')  # n=数字，s=字符串，b=布尔
                    
                    # 获取值
                    v = cell.find('sheet:v', ns)
                    if v is not None:
                        if t == 's':  # 字符串索引
                            value = shared_strings[int(v.text)]
                        else:
                            value = v.text
                        cells.append(value)
                
                if cells:
                    rows.append(cells)
            
            return self.rows_to_markdown(rows)
```

#### 处理合并单元格

```python
def parse_merged_cells(self, ws):
    """处理合并单元格"""
    merged_cells = ws.merged_cells.ranges
    
    result = []
    for merged in merged_cells:
        # 获取合并区域
        top_left = merged.start_cell
        bottom_right = merged.end_cell
        
        # 获取合并后的值
        value = ws[top_left.coordinate].value
        
        result.append({
            'value': value,
            'top_row': top_left.row,
            'bottom_row': bottom_right.row,
            'left_col': top_left.column,
            'right_col': bottom_right.column,
        })
    
    return merged_cells
```

#### 处理公式

```python
def parse_formulas(self, ws):
    """提取公式"""
    formulas = []
    
    for row in ws.iter_rows():
        for cell in row:
            if cell.value and str(cell.value).startswith('='):
                formulas.append({
                    'cell': cell.coordinate,
                    'formula': cell.value,
                    'result': cell.value,  # data_only=True 时是计算结果
                })
    
    return formulas
```

---

### 3.2 pandas 实现

**LlamaIndex 使用 pandas 简化 Excel 处理**。

```python
import pandas as pd

class PandasExcelParser:
    def parse(self, file_path: str):
        # 读取所有 Sheet
        excel_file = pd.ExcelFile(file_path, engine='openpyxl')
        
        sheets_content = []
        
        for sheet_name in excel_file.sheet_names:
            # 读取 Sheet
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            
            # 转为 Markdown
            markdown = df.to_markdown(index=False)
            
            sheets_content.append(f"## {sheet_name}\n\n{markdown}")
        
        return "\n\n".join(sheets_content)
```

---

### 3.3 Camelot（PDF 表格提取）

**专门处理 PDF 中的表格**。

```python
import camelot
import cv2
import numpy as np

class CamelotParser:
    def extract_tables(self, pdf_path: str):
        # 方法 1：Lattice（有框线表格）
        tables_lattice = camelot.read_pdf(
            pdf_path,
            pages='all',
            flavor='lattice'  # 检测线条
        )
        
        # 方法 2：Stream（无框线表格）
        tables_stream = camelot.read_pdf(
            pdf_path,
            pages='all',
            flavor='stream'  # 检测文本间距
        )
        
        # 选择准确率高的
        best_tables = []
        for lattice, stream in zip(tables_lattice, tables_stream):
            if lattice.parsing_report['accuracy'] > stream.parsing_report['accuracy']:
                best_tables.append(lattice)
            else:
                best_tables.append(stream)
        
        return best_tables
    
    def _detect_lines(self, image):
        """检测表格线条（Lattice 模式）"""
        # 1. 转为灰度
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 2. 二值化
        _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
        
        # 3. 检测水平线
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        horizontal_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
        
        # 4. 检测垂直线
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        vertical_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)
        
        # 5. 合并线条
        table_structure = cv2.addWeighted(horizontal_lines, 0.5, vertical_lines, 0.5, 0)
        
        return table_structure
    
    def _detect_cells(self, image, table_structure):
        """检测单元格（基于线条交点）"""
        # 1. 查找轮廓
        contours, _ = cv2.findContours(
            table_structure,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        cells = []
        for contour in contours:
            # 2. 获取边界框
            x, y, w, h = cv2.boundingRect(contour)
            
            # 3. 过滤小区域
            if w > 50 and h > 20:
                cells.append((x, y, w, h))
        
        return cells
```

---

## 四、其他格式 Parser

### 4.1 Markdown Parser

```python
class MarkdownParser:
    def parse(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析结构
        sections = []
        current_section = {'level': 0, 'title': '', 'content': []}
        
        for line in content.split('\n'):
            # 检测标题
            if line.startswith('#'):
                # 保存之前的 section
                if current_section['title']:
                    sections.append(current_section)
                
                # 开始新 section
                level = line.count('#')
                title = line.lstrip('#').strip()
                current_section = {'level': level, 'title': title, 'content': []}
            else:
                current_section['content'].append(line)
        
        # 添加最后一个 section
        if current_section['title']:
            sections.append(current_section)
        
        return sections
```

---

### 4.2 HTML Parser

```python
from bs4 import BeautifulSoup

class HTMLParser:
    def parse(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')
        
        # 移除脚本和样式
        for script in soup(['script', 'style']):
            script.decompose()
        
        # 提取正文
        # 策略 1：提取 main 标签
        main = soup.find('main')
        if main:
            content = main.get_text(separator='\n', strip=True)
        else:
            # 策略 2：提取所有段落
            paragraphs = soup.find_all('p')
            content = '\n\n'.join([p.get_text(strip=True) for p in paragraphs])
        
        # 提取标题
        title = soup.find('title')
        title_text = title.get_text(strip=True) if title else ''
        
        return {
            'title': title_text,
            'content': content,
            'links': [a['href'] for a in soup.find_all('a', href=True)]
        }
```

---

### 4.3 JSON Parser

```python
import json

class JSONParser:
    def parse(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 扁平化 JSON
        flat = self.flatten_json(data)
        
        # 转为可读文本
        text_parts = []
        for key, value in flat.items():
            text_parts.append(f"{key}: {value}")
        
        return "\n".join(text_parts)
    
    def flatten_json(self, data, parent_key='', sep='.'):
        """扁平化嵌套 JSON"""
        items = []
        if isinstance(data, dict):
            for k, v in data.items():
                new_key = f"{parent_key}{sep}{k}" if parent_key else k
                items.extend(self.flatten_json(v, new_key, sep=sep).items())
        elif isinstance(data, list):
            for i, v in enumerate(data):
                new_key = f"{parent_key}{sep}{i}" if parent_key else str(i)
                items.extend(self.flatten_json(v, new_key, sep=sep).items())
        else:
            items.append((parent_key, data))
        return dict(items)
```

---

## 五、LlamaIndex 统一接口

### 5.1 SimpleDirectoryReader 实现

```python
from pathlib import Path
from typing import Dict, Type, Callable

class SimpleDirectoryReader:
    # 文件扩展名到解析器的映射
    FILE_EXTRACTORS: Dict[str, Callable] = {
        '.pdf': PDFReader,
        '.docx': DocxReader,
        '.doc': DocxReader,  # 尝试用 DocxReader
        '.xlsx': PandasExcelReader,
        '.xls': PandasExcelReader,
        '.pptx': PptxReader,
        '.txt': TextReader,
        '.md': MarkdownReader,
        '.html': HTMLReader,
        '.json': JSONReader,
        '.csv': CSVReader,
    }
    
    def __init__(self, input_dir: str, **kwargs):
        self.input_dir = Path(input_dir)
        self.files = self._discover_files()
    
    def _discover_files(self):
        """发现所有支持的文件"""
        files = []
        for ext in self.FILE_EXTRACTORS.keys():
            files.extend(self.input_dir.glob(f"*{ext}"))
        return files
    
    def load_data(self):
        documents = []
        
        for file_path in self.files:
            # 1. 检测文件类型
            file_ext = file_path.suffix.lower()
            
            # 2. 获取对应解析器
            reader_class = self.FILE_EXTRACTORS.get(file_ext)
            if not reader_class:
                print(f"不支持的文件类型：{file_ext}")
                continue
            
            # 3. 创建解析器实例
            reader = reader_class()
            
            # 4. 解析文件
            docs = reader.load_data(file_path)
            
            # 5. 添加元数据
            for doc in docs:
                doc.metadata.update({
                    'file_name': file_path.name,
                    'file_path': str(file_path),
                    'file_size': file_path.stat().st_size,
                    'file_type': file_ext,
                })
            
            documents.extend(docs)
        
        return documents
```

---

### 5.2 自定义 Parser

```python
from llama_index.core import Document
from llama_index.readers.base import BaseReader

class CustomPDFReader(BaseReader):
    """自定义 PDF 解析器"""
    
    def __init__(self, parser_type: str = 'pymupdf'):
        self.parser_type = parser_type
    
    def load_data(self, file_path: Path) -> list[Document]:
        if self.parser_type == 'pymupdf':
            return self._parse_with_pymupdf(file_path)
        elif self.parser_type == 'llamaparse':
            return self._parse_with_llamaparse(file_path)
        else:
            raise ValueError(f"Unknown parser type: {self.parser_type}")
    
    def _parse_with_pymupdf(self, file_path: Path):
        import fitz
        
        doc = fitz.open(file_path)
        documents = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            doc = Document(
                text=text,
                metadata={
                    'page_number': page_num + 1,
                    'total_pages': len(doc),
                    'source': str(file_path),
                }
            )
            documents.append(doc)
        
        doc.close()
        return documents
    
    def _parse_with_llamaparse(self, file_path: Path):
        from llama_parse import LlamaParse
        
        parser = LlamaParse(
            api_key="llx-...",
            result_type="markdown",
        )
        
        return parser.load_data(str(file_path))
```

---

## 六、性能对比

### 6.1 PDF 解析性能

| 解析器 | 速度 | 准确率 | 表格提取 | 成本 |
|--------|------|--------|---------|------|
| **PyMuPDF** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 免费 |
| **pdfplumber** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 免费 |
| **LlamaParse** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $0.003/页 |
| **Tesseract OCR** | ⭐ | ⭐⭐ | ⭐ | 免费 |

### 6.2 Word 解析性能

| 解析器 | 速度 | 准确率 | 格式保留 | 成本 |
|--------|------|--------|---------|------|
| **python-docx** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 免费 |
| **LibreOffice** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 免费 |
| **Word COM** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Windows only |

### 6.3 Excel 解析性能

| 解析器 | 速度 | 准确率 | 公式支持 | 成本 |
|--------|------|--------|---------|------|
| **openpyxl** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 免费 |
| **pandas** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | 免费 |
| **xlrd** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ (仅.xls) | 免费 |

---

## 七、总结

### Parser 选择决策树

```
文档类型？
│
├─ PDF
│   ├─ 简单文本 → PyMuPDF（免费、快速）
│   ├─ 复杂表格 → Camelot（免费）或 LlamaParse（付费）
│   └─ 扫描件 → LlamaParse（内置 OCR）
│
├─ Word (.docx)
│   └─ python-docx（免费、效果好）
│
├─ Excel
│   ├─ 简单表格 → pandas（快速）
│   └─ 复杂格式 → openpyxl（完整）
│
├─ Markdown/HTML
│   └─ 直接解析（BeautifulSoup for HTML）
│
└─ JSON/CSV
    └─ 标准库解析
```

### 核心原理

1. **PDF** - 解析页面结构，提取文本块（按坐标排序）
2. **Word** - 解压 ZIP，解析 XML（OOXML 格式）
3. **Excel** - 解压 ZIP，解析 XML 或共享字符串表
4. **LlamaParse** - GPT-4V 视觉理解（非传统 OCR）

### 自研建议

1. **复用开源** - PyMuPDF/python-docx/openpyxl 已经很好
2. **关键场景** - 用 LlamaParse（表格/扫描件）
3. **后处理** - 文本清洗、格式转换、质量过滤
4. **中文优化** - 调整分块策略、使用中文 Embedding
