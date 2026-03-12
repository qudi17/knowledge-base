# Product Text-to-SQL Test Framework Skeleton

最小 Python skeleton，目标不是立即覆盖所有产品逻辑，而是先把：

- case 读取
- runner 执行
- evaluator 判分
- summary 输出
- report 生成

串起来。

---

## 目录结构

```text
product-test-framework-skeleton/
├── README.md
├── pyproject.toml
├── cases/
│   └── sample_cases.jsonl
├── configs/
│   └── baseline.json
├── src/
│   └── product_eval/
│       ├── __init__.py
│       ├── main.py
│       ├── models.py
│       ├── case_loader.py
│       ├── runner.py
│       ├── evaluator.py
│       └── report.py
└── outputs/
```

---

## 运行方式

```bash
cd knowledge-base/solution/text-to-sql/product-test-framework-skeleton
python3 -m src.product_eval.main --cases cases/sample_cases.jsonl --output outputs/sample_run
```

运行后会生成：

- `run_records.json`
- `summary.json`
- `report.md`

---

## 当前能力

当前 skeleton 仅提供：

- 本地 JSONL case 读取
- mock runner
- retrieval / generation / execution 分层 run_records
- **SQL 生成逻辑归属 retrieval 阶段**
- generation 阶段记录 `agent_input`、`loop_trace`、`final_answer`
- retrieval hit / recall 简化判分
- generation / result / behavior 简化判分
- baseline diff

这足够作为你后续接产品 API 的骨架。

---

## 你下一步通常会改 3 个地方

### 1. `runner.py`
把 `MockProductRunner` 换成真实产品调用。

### 2. `evaluator.py`
把当前的简化 result/behavior 判分换成真实 SQL 执行与断言检查。

### 3. `sample_cases.jsonl`
替换成你的产品题集。

---

## 推荐接入顺序

1. 先把 runner 接上真实产品
2. 再补 SQL executor / result checker
3. 再补 retrieval 的 SQL logic chain 采集
4. 最后再补复杂 taxonomy 和更细的 report
