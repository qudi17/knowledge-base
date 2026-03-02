# nanobot 入口点普查报告

## 📊 扫描概览

- **扫描时间**: 2026-03-02
- **项目**: nanobot (HKUDS/nanobot)
- **代码文件数**: 72 个 Python 文件
- **扫描方法**: 14 种入口点类型系统性扫描

---

## 🔍 14 种入口点扫描结果

### ✅ 1. API 入口

**扫描命令**: `grep -r "@app\|@router\|FastAPI\|Flask" . --include="*.py"`

**发现**:
- `./nanobot/cli/commands.py` - 使用 Typer CLI 框架
  - `@app.callback()` - CLI 回调
  - `@app.command()` - CLI 命令（4 个）

**分析**: nanobot 不使用传统的 Web API 框架（FastAPI/Flask），而是使用 Typer 作为 CLI 入口。

---

### ✅ 2. CLI 入口

**扫描命令**: `find . -name "__main__.py" -o -name "cli.py"`

**发现**:
- `./nanobot/__main__.py` - 主入口点

**文件内容**:
```python
# nanobot/__main__.py:1-5 (5 行)
from nanobot.cli.commands import app

if __name__ == "__main__":
    app()
```

**分析**: 简洁的入口设计，直接调用 CLI 应用。

---

### ✅ 3. Cron 定时任务

**扫描命令**: `grep -r "schedule\|crontab\|beat_schedule\|asyncio.sleep\|time.sleep" . --include="*.py"`

**发现**:
- `./nanobot/agent/tools/cron.py` - Cron 工具
- `./nanobot/cron/service.py` - Cron 服务
- `./nanobot/cli/commands.py` - CLI 中的 cron 命令

**关键文件**:
- `nanobot/cron/service.py` (13,134 字节) - 核心 cron 服务
- `nanobot/cron/types.py` (1,586 字节) - 类型定义

**支持的调度类型**:
- `every` - 周期性执行（毫秒间隔）
- `cron` - Cron 表达式（如 `0 9 * * *`）
- `at` - 一次性执行（指定时间戳）

---

### ❌ 4. Celery 任务

**扫描命令**: `grep -r "@celery_app.task\|@shared_task" .`

**发现**: 无

**分析**: nanobot 不使用 Celery，使用内置的轻量级 cron 服务。

---

### ❌ 5. 事件触发器

**扫描命令**: `find . -type d -name "events" -o -name "signals" -o -name "listeners"`

**发现**: 无独立 events/signals 目录

**相关发现**:
- `./nanobot/bus/events.py` - 事件总线事件定义

---

### ❌ 6. Webhook

**扫描命令**: `find . -type d -name "webhooks" -o -name "hooks"`

**发现**: 仅 `.git/hooks`（Git 钩子）

**分析**: nanobot 不使用传统 Webhook，各频道使用各自的原生协议。

---

### ✅ 7. 消息队列

**扫描命令**: `find . -type d -name "queue*" -o -name "bus*" -o -name "messaging*"`

**发现**:
- `./nanobot/bus/` - 消息总线目录

**目录内容**:
```
nanobot/bus/
├── __init__.py
├── events.py    (1,147 字节) - 事件定义
└── queue.py     (1,499 字节) - 队列实现
```

**分析**: 轻量级内置消息总线，不依赖外部消息队列。

---

### ✅ 8. 上传接口

**扫描命令**: `grep -r "upload\|Upload" . --include="*.py"`

**发现**:
- `./nanobot/channels/matrix.py` - Matrix 上传支持
  - `_resolve_server_upload_limit_bytes()` - 查询服务器上传限制
  - 附件上传失败处理

**分析**: 上传功能集成在各频道实现中，非独立接口。

---

### ✅ 9. GraphQL

**扫描命令**: `find . -name "*.graphql" -o -name "schema.py"`

**发现**:
- `./nanobot/config/schema.py` - 配置 Schema（非 GraphQL）

**分析**: 使用 Pydantic 进行配置验证，不使用 GraphQL。

---

### ✅ 10. WebSocket

**扫描命令**: `grep -r "websocket\|WebSocket" . --include="*.py"`

**发现**:
- `./nanobot/channels/dingtalk.py` - 钉钉 WebSocket
- `./nanobot/channels/whatsapp.py` - WhatsApp WebSocket 桥接
- `./nanobot/channels/discord.py` - Discord Gateway WebSocket
- `./nanobot/config/schema.py` - Feishu WebSocket 配置

**关键实现**:
```python
# discord.py 使用 websockets 库
import websockets
async with websockets.connect(self.config.gateway_url) as ws:
    # 处理 Discord Gateway 事件
```

---

### ❌ 11. 中间件

**扫描命令**: `grep -r "middleware\|@middleware" . --include="*.py"`

**发现**: 无

**分析**: 轻量级设计，未使用中间件模式。

---

### ✅ 12. 插件系统

**扫描命令**: `find . -type d -name "plugin*" -o -name "extension*" -o -name "skill*"`

**发现**:
- `./nanobot/agent/skills.py` (8,260 字节) - 技能系统
- `./nanobot/skills/` - 技能目录
- `./nanobot/skills/skill-creator/` - 技能创建器

**分析**: 使用"技能"（Skills）而非"插件"概念，支持热加载。

---

### ❌ 13. 管理命令

**扫描命令**: `find . -path "*/management/commands" -o -name "rake"`

**发现**: 无

**分析**: CLI 命令通过 Typer 实现，非 Django/Rails 风格。

---

### ✅ 14. 测试入口

**扫描命令**: `find . -name "test_*.py" -o -name "*_test.py"`

**发现**: 15+ 个测试文件

**测试文件列表**:
- `./tests/test_feishu_post_content.py`
- `./tests/test_cron_commands.py`
- `./tests/test_task_cancel.py`
- `./tests/test_memory_consolidation_types.py`
- `./tests/test_message_tool.py`
- `./tests/test_context_prompt_cache.py`
- `./tests/test_cron_service.py`
- `./tests/test_heartbeat_service.py`
- `./tests/test_matrix_channel.py`
- `./tests/test_consolidate_offset.py`
- `./tests/test_cli_input.py`
- `./tests/test_commands.py`
- `./tests/test_tool_validation.py`
- `./tests/test_email_channel.py`
- `./tests/test_message_tool_suppress.py`

---

## 📁 核心模块目录结构

```
nanobot/
├── __init__.py           # 包初始化
├── __main__.py           # CLI 入口
├── agent/                # 代理核心
│   ├── context.py        # 上下文管理
│   ├── loop.py           # 代理循环
│   ├── memory.py         # 记忆系统
│   ├── skills.py         # 技能系统
│   ├── subagent.py       # 子代理
│   └── tools/            # 工具系统
│       ├── base.py       # 工具基类
│       ├── cron.py       # Cron 工具
│       ├── filesystem.py # 文件系统工具
│       ├── mcp.py        # MCP 工具
│       ├── message.py    # 消息工具
│       ├── registry.py   # 工具注册表
│       ├── shell.py      # Shell 工具
│       ├── spawn.py      # 生成工具
│       └── web.py        # Web 工具
├── bus/                  # 消息总线
│   ├── events.py         # 事件定义
│   └── queue.py          # 队列实现
├── channels/             # 频道系统（11 个频道）
│   ├── base.py           # 频道基类
│   ├── manager.py        # 频道管理器
│   ├── dingtalk.py       # 钉钉
│   ├── discord.py        # Discord
│   ├── email.py          # 邮件
│   ├── feishu.py         # 飞书
│   ├── matrix.py         # Matrix
│   ├── mochat.py         # 企业微信
│   ├── qq.py             # QQ
│   ├── slack.py          # Slack
│   ├── telegram.py       # Telegram
│   └── whatsapp.py       # WhatsApp
├── cli/                  # CLI 命令
│   └── commands.py       # 38,627 字节 - 主 CLI 实现
├── config/               # 配置系统
│   └── schema.py         # 配置 Schema
├── cron/                 # Cron 服务
│   ├── service.py        # Cron 服务
│   └── types.py          # Cron 类型
├── heartbeat/            # 心跳服务
│   └── service.py        # 心跳实现
├── providers/            # LLM 提供者
│   ├── base.py           # 提供者基类
│   ├── custom_provider.py # 自定义提供者
│   ├── litellm_provider.py # LiteLLM 提供者
│   ├── openai_codex_provider.py # OpenAI Codex
│   ├── registry.py       # 提供者注册表
│   └── transcription.py  # 语音转写
├── session/              # 会话管理
│   └── manager.py        # 会话管理器
├── skills/               # 技能目录
│   └── skill-creator/    # 技能创建器
├── templates/            # 模板目录
└── utils/                # 工具函数
```

---

## 🎯 活跃入口点总结

| 入口点类型 | 状态 | 文件/位置 |
|-----------|------|----------|
| CLI 入口 | ✅ 活跃 | `__main__.py`, `cli/commands.py` |
| Cron 定时任务 | ✅ 活跃 | `cron/service.py`, `agent/tools/cron.py` |
| 消息队列 | ✅ 活跃 | `bus/queue.py`, `bus/events.py` |
| WebSocket | ✅ 活跃 | `channels/discord.py`, `channels/dingtalk.py`, `channels/whatsapp.py` |
| 插件系统 | ✅ 活跃 | `agent/skills.py`, `skills/` |
| 测试入口 | ✅ 活跃 | `tests/` (15+ 文件) |
| 上传接口 | ✅ 活跃 | `channels/matrix.py` |
| API 入口 | ⚠️ 部分 | CLI 使用 Typer，无 Web API |
| Celery 任务 | ❌ 无 | - |
| 事件触发器 | ❌ 无独立目录 | `bus/events.py` |
| Webhook | ❌ 无 | - |
| GraphQL | ❌ 无 | - |
| 中间件 | ❌ 无 | - |
| 管理命令 | ❌ 无 | CLI 替代 |

---

## 📊 统计指标

- **总入口点类型**: 14 种
- **活跃入口点**: 8 种 (57%)
- **核心模块数**: 14 个
- **频道实现数**: 11 个
- **工具实现数**: 8 个
- **提供者实现数**: 4 个
- **测试文件数**: 15+ 个

---

## 🔗 关键入口点追踪路径

1. **CLI 启动路径**: `__main__.py` → `cli/commands.py` → `app()`
2. **消息处理路径**: `channels/*.py` → `agent/loop.py` → `agent/tools/*.py`
3. **定时任务路径**: `cron/service.py` → `agent/tools/cron.py`
4. **WebSocket 路径**: `channels/discord.py` → `agent/loop.py`
5. **技能加载路径**: `agent/skills.py` → `skills/`

---

*生成时间：2026-03-02*
