# AGENTS.md

GEO Probe：纯静态、本地优先的 GEO 品牌提及检测工具。Next.js 16 / React 19 / TypeScript / Tailwind 4 / Dexie。

## 常用命令

- 包管理只用 `pnpm`（仓库有 `pnpm-lock.yaml` 和 `packageManager`）。
- `pnpm dev` — 开发；LAN 访问见下方 `allowedDevOrigins`。
- `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` — 与 CI 顺序一致。
- `pnpm test lib/analysis/mentions.test.ts` — 跑单个测试文件。
- `pnpm preview` — 预览静态导出结果（`pnpm dlx serve out`）。
- `pnpm demo:generate` — 重新生成 `public/demo/demo-data.json`；读取 `.env` 的 `DEEPSEEK_API_KEY`，约 30 次真实调用、$0.3。
- `docker build -t geo-probe:dev .` → `docker run --rm -p 8080:80 geo-probe:dev` — 验证镜像（nginx 托管 `out/`）。

## 架构入口

- `app/`：静态导出的页面；所有数据页都是 client component。
- `lib/analysis/`：提及匹配、来源规范化、指标计算。改这里必须跑测试。
- `lib/providers/deepseek.ts`：唯一 provider；Anthropic 兼容端点 + `web_search_20250305`。
- `lib/runner.ts`：批次执行、重试、取消/恢复。
- `lib/db/`：Dexie / IndexedDB；没有后端或数据库服务。
- `lib/demo/seed.ts` + `public/demo/demo-data.json`：首次访问自动种入示例数据。
- `README.md` 用户文档；`CONTEXT.md` 术语表；`docs/adr/` 决策记录。

## 不能破坏的约束

- 纯静态：`output: "export"`。不要加动态 Route Handler、Server Actions、依赖 Request 的逻辑。
- 详情页用 query params，不用动态路由段；`useSearchParams` 必须包在 `<Suspense>` 里（参考 `app/runs/page.tsx`）。
- `trailingSlash: true`：手写链接/`router.push` 必须带尾斜杠（如 `/runs/?run=...`），否则静态托管刷新会 404。
- 无后端、无遥测、无第三方统计。API Key 只存在浏览器 localStorage/sessionStorage；不要提交 `.env`，不要写进导出、日志或示例数据。
- `.env` 只给 `pnpm demo:generate` 用；应用本身不读它。线上是 BYOK，用户在设置里填 Key。
- 代理模式：`customApiBase` 非空时允许空 Key；不要恢复“必须有 Key”的硬校验。
- “引用”在本项目 = 品牌提及（Mention）。必须区分 Mention / Retrieved Source / Answer Link；不要把检索来源说成引用来源。
- DeepSeek OpenAI Responses 端点拿不到来源 URL，不要换回去。Anthropic 端点默认 `deepseek-v4-flash`，保留 `deepseek-v4-pro` 兜底。
- 示例数据是真实 AI 回答快照，含公开价格和行业评论，有免责声明；不要默认当成脏数据清理。重新生成后必须检查电话、邮箱、身份证、法定代表人等 PII 再提交。
- 不要提交 `out/`、`.next/`、`.env`、Playwright 快照。

## 容易踩的坑

- UI 是 shadcn base-nova + **Base UI**（不是 Radix）：`DropdownMenuLabel` 必须放在 `DropdownMenuGroup` 内，否则运行时报 `MenuGroupContext is missing`。
- LAN 访问 `next dev` 时，IP 必须在 `next.config.ts` 的 `allowedDevOrigins` 里，或用 `ALLOWED_DEV_ORIGINS` 覆盖；改后必须重启 dev server。否则客户端 hydration 不启动，页面会卡在“正在准备本地数据”。
- 竞品行允许只写名字（没有 `|`）；`splitList` 必须接受 `undefined/null`，否则新建项目会报 `reading 'split'`。
- ESLint 的 `react-hooks/set-state-in-effect` 是有意关闭的（客户端从 IndexedDB/localStorage 水合），不要为了消警告盲目重构。
- 用 Playwright 截 README 图时优先用 viewport screenshot；full-page 有时会丢 Recharts SVG 柱状图。
- 站点 URL/版本常量在 `lib/config.ts`；域名还硬编码在 `app/layout.tsx`、`app/sitemap.ts`、`public/robots.txt`、README，换域名时要一起改。
- `APP_VERSION` 在 `lib/config.ts`，和 `package.json` 的 version 各有一份，发版时一起改。
- 改 IndexedDB 表结构时用 Dexie 新 version，别改旧 version；同步 `SCHEMA_VERSION`。
- 示例数据通过 `fetch` 加载，不要 `import` 进客户端 bundle。
- 改 `Dockerfile` / `docker/nginx.conf` 后必须重新 `docker build` 并验证：nginx 的 `add_header` 只要出现在 location 里就会覆盖 server 级安全头（所以缓存用 `expires`）；`absolute_redirect off` 不能删，否则 `-p 8080:80` 时 `/runs` → `/runs/` 的 301 会丢掉端口。
- `.env` 必须在 `.dockerignore` 里；镜像内不得出现任何 Key（可用 `docker run --rm --entrypoint sh <img> -c 'grep -rl sk- /usr/share/nginx/html'` 检查）。
- Docker 镜像里的 nginx 配置、静态产物由 `docker/nginx.conf` 和 `out/` 决定；改安全头时要同时改 `public/_headers`、`vercel.json`，三处保持一致。

## 部署

- Cloudflare Workers（静态资源）是当前部署：`wrangler.jsonc` 的 `assets.directory` 指向 `out`；CF Build command `pnpm build`，Deploy command `npx wrangler deploy`。
- Cloudflare Pages 仍可用：build `pnpm build`，output `out`，Node 22；`public/_headers` 生效。
- 禁止对纯静态导出运行 `@opennextjs/cloudflare migrate`、引入 `open-next.config.ts` 或把 `output` 改成 `standalone`；项目不会生成 `.next/standalone`，OpenNext 会报 `pages-manifest.json` ENOENT。
- GitHub Pages workflow 是手动触发；它会把 `NEXT_PUBLIC_BASE_PATH` 设为仓库名。
- `NEXT_PUBLIC_BASE_PATH` 也会拼到示例数据 URL；改 basePath 后本地和 Workers/Pages 都要验证。
- Docker 镜像 `youerning/geo-probe`（备用 `ghcr.io/youerning/geo-probe`）由 `.github/workflows/docker.yml` 在 `main` 和 `v*` tag 上双架构发布；运行时只是 nginx + `out/`，`docker/nginx.conf` 负责 trailingSlash、404 和安全头。
- 本地 `docker push` 到 Docker Hub 常被网络 reset，发布以 GitHub Actions 为准（本机能 pull/build/run）。

## 发版

版本号手工维护，三处必须同步：`package.json` 的 `version`、`lib/config.ts` 的 `APP_VERSION`；改 IndexedDB 表结构时再加 `SCHEMA_VERSION` 和 Dexie 新 version。

语义化版本：修 bug → patch，新功能 → minor，破坏兼容 → major。0.x 阶段允许 minor 带破坏性变更，但要在 README 写清楚。

1. 本地全绿：`pnpm lint && pnpm typecheck && pnpm test && pnpm build`。
2. 提交并推 `main`：`git commit -m "chore(release): vX.Y.Z"` → `git push origin main`。产出 `latest`、`edge`、`sha-xxxxxxx`。
3. 打 annotated tag 并推送：`git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`。产出 `X.Y.Z`、`X.Y`、`latest`；Docker Hub 和 GHCR 各一套，都是 `linux/amd64` + `linux/arm64`。
4. 等 `Docker` workflow 变绿（约 2–3 分钟）再验证：

```bash
docker pull youerning/geo-probe:X.Y.Z
docker pull ghcr.io/youerning/geo-probe:X.Y.Z    # 匿名也应成功
docker run --rm -p 8080:80 youerning/geo-probe:X.Y.Z
curl -sI http://127.0.0.1:8080/ | grep -i 'content-security-policy'
```

- 不要在本地 `docker push`：本机到 `registry-1.docker.io` 会被 reset，发布只走 Actions。
- 只有 `X.Y.Z` 这类不可变标签可信；`latest` 跟 `main` 走，未打 tag 的提交也会覆盖它。
- `v*` tag 发了就别删了重打，同名版本内容必须一致；发错了就发下一个 patch。
- 纯文档改动不触发镜像构建（workflow 里 `paths-ignore` 了 `**.md`、`docs/**`、`ci.yml`），tag push 不受此限制。
- GHCR 包必须保持 public，它是 Docker Hub 拉不动时的备用源。
