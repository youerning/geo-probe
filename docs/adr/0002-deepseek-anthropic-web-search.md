# 使用 DeepSeek Anthropic 端点 + 服务端 web_search

探测走 DeepSeek 的 Anthropic 兼容端点 `/anthropic/v1/messages`，并使用服务端工具 `web_search_20250305`，默认模型 `deepseek-v4-flash`。这样回答链路更接近“带联网搜索的 AI 助手”，同时能从 `web_search_tool_result` 里拿到搜索词、来源 URL 和位次。

**Considered Options**:
- OpenAI Responses 端点 + `web_search`：同样能联网，但实测 `annotations` 为空，拿不到来源 URL。
- 自己调 `/v1/tools/search` + Chat Completions：能拿到结构化来源和可控引用，但这是模拟链路，不等同原生搜索行为。

**Consequences**:
- “引用”被定义为回答文本中的品牌/产品提及（Mention），不是网页级 citation。
- 来源列表是 AI 检索到的网页，不等于模型逐句引用；UI 和 README 都明确区分。
- DeepSeek 文档写 `web_search` 只支持 `deepseek-v4-pro`，但 Anthropic 端点实测 `deepseek-v4-flash` 可用；如果未来 Flash 不支持，设置里可以切到 Pro。
