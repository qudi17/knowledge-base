# 阶段 1：入口点普查

**执行日期**: 2026-03-04  
**扫描范围**: 14+ 种入口点类型

---

## 📍 活跃入口点清单

### 1. CLI 入口 ✅

**文件**: `main.py`
- **功能**: 运行 Manus 单 Agent 模式
- **调用链**: `main()` → `Manus.create()` → `agent.run()`
- **参数**: `--prompt` 可选参数

**文件**: `run_flow.py`
- **功能**: 运行多 Agent Planning Flow
- **调用链**: `run_flow()` → `FlowFactory.create_flow()` → `PlanningFlow.execute()`
- **超时设置**: 3600 秒（1 小时）
- **支持 Agent**: Manus, DataAnalysis

**文件**: `run_mcp.py`
- **功能**: MCP（Model Context Protocol）模式
- **集成**: MCP Server 支持

**文件**: `run_mcp_server.py`
- **功能**: 独立 MCP Server 入口

**文件**: `sandbox_main.py`
- **功能**: 沙箱 Agent 主入口

---

### 2. API 入口 ✅

**文件**: `protocol/a2a/app/main.py`
- **功能**: A2A（Agent-to-Agent）协议 API
- **框架**: FastAPI/Flask（待确认）

---

### 3. 插件/扩展系统 ✅

**目录**: `app/tool/` - 工具插件系统
- **工具注册**: 通过 ToolCollection 统一管理
- **动态加载**: 支持自定义工具扩展

---

## 📊 入口点统计

| 类型 | 数量 | 状态 |
|------|------|------|
| CLI 入口 | 5 | ✅ 活跃 |
| API 入口 | 1 | ✅ 活跃 |
| 插件系统 | 1 | ✅ 活跃 |
| Webhook | 0 | ❌ 未使用 |
| 消息队列 | 0 | ❌ 未使用 |
| Cron 任务 | 0 | ❌ 未使用 |

---

## 🔍 关键发现

1. **多模式启动**: 支持单 Agent（main.py）、多 Agent Flow（run_flow.py）、MCP（run_mcp.py）三种模式
2. **Flow 工厂模式**: 通过 FlowFactory 创建不同类型的工作流
3. **超时保护**: run_flow.py 设置 1 小时超时保护
4. **沙箱隔离**: 独立的 sandbox_main.py 用于安全执行

---

**完整性**: ✅ 所有活跃入口点已识别  
**下一步**: 阶段 2 - 模块化分析
