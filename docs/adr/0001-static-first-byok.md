# 静态优先 + BYOK

GEO Probe 选择纯静态导出（`output: "export"`）+ 访客自带 API Key（BYOK），不使用后端或数据库。这样任何人可以把 `out/` 部署到 Cloudflare Pages、Vercel、GitHub Pages 或任意静态服务器，数据只存在浏览器 IndexedDB，API Key 不经过项目服务器。

**Considered Options**:
- 服务端托管 Key：公开演示体验更好，但有成本/滥用风险，且不能部署到 GitHub Pages。
- 双形态（静态 + 可选代理）：保留静态默认，同时允许用户自己部署代理。项目采用这个方向，但代理不作为默认依赖。

**Consequences**:
- 公开演示站默认只能看示例数据；真实探测需要访客自己的 Key，或由站点所有者配置自定义代理地址。
- API Key 存在浏览器存储中，存在 XSS 风险，因此项目不加载第三方脚本、不接入分析统计，并对模型输出做 sanitize。
