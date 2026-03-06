# Blog Sources（候选技术博客站点）

用于维护“行业内比较知名的技术博客/工程团队博客”站点列表，后续可用于定时抓取候选文章做研究。

> 约定：
> - 这里只维护站点入口（**homepage 优先**，便于人直接浏览）。
> - 不限制领域，但对 **AI 相关**站点/文章给予更高权重（用于后续抓取与研究优先级排序）。

---

## Sources

| 站点 | 类型 | 入口（Homepage） | AI 权重 | 抓取方式（测试结论） | 提取规则（建议） | 备注 |
|---|---|---|---|---|---|---|
| Anthropic Engineering | 公司工程博客 | https://www.anthropic.com/engineering | high | ✅ 可抓（browser） | 从 `main a` 中筛选 `/engineering/` 文章链接；去重 | 你点名的例子 |
| Google AI Blog | 公司研究 | https://research.google/blog/label/generative-ai/ | medium | ⚠️ 未测（待测） | 预计：从列表页 `a[href*="/blog/"]` 或卡片链接提取；必要时分页 | 历史文章多（可能有迁移/归档） |
| GitHub Engineering | 工程实践 | https://github.blog/ai-and-ml/ | high | ✅ 可抓（browser） | 从 `article a[href]` 中取文章链接；过滤作者页（`/author/`）等非文章链接 | GitHub engineers and industry thought |
| 稀土掘金 AI | 开发者社区 | https://juejin.cn/ai | high | ✅ 可抓（browser） | 提取 `a[href*="/post/"]`；去重；可按“最新/推荐”切换（如需要） | 实战多、LLM/Agent/RAG 工程化，一线开发者分享多 |
| InfoQ AI | 架构/技术深度 | https://www.infoq.cn/topic/AI&LLM | low | ✅ 可抓（browser） | 提取 `a[href*="/article/"]` 与 `a[href*="/news/"]`；去重 | 偏架构、大模型工程化、落地案例，专家撰稿为主 |
| 字节跳动技术博客 | 大厂工程博客 | https://opensource.bytedance.com/blog | high | ✅ 可抓（browser，需点击卡片） | 列表页可能无 `a[href]`；需模拟点击卡片进入 `blogDetail/<id>`；或解析页面脚本数据（后续优化） | 大模型（豆包）、推荐系统、NLP、工程实践一手内容 |
| Thoughtworks AI Insights | AI洞见 | https://www.thoughtworks.com/zh-cn/insights/blog?f-topic=AI%20and%20ML | medium | ⚠️ 未测（待测） | 预计：提取列表卡片 `a[href]`；注意可能需要滚动/分页加载 | Thoughtworks AI Insights |

---

## TODO（可选增强）

- 为每个来源打标签（domain 候选：rag / llm / infra / data / security / frontend / mobile / devtools…）。
- 维护“AI 权重”字段口径（high/medium/low）：用于后续抓取与研究优先级排序。
