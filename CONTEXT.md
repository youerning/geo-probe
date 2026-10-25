# GEO Probe

GEO Probe 是一个本地优先的 GEO（生成式引擎优化）探测工具：批量向 AI 提问，记录回答、品牌/竞品提及和检索来源，并把结果留在用户自己的浏览器里。

## Language

### 探测对象

**Project**:
一个被监测的品牌及其竞品、提示词和批次集合。
_Avoid_: 账户、工作区

**Target**:
一个被追踪的实体，可能是品牌（Brand）或竞品（Competitor）。
_Avoid_: 关键词、公司

**Prompt**:
用户会向 AI 提出的一个自然语言问题。
_Avoid_: 关键词、query（搜索词是 AI 自己改写的）

**Run**:
一次批量探测，包含若干 Prompt × 重复次数。
_Avoid_: 任务、批次（中文 UI 可用“批次”，代码和文档用 Run）

**Probe**:
一个 Prompt 在一个 Provider 上的一次执行。
_Avoid_: 请求、样本

### 结果

**Mention（引用）**:
AI 回答文本中出现某个 Target 的名称或别名。这是本项目的“引用”口径。
_Avoid_: Citation、引用来源（这两个词指网页来源）

**Retrieved Source**:
搜索工具返回给模型的网页，包含 title、URL、位次和搜索词。
_Avoid_: 引用来源、Citation（模型不一定使用它）

**Answer Link**:
AI 在最终回答里显式写出的 URL。
_Avoid_: 引用来源（它比 Retrieved Source 更接近“引用”，但仍不等于逐句归因）

**Source Domain**:
Retrieved Source 的主域名，用于域名统计。
_Avoid_: 站点、网站

**Source Channel**:
来源的渠道类型，例如百科、社交平台、微信公众号、新闻媒体、企业信息、应用商店。
_Avoid_: 来源类型（太泛）

**Source Ownership**:
来源相对 Target 的归属：自有、竞品、第三方。
_Avoid_: 来源属性

**List Position**:
从 AI 回答的编号/项目符号列表里解析出的推荐位次。
_Avoid_: 排名（容易和搜索排名混淆）

### 指标

**Mention Rate（提及率）**:
出现品牌 Mention 的 Probe 数 ÷ 成功 Probe 数。

**First Mention Rate（首位提及率）**:
品牌是回答中第一个被提到的 Target 的 Probe 数 ÷ 成功 Probe 数。

**Share of Voice（SoV，声量份额）**:
品牌 Mention 的 Probe 数 ÷ 所有 Target Mention 的 Probe 数之和。

**Source Stability（来源稳定性）**:
同一 Prompt 多次 Probe 的来源域名集合的两两 Jaccard 相似度平均值。

**Owned Domain Visibility（官网检索可见度）**:
Retrieved Source 中出现品牌自有域名的 Probe 数 ÷ 成功 Probe 数。

## Relationships

- 一个 Project 包含多个 Prompt、Run 和 Target。
- 一个 Run 包含多个 Probe；一个 Probe 对应一个 Prompt 和一次重复。
- 一个 Probe 产生一条回答、若干搜索词、若干 Retrieved Source、若干 Mention。
- Mention 属于 Target；Retrieved Source 属于 Probe；Answer Link 属于 Probe。
- “引用”在本项目里始终指 Mention，不指 Retrieved Source。
