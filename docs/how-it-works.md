# GEO Probe 工作原理：从一次提问到一组指标

本文讲的是代码实际怎么跑，而不是产品愿景。术语以 [`CONTEXT.md`](../CONTEXT.md) 为准；为什么这样设计见 [`docs/adr`](adr/)；只想快速上手可以看 [`README.md`](../README.md#它怎么工作)。

一句话概括：**GEO Probe 把“批量向 AI 提问 → 保存回答和检索来源 → 在浏览器里做文本分析 → 算出指标”整条链路放在纯静态前端里完成。** 没有后端、没有数据库服务，DeepSeek API Key 和探测数据都不经过项目服务器。

## 1. 全景

```text
Project（品牌 + 竞品 + 提示词）
        │
        ▼
Run（冻结 aliasSnapshot / promptSnapshot）
        │  Prompt × repeats，并发 1–3
        ▼
Probe ── POST {base}/anthropic/v1/messages
        │     └─ 服务端工具 web_search_20250305
        │          ├─ 搜索词
        │          └─ 检索来源（title / URL / 位次）
        ├─ 最终回答 text
        ▼
浏览器内后处理
        ├─ cleanAnswer          清理“我先搜索一下”这类开场
        ├─ normalizeSources     URL 规范化、域名聚合、渠道/归属分类
        ├─ matchTargets         品牌/竞品别名匹配
        ├─ parseListItems       推荐榜/列表位次解析
        └─ extractAnswerLinks   回答里显式写出的 URL
        ▼
IndexedDB（projects / prompts / runs / probes / settings）
        ▼
仪表盘、批次详情、来源分析、推荐榜、导出
```

这条链路里最容易混淆的是三件事：

| 概念 | 含义 | 不是什么 |
| --- | --- | --- |
| **Mention（引用）** | AI 回答文本里出现了某个 Target 的名称或别名 | 不是网页 citation，也不是“AI 推荐了你” |
| **Retrieved Source** | 搜索工具返回给模型的网页，包含 title、URL、位次和搜索词 | 不代表模型逐句引用了它，甚至不代表模型读过正文 |
| **Answer Link** | AI 在最终回答里显式写出的 URL | 不等于检索来源，也不等于逐句归因 |

在 GEO Probe 的中文 UI 里，“引用”始终指 Mention。来源列表单独展示，避免把“搜到了”误读成“引用了”。

## 2. 数据模型与快照

核心对象只有五个：

| 对象 | 作用 | 关键点 |
| --- | --- | --- |
| **Project** | 一个被监测的品牌、它的竞品、提示词和批次集合 | 品牌和目标都以 `Target` 表示 |
| **Target** | 被追踪的实体，`kind` 为 `brand` 或 `competitor` | 有 `label`、`aliases`、`domains` |
| **Prompt** | 一条自然语言问题 | 带标签（通用词、品牌词、产品词等） |
| **Run** | 一次批量探测 | 创建时冻结配置和快照 |
| **Probe** | 一个 Prompt 在一个 Provider 上的一次执行 | 对应一条回答及它的分析结果 |

一个 Run 包含多个 Probe；一个 Probe 对应一个 Prompt 和一次重复。Probe 的 ID 固定为：

```text
{runId}__{promptId}__{repeatIndex}
```

这个 ID 是补跑和重试的幂等基础：同一个 Run 里，同一条 Prompt 的第 N 次重复永远对应同一条 Probe。

### 为什么要冻结快照

创建 Run 时，`startRun()` 会把当前的品牌/竞品写入 `aliasSnapshot`，把 Prompt 写入 `promptSnapshot`，同时保存模型、重复次数、并发、system prompt 版本等配置。

这意味着：

- 之后修改品牌别名、删除 Prompt、改竞品域名，都不会改变历史批次的含义。
- 补跑旧批次时，用的是旧批次的 Prompt 和别名，而不是项目当前的最新值。
- 不同批次之间的指标可以按同一口径比较。

Run 还会记录 `previousRunId`（创建时最近一个 `completed` 或 `partial` 的批次）、`appVersion` 和 `schemaVersion`，用于来源变化对比和问题排查。

## 3. 一次 Run 的执行过程

### 3.1 运行前

用户在“运行探测”页选择：

- 要跑的 Prompt；
- 模型（默认 `deepseek-v4-flash`，可切 `deepseek-v4-pro`）；
- 每条 Prompt 重复次数（默认 3）；
- 并发（1–3）；
- 每次最多搜索次数（默认 5）。

API Key 从 `localStorage` 或 `sessionStorage` 读取。设置里填了自定义 API 地址时进入代理模式，允许 Key 为空；此时请求不带 `x-api-key`，由代理自行处理鉴权。

页面上的预计费用和耗时只是估算：优先用最近一个批次里成功 Probe 的平均 token、搜索次数和延迟；没有历史数据时用一组保守的默认值。真实账单以 DeepSeek 为准。

### 3.2 建 Run、展开任务

`startRun()` 先检查是否至少选择了一条 Prompt，然后：

1. 读取最近一个 `completed` / `partial` 批次作为 `previousRunId`；
2. 写入一条 `status: "running"` 的 Run；
3. 把 `Prompt × repeats` 展开成任务列表；
4. 启动 worker 池执行。

`plannedProbeCount = prompts.length × repeats`。UI 上的进度条以这个数为分母。

### 3.3 并发执行

执行器是一个固定大小的 worker 池：

```text
worker 1 ─┐
worker 2 ─┼─ 共享 cursor，取出下一个任务 → executeProbe → 写入 IndexedDB
worker 3 ─┘
```

实际并发数会被限制在 `1–3`：

```ts
Math.max(1, Math.min(concurrency, 3))
```

每完成一个 Probe，worker 立即把它写入 IndexedDB，并通过 `onProgress` 回调更新页面。**不是等整批跑完再统一落库**，所以取消或关闭页面时，已经完成的结果仍然保留。

任务列表按“Prompt 外层、重复内层”生成，worker 也按这个顺序取任务；但多个 worker 并行执行，完成顺序会受网络延迟影响，不保证前一条 Prompt 先跑完。

### 3.4 单次 Probe 的重试

`executeProbe()` 最多尝试 3 次（`MAX_ATTEMPTS = 3`）。一次完整尝试包括：

1. 检查是否已被用户取消；
2. 调用 DeepSeek，单次请求超时 180 秒；
3. 把返回的 `text` 块拼成回答；
4. 清理回答；
5. 如果回答为空，按“可重试”处理。

重试规则：

| 情况 | 是否重试 | 说明 |
| --- | --- | --- |
| 401 / 402 / 403 | 否 | Key 无效、余额不足或请求被拒绝 |
| 408 / 429 / 5xx | 是 | 超时、限流、服务端异常 |
| 网络错误 | 是 | `fetch` 抛出的网络异常 |
| 180 秒超时 | 是 | 转换为 `timeout` 错误 |
| 响应不是合法 JSON | 是 | `invalid_json` |
| 空回答 | 是 | 第 3 次仍为空则记为 `empty` |
| 用户取消 | 否 | 直接中断，不落一条失败 Probe |

退避时间很短：空回答重试约 `900ms × 尝试次数`，异常重试约 `1200ms × 尝试次数` 再加 0–400ms 随机抖动。这样既避免瞬时抖动，也不会让一批任务等太久。

最终每个任务会得到以下状态之一：

| 状态 | 含义 |
| --- | --- |
| `success` | 拿到非空回答，并完成分析 |
| `error` | 重试耗尽或遇到不可重试错误 |
| `empty` | 请求成功，但模型只返回了空文本 |
| `cancelled` | 类型上保留；当前实现取消时直接停止 worker，不会把半成品写成 Probe |

### 3.5 Run 的结束状态

整批结束后，根据成功和失败数量决定 Run 状态：

| 状态 | 条件 |
| --- | --- |
| `completed` | 没有失败 Probe |
| `partial` | 有成功也有失败 |
| `failed` | 一个都没成功 |
| `cancelled` | 用户取消 |

注意：进度条里的“失败”包含 `error` 和 `empty`，因为两者都拿不到可用回答。

### 3.6 取消、继续运行、重试失败项

这三个操作经常被混淆：

| 操作 | 行为 |
| --- | --- |
| **取消** | 通过 `AbortController` 中断正在进行的请求；worker 停止取新任务；已完成的 Probe 保留；Run 标记为 `cancelled` |
| **继续运行** | 重新读取该 Run 的 `promptSnapshot` 和 `config`，跳过已经 `success` 的 Probe，只补跑其余项 |
| **重试失败项** | 串行重跑该 Run 中所有 `error` / `empty` 的 Probe，用相同 Probe ID 覆盖原记录，完成后重新计算 Run 状态 |

“继续运行”不会重新读取项目当前的 Prompt 或别名，它只认这个 Run 自己的快照。因此历史批次补跑出来的结果，和原批次保持同一口径。

关闭浏览器标签页会直接中断浏览器里的执行，但不会删除已经写入 IndexedDB 的结果。运行中页面会注册 `beforeunload` 提示，减少误关闭。

## 4. 请求 DeepSeek 的具体形态

### 4.1 端点

默认地址是：

```text
https://api.deepseek.com/anthropic/v1/messages
```

`buildMessagesUrl()` 的规则是：

- 自定义地址为空：使用默认 `API_BASE_URL`；
- 自定义地址以 `/anthropic/v1/messages` 结尾：直接使用；
- 其他情况：在末尾拼上 `/anthropic/v1/messages`。

请求头：

```http
content-type: application/json
anthropic-version: 2023-06-01
x-api-key: <用户的 Key>   # 代理模式下可省略
```

### 4.2 请求体

请求体只包含一次用户消息和一个服务端搜索工具：

```json
{
  "model": "deepseek-v4-flash",
  "max_tokens": 3000,
  "system": "你是一个乐于助人的助手。请直接回答用户问题，不要描述你的搜索或思考过程。",
  "tools": [
    {
      "type": "web_search_20250305",
      "name": "web_search",
      "max_uses": 5
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [{ "type": "text", "text": "用户的问题" }]
    }
  ],
  "temperature": 1
}
```

几个关键选择：

- 使用 **Anthropic 兼容端点**，而不是 OpenAI Responses 端点。实测前者的 `web_search_tool_result` 能拿到来源 URL，后者的 `annotations` 为空。
- 使用服务端工具 `web_search_20250305`，让模型自己决定搜什么、搜几次。`max_uses` 限制单次探测的搜索次数，默认 5。
- system prompt 是固定的中性提示词，版本记录在 `SYSTEM_PROMPT_VERSION`。它不是 DeepSeek App 的内部提示词，所以结果不应等同于 App 的官方行为。
- 默认模型是 `deepseek-v4-flash`。DeepSeek 文档写 `web_search` 只支持 `deepseek-v4-pro`，但该端点实测 Flash 可用；如果遇到搜索异常，可以在设置里切到 Pro。

### 4.3 响应解析

Provider 只负责把供应商响应转成统一结构，不做指标计算。解析出的内容有：

| 字段 | 来源 |
| --- | --- |
| `answer` | 所有 `type: "text"` 块的文本拼接 |
| `queries` | `server_tool_use` 块里的 `input.query`，按出现顺序编号 |
| `sources` | `web_search_tool_result` 块里的 `web_search_result` 数组 |
| `usage` | `usage.input_tokens`、`output_tokens`、`cache_read_input_tokens`、`server_tool_use.web_search_requests` |
| `requestId` | 响应顶层 `id` |
| `stopReason` | 响应顶层 `stop_reason` |
| `model` | 响应里的实际模型名，缺失时回退到请求模型 |

来源的位次是**每个搜索词内部**从 1 开始重新计数的，不是全局排名。同一个 URL 可能被多个搜索词返回，后续由分析层合并。

`content` 里如果出现 `web_search_tool_result` 的错误对象（而不是结果数组），对应的搜索词会记录 `error`，但不影响整个 Probe 成功。

有些搜索调用返回的是内部 ID（例如 `ws_call_id=...` 或 `call_...`），这类搜索词会显示为「内部检索」，但仍然保留它返回的来源。

这里没有网页正文抓取。GEO Probe 保存的是搜索工具返回的 title、URL、page age 和位次；页面是否 404、内容是否过期，需要在外部验证。

## 5. 回答后处理

一次 Probe 拿到回答和来源后，会依次经过五个分析步骤。它们都在浏览器里执行，且是纯函数，便于测试。

### 5.1 清理回答（`cleanAnswer`）

模型有时会先输出一段“我先搜索一下相关资料”的计划性文字，再给最终答案。`cleanAnswer()` 会做启发式清理：

- 按空行分段；
- 如果第一段少于 400 字符；
- 且以 `I'll`、`Let me`、`我先`、`让我` 等开头；
- 且包含 `search`、`look up`、`查询`、`搜索` 等词；

就丢掉第一段，保留后面的内容。

这是启发式规则，不是语义判断。如果模型真的把有效内容写在第一段，可能被误删；这是为了减少“搜索过程”污染回答文本而接受的取舍。

清理后如果回答为空，最终会记为 `empty`。

### 5.2 来源规范化（`normalizeSources`）

原始来源是“某个搜索词返回的第 N 条结果”。分析层会把它变成可聚合的 `SearchSource`：

1. **只接受 HTTP/HTTPS URL**，其他协议直接丢弃。
2. **去掉 hash**。
3. **去掉追踪参数**：`utm_*`、`ref`、`from`、`spm`、`share_*` 等；保留业务参数。
4. **生成 canonical URL**，并去掉末尾多余的 `/`。
5. **提取 host 和可注册域名**：host 小写；域名用 `tldts` 解析，例如 `wapbaike.baidu.com` → `baidu.com`。
6. **按 canonical URL 去重**：同一个页面被多个搜索词返回时，合并成一条来源，保留多次 `occurrence`（搜索词、位次）。
7. **分类**：判断平台、渠道和归属。
8. **标题中的品牌提及**：创建来源记录时对当时的标题跑一次 `matchTargets()`，得到 `titleMentions`。
9. **排序**：按该来源在所有 occurrence 中的最佳位次升序，位次相同按标题排序；最后分配 `src_1`、`src_2` 这样的 ID。

去重时，标题取更长的那条，page age 取第一个非空值。这样同一个 URL 的不同标题不会产生多条来源记录。

#### 归属判断顺序

`classifySource()` 的判断顺序很重要：

1. **品牌自有域名**：命中 `brand.domains` → `ownership: "owned"`；
2. **竞品域名**：命中任一 `competitor.domains` → `ownership: "competitor"`；
3. **平台规则**：微信公众号、百科、社交平台、企业信息、应用商店、新闻媒体、政府/教育等 → `ownership: "third_party"`；
4. **兜底**：平台名用域名本身，渠道 `other`，归属 `third_party`。

品牌和竞品的优先级高于平台规则。例如品牌官网如果同时命中某个平台规则，仍然算自有。

平台规则是静态列表，不是模型判断。未收录的站点会落到兜底分类，这不影响来源统计，只是渠道分布里会显示“其他”。

### 5.3 品牌/竞品提及（`matchTargets`）

匹配是**词面匹配**，不做语义理解。流程如下：

1. 对回答文本做 NFKC 归一化并转小写。
2. 对每个 Target 的每个别名做子串查找。
3. 如果是 ASCII 别名（例如 `yuangouchang`、`GEO`），要求前后字符不是 `[a-z0-9]`，避免 `George` 命中 `geo`；中文别名不做词边界限制。
4. 收集所有命中区间。
5. 合并重叠区间。例如别名同时有“元构场”和“元构场智能科技”，在“元构场智能科技”里只会算一次提及，但两个别名都会记录在 `matchedAliases` 中。
6. 按首次出现位置排序，得到 `order`；位置相同则按 Target 在快照中的顺序。
7. 记录首次出现的上下文（前后各约 80 字符）。
8. `count` 是合并后的区间数，不是原始字符串出现次数。

这里有几个直接后果：

- 配置了“GEO”这种通用别名，可能会把普通行业词也算作品牌提及；别名应尽量具体。
- 否定句也会被算作提及。“不推荐某某”仍然包含品牌名，本项目不承诺情感分析。
- “首位”是**已追踪 Targets 中第一个被提到的**，不是回答里第一个出现的公司。回答先提了一个未追踪公司，不会影响这个 `order`。
- 匹配不到别名时，不会用域名、语义或模型兜底。别名配置就是召回边界。

### 5.4 推荐榜解析（`parseListItems`）

很多 AI 回答会用编号列表、项目符号或表格推荐公司。`parseListItems()` 试图从中解析“第几家推荐了你”。

支持的结构：

- `1.`、`1、`、`1)` 编号行；
- `**1. 公司名**` 加粗编号行；
- `-`、`*`、`+` 项目符号；
- Markdown 表格（至少 3 行，且有 2 行以上数据）。

处理过程：

1. 逐行扫描，跳过代码块；
2. 把连续的列表行聚成候选组；
3. 编号列表如果被说明文字打断，但编号继续递增，会尝试合并；
4. 每组按条目打分并求和：
   - 条目中命中 Target：+5；
   - 标题含“公司/科技/营销/GEO/AI”等公司特征词：+2；
   - 标题长度在 2–40 字符：+1；
   - 标题像“总结/建议/来源/优势”等泛化标题：−5；
5. 选总分最高、且至少 2 条的组；
6. 清洗标题：去掉 Markdown 标记，按冒号、破折号、括号截断，最长 80 字符；
7. 对每个条目匹配 Target，得到 `matchedTargetId`；
8. 如果条目的标题或前 160 字符正文匹配到某个 Target，就把该 Target 的 `listPosition` 设为条目的编号；
9. 把未匹配、但像公司名的条目标题收集到 `otherEntities`，最多 20 个。

局限：

- 只对结构化列表/表格有效。整段散文里的“第一家是……”不会被解析。
- 表格解析是简化的 Markdown 表格解析，不处理合并单元格、复杂表头或嵌套表格。
- 榜单分数是启发式，可能出现误判。完整回答始终是最终依据。
- `listPosition` 只表示“在解析出的榜单里排第几”，不是搜索排名，也不是模型给出的官方排名。

### 5.5 回答链接（`extractAnswerLinks`）

从最终回答里提取两类 URL：

- Markdown 链接：`[文本](https://...)`
- 裸 URL：`https://...`

提取后会：

- 去掉末尾的标点、括号；
- 用与来源相同的 `normalizeUrlParts()` 做规范化和去重；
- 最多保留 50 条；
- 标记 `inSources`：该 canonical URL 是否也出现在本次 Probe 的 Retrieved Source 中。

`inSources: true` 表示“回答里写的链接也在搜索工具返回的来源里”，比纯回答链接多一层交叉验证，但仍然不是逐句引用。

## 6. 指标口径

所有指标都在 `lib/analysis/metrics.ts` 里计算，输入是 Run、Probe 和 Prompt 快照。下面是最重要的公式和分母。

| 指标 | 公式 | 分母/说明 |
| --- | --- | --- |
| 提及率 | 有品牌 Mention 的成功 Probe 数 ÷ 成功 Probe 数 | 失败和空回答不进分母 |
| 首位提及率 | 品牌 `order === 1` 的成功 Probe 数 ÷ 成功 Probe 数 | “第一”仅限已追踪 Targets |
| 平均位次 | 有品牌 Mention 的 Probe 的 `order` 平均值 | 只在有提及的 Probe 里平均 |
| 平均榜单位次 | 有 `listPosition` 的品牌 Mention 的位次平均值 | 只在成功解析出榜单的 Probe 里平均 |
| 声量份额 SoV | 某 Target 有提及的 Probe 数 ÷ 所有 Target 的该计数之和 | 不是提及次数占比，也不是 token 占比 |
| 来源出现率 | 含某域名的成功 Probe 数 ÷ 成功 Probe 数 | 同一 Probe 内多次出现只算一次 |
| 来源次数 | 某域名在所有 Probe 中的 occurrence 总数 | 同一 URL 被多个搜索词返回会累计 |
| 来源次数占比 | 某域名 occurrence 数 ÷ 全部来源 occurrence 数 | 分母是来源出现次数，不是 Probe 数 |
| 来源平均位次 | 某域名所有 occurrence 的 `rank` 平均值 | 位次是每个搜索词内部的排名 |
| 来源最佳位次 | 某域名所有 occurrence 的 `rank` 最小值 | |
| 来源稳定性 | 同一 Prompt 的多次成功 Probe 的域名集合两两 Jaccard 相似度平均，再跨 Prompt 平均 | 每个 Prompt 等权；少于 2 次成功 Probe 的 Prompt 跳过 |
| 官网检索可见度 | 含 `ownership: "owned"` 来源的成功 Probe 数 ÷ 成功 Probe 数 | 只代表官网出现在检索来源里 |
| 官网最佳位次 | 自有来源所有 occurrence 的 `rank` 最小值 | 没有自有来源时为 `null` |
| 唯一来源域名数 | 成功 Probe 中不同域名的数量 | |
| 新增/流失来源 | 当前批次域名集合与上一批次成功 Probe 的域名集合做差 | 需要上一批次有 Probe 数据 |
| Answer Link 重合率 | `inSources` 的 Answer Link 数 ÷ 全部 Answer Link 数 | 没有链接时为 `null` |
| 估算费用 | 输入/输出 token × 单价 + 搜索次数 × 单次搜索价 | 按配置的价格表估算，不是账单 |

Jaccard 的定义：

```text
J(A, B) = |A ∩ B| / |A ∪ B|
```

来源稳定性先对同一 Prompt 的每对 Probe 算 Jaccard，再对 Pair 求平均；最后对所有 Prompt 的分数再求平均。所以它衡量的是“同一问题重复提问时，来源域名集合有多稳定”，不是 URL 级别的稳定性，也不是排序稳定性。

### 6.1 哪些指标用“成功 Probe”作分母

提及率、首位提及率、官网检索可见度、来源出现率都用成功 Probe 作分母。`error` 和 `empty` 不进入这些比例，否则失败率会伪装成“没被提及”。

但另外几类指标的分母不同：

- 平均位次：只在有品牌 Mention 的 Probe 里平均；
- 平均榜单位次：只在解析出 `listPosition` 的 Mention 里平均；
- 来源次数占比：分母是所有来源 occurrence；
- SoV：分母是所有 Target 的“有提及 Probe 数”之和；同一个 Probe 提到多个 Target 会分别计入，所以分母可能大于成功 Probe 数；
- 来源稳定性：分母是同一 Prompt 的成功 Probe 对；
- Answer Link 重合率：分母是所有 Answer Link。

看指标时先确认分母，比看小数点更重要。

### 6.2 费用估算

```text
cost =
  inputTokens  / 1,000,000 × inputPerMillion +
  outputTokens / 1,000,000 × outputPerMillion +
  webSearchRequests × searchPerCall
```

价格来自 `MODEL_OPTIONS`，按 DeepSeek 峰值价估算。搜索失败但产生请求时，计费仍以供应商账单为准；这里的数字只用于运行前预估。

## 7. 仪表盘洞察是怎么来的

仪表盘上的“关键发现”不是另一次 LLM 调用，而是固定规则。`buildInsights()` 按顺序检查：

| 条件 | 结果 |
| --- | --- |
| 没有成功 Probe | 提示先运行一个批次 |
| 通用词有成功 Probe，但提及数为 0 | “通用词没有被提及” |
| 品牌词有成功 Probe，且提及数 > 0 | “品牌词能被识别” |
| 没有任何自有来源 | “官网未进入检索来源” |
| 存在 Top 来源 | 展示来源平台、出现率、平均位次和来源次数 |
| 来源稳定性 < 0.4 | “来源稳定性偏低” |
| 有新增或流失域名 | “来源发生变化” |
| 提及率 ≥ 0.8 | “品牌提及率很高” |
| 提及率 < 0.2 | “品牌提及率偏低” |

最后按标题去重，最多保留 5 条。规则是确定性的，方便复现；它们只是提示，不是因果结论。

## 8. 本地存储、示例数据与导出

### 8.1 IndexedDB

数据层用 Dexie，数据库名 `geo-probe`，当前 schema 版本为 1：

| 表 | 主键/索引 | 内容 |
| --- | --- | --- |
| `projects` | `id`, `updatedAt` | 项目、品牌、竞品 |
| `prompts` | `id`, `projectId`, `createdAt`, `updatedAt` | 提示词 |
| `runs` | `id`, `projectId`, `createdAt`, `status` | 批次和快照 |
| `probes` | `id`, `runId`, `projectId`, `promptId`, `status`, `createdAt` | 每次探测的完整结果 |
| `settings` | `key` | 应用设置、示例数据标记 |

页面通过 `dexie-react-hooks` 的 `useLiveQuery` 订阅查询结果。Probe 写入后，仪表盘和批次详情会自动刷新，不需要手动重新加载。

API Key **不在 IndexedDB 里**：

- 默认存 `localStorage`，关闭浏览器后仍在；
- 选择“仅本次会话”时存 `sessionStorage`；
- 两者都没有时，如果设置了自定义 API 地址，可以走代理模式。

### 8.2 示例数据

首次访问时，应用会尝试加载 `public/demo/demo-data.json`，然后把它种入 IndexedDB。逻辑在 `ensureDemoSeed()`：

1. 如果用户之前明确删过示例数据，跳过；
2. 如果已经存在 `isDemo` 项目，直接复用；
3. 如果已经种过，跳过；
4. 否则 `fetch` 示例 JSON 并写入。

示例 JSON 保存的是原始结果（回答、搜索词、来源、usage 等），不保存分析后的 mention 和来源分类。种入时会调用与真实探测**相同的分析函数**重新计算 mention、source、list position 和 answer link，避免示例数据和真实数据出现两套口径。

`restoreDemo()` 可以恢复示例数据；`deleteDemo()` 会删除示例项目并打上标记，避免下次刷新又自动出现。

### 8.3 导出

导出支持以下格式：

| 格式 | 内容 |
| --- | --- |
| 全量 JSON | 所有 Project、Prompt、Run、Probe，适合备份和迁移 |
| 单批次 JSON | 一个 Run 及其 Probe、Project、Prompt |
| Probe CSV | 每行一个 Probe：状态、提及、位次、来源数、token、延迟、回答全文 |
| Source CSV | 每行一个 occurrence：搜索词、位次、标题、URL、域名、平台、渠道、归属 |
| Markdown 报告 | 核心指标、Prompt 表现、Top 来源、来源变化和免责声明 |

设置页也支持导入全量 JSON：按 ID 合并 Project、Prompt、Run 和 Probe，同 ID 记录会被覆盖。导出内容包含完整回答和第三方来源信息，可能含个人信息或敏感内容；分享前应自行检查。**API Key 永远不会进入导出。** 设置本身也不在导出包里。

## 9. 隐私、边界与已知限制

### 9.1 隐私模型

- 应用是 Next.js 静态导出，没有后端、没有遥测、没有第三方统计脚本。
- 浏览器直接请求 DeepSeek；配置自定义代理时请求经过代理，需要自行评估代理可信度。
- API Key 以明文存在浏览器存储里，因此项目不加载第三方脚本，并用 `rehype-sanitize` 清洗模型返回的 Markdown，降低 XSS 风险。
- 项目、Prompt、回答和来源都在当前 origin 的 IndexedDB 里。换浏览器、换设备、清站点数据都会看到不同或空的数据。
- 容器/静态托管只负责发文件，不保存用户数据；要留存请使用应用内导出。

### 9.2 结果边界

- **来源不是引用。** `web_search_tool_result` 只说明搜索工具返回了这些网页，不说明模型逐句使用了它们。
- **首位不是全场第一。** 它只统计已追踪的 Target；回答里可能先提到未追踪公司。
- **提及不是推荐。** 词面匹配不区分正面、负面、否定或比较语境。
- **榜单是启发式。** 只对结构化列表/表格有效，可能漏掉散文式推荐。
- **结果会波动。** 同一问题多次提问答案可能不同；默认重复 3 次就是为了看波动，而不是追求单次确定性。
- **来源可能失效。** title/URL 由搜索工具返回，可能缺失、过期、被墙或 404；本项目不抓取正文。
- **平台分类是静态规则。** 未收录的站点会落到“其他”，不影响来源计数，但会影响渠道分布。
- **费用是估算。** 模型价格和搜索单价会变化，实际以 DeepSeek 账单为准。
- **模型能力有差异。** 默认 Flash，遇到搜索异常可切 Pro；DeepSeek 文档对 `web_search` 的模型支持说明可能滞后于实测。
- **CORS 是外部依赖。** 浏览器直连依赖 DeepSeek 允许跨域；未来如果变化，需要自建代理。
- **代理模式的 UI 限制。** 启动新批次时可以只填代理地址、不填 Key；批次详情里的“继续运行”和“重试失败项”目前仍要求存在 Key。

### 9.3 数据版本

Run 里保存了 `appVersion` 和 `schemaVersion`。修改 IndexedDB 表结构时，应新增 Dexie version 并迁移，而不是修改旧 version；同时同步 `SCHEMA_VERSION`。导出的 JSON 带 `version` 字段，便于未来做导入兼容。

## 10. 代码地图与调试入口

| 路径 | 负责什么 |
| --- | --- |
| `lib/runner.ts` | 建 Run、展开任务、并发、重试、取消、补跑、重试失败项 |
| `lib/providers/deepseek.ts` | Anthropic 兼容请求、工具调用解析、错误映射、Key 测试 |
| `lib/analysis/mentions.ts` | 别名匹配、上下文、推荐榜解析、榜单位次回填 |
| `lib/analysis/sources.ts` | URL 规范化、域名解析、来源分类、Answer Link 提取 |
| `lib/analysis/metrics.ts` | 所有指标、对比、洞察规则、费用估算 |
| `lib/db/` | Dexie schema、仓储函数、设置读写 |
| `lib/demo/seed.ts` | 示例数据加载、种入、恢复、删除 |
| `lib/export/` | JSON / CSV / Markdown 导出 |
| `components/prose-answer.tsx` | 回答 Markdown 渲染与 sanitize |
| `lib/analysis/*.test.ts` | 提及、来源、指标的单元测试 |

调试时可以从这几个入口入手：

1. **看原始数据**：浏览器 DevTools → Application → IndexedDB → `geo-probe` → `probes`。每条 Probe 都带 `answer`、`queries`、`sources`、`mentions`、`listItems`、`answerLinks`。
2. **看批次详情**：批次页的 Probe 抽屉会展示回答、搜索词、来源和匹配结果。
3. **跑单测**：

   ```bash
   pnpm test lib/analysis/mentions.test.ts
   pnpm test lib/analysis/sources.test.ts
   pnpm test lib/analysis/metrics.test.ts
   ```

4. **重新生成示例数据**：

   ```bash
   pnpm demo:generate
   ```

   这会真实调用 DeepSeek，约 30 次探测。生成后要检查电话、邮箱、身份证、法定代表人等个人信息，再提交。

5. **检查静态产物**：`pnpm build` 后看 `out/`；页面数据全部在客户端，构建阶段不会调用 DeepSeek。

---

相关文档：

- [`CONTEXT.md`](../CONTEXT.md)：术语和对象关系
- [`README.md`](../README.md)：安装、部署、指标速查
- [`docs/adr/0001-static-first-byok.md`](adr/0001-static-first-byok.md)：为什么纯静态 + BYOK
- [`docs/adr/0002-deepseek-anthropic-web-search.md`](adr/0002-deepseek-anthropic-web-search.md)：为什么用 Anthropic 端点 + 服务端搜索
- [`docs/adr/0003-sources-not-citations.md`](adr/0003-sources-not-citations.md)：为什么来源和引用分开建模
