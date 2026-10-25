# syntax=docker/dockerfile:1

# ---------- 构建阶段 ----------
# 产物（HTML/JS/CSS）与 CPU 架构无关，所以固定用 BUILDPLATFORM 构建一次。
# 双架构发布时不会在 QEMU 模拟的 arm64 里再跑一遍 Next.js 构建。
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=1

WORKDIR /app

# corepack 直接读 package.json 的 packageManager 字段，pnpm 版本只维护一处
RUN corepack enable

# 先只拷依赖清单，锁文件没变时 install 这层可以复用缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# 默认部署在根路径。要反代到子路径时：
#   docker build --build-arg NEXT_PUBLIC_BASE_PATH=/geo .
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
# Next 的构建缓存放到 BuildKit cache mount，改源码但依赖没变时快很多
RUN --mount=type=cache,target=/app/.next/cache pnpm build

# ---------- 运行阶段 ----------
# 纯静态站点：只有 nginx 和 out/，没有 Node、没有后端、没有任何密钥。
FROM nginx:alpine AS runtime

LABEL org.opencontainers.image.title="GEO Probe" \
      org.opencontainers.image.description="开源的 GEO 品牌提及检测工具：批量向 DeepSeek 提问，检测 AI 回答里有没有出现你的品牌。纯静态、无后端、数据只存浏览器。" \
      org.opencontainers.image.source="https://github.com/youerning/geo-probe" \
      org.opencontainers.image.url="https://geo-probe.youerning.top" \
      org.opencontainers.image.licenses="MIT"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

# 沿用官方镜像的 CMD：nginx -g 'daemon off;'
