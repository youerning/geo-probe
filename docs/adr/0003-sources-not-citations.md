# 检索来源与引用分开建模

每个 Probe 同时保存三类结果：回答中的 Mention、搜索工具返回的 Retrieved Source、回答里显式写出的 Answer Link。三者分开存储和展示，避免把“AI 搜到了这个网页”误读成“AI 引用了这个网页”。

**Consequences**:
- 来源域名统计、渠道分布、来源稳定性都基于 Retrieved Source。
- “官网检索可见度”只表示自有域名是否出现在检索来源里，不表示 AI 一定使用了官网内容。
- 不做逐句引用归因；API 没有提供这种映射。Answer Link 只作为补充信号。
