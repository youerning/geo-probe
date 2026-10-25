# Cloudflare Worker 代理示例

GEO Probe 默认是纯静态 + 访客自带 Key（BYOK）。如果你想在公开演示站上隐藏 Key，可以部署这个最小代理：

1. 安装并登录 wrangler：

   ```bash
   pnpm add -g wrangler
   wrangler login
   ```

2. 在本目录设置密钥：

   ```bash
   wrangler secret put DEEPSEEK_API_KEY
   ```

3. （推荐）限制来源域名。取消 `wrangler.toml` 里 `ALLOWED_ORIGIN` 的注释，改成你的站点域名。

4. 部署：

   ```bash
   wrangler deploy
   ```

5. 在 GEO Probe 的「设置 → 自定义 API 地址」里填入 Worker 地址，例如：

   ```
   https://geo-probe-proxy.your-name.workers.dev
   ```

   应用会请求 `{代理地址}/anthropic/v1/messages`。填了代理地址后，API Key 可以留空。

## 注意

- 这个示例是**开放代理**：任何知道地址的人都能消耗你的 DeepSeek 余额。公开使用前请加：
  - Cloudflare Access / 登录校验；
  - 基于 IP 或用户的速率限制；
  - 每日额度上限；
  - 只允许自己的站点域名（`ALLOWED_ORIGIN`）。
- 代理只转发请求，不存储回答、来源或 Key。
- 生产环境请把 `DEEPSEEK_API_KEY` 放在 Worker Secret 里，不要写进代码或 `wrangler.toml`。
