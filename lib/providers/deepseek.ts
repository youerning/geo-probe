import {
  ANTHROPIC_VERSION,
  API_BASE_URL,
  DEFAULT_MODEL,
  SYSTEM_PROMPT,
} from "@/lib/config";
import type { ProbeUsage, RawSource, SearchQuery } from "@/lib/types";

export type DeepSeekConfig = {
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
  maxUses: number;
  systemPrompt: string;
  temperature?: number;
};

export type DeepSeekProbeResult = {
  answer: string;
  queries: SearchQuery[];
  sources: RawSource[];
  usage: ProbeUsage;
  requestId?: string;
  stopReason?: string | null;
  model: string;
};

export class DeepSeekApiError extends Error {
  status: number;
  retryable: boolean;
  code?: string;

  constructor(message: string, options: { status?: number; retryable?: boolean; code?: string } = {}) {
    super(message);
    this.name = "DeepSeekApiError";
    this.status = options.status ?? 0;
    this.retryable = options.retryable ?? false;
    this.code = options.code;
  }
}

type AnthropicBlock = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: { query?: string };
  tool_use_id?: string;
  content?: unknown;
};

type AnthropicResponse = {
  id?: string;
  model?: string;
  stop_reason?: string | null;
  content?: AnthropicBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
  error?: { message?: string; type?: string };
};

export function buildMessagesUrl(baseUrl?: string): string {
  const base = (baseUrl?.trim() || API_BASE_URL).replace(/\/+$/, "");
  if (base.endsWith("/anthropic/v1/messages")) return base;
  return `${base}/anthropic/v1/messages`;
}

function isInternalQuery(query: string): boolean {
  const value = query.trim();
  return !value || /^ws_call_id=/i.test(value) || /^call_[a-z0-9]+$/i.test(value);
}

function parseErrorBody(raw: string): { message: string; code?: string } {
  try {
    const data = JSON.parse(raw) as {
      error?: { message?: string; type?: string; code?: string };
      message?: string;
    };
    return {
      message: data.error?.message || data.message || raw.slice(0, 300),
      code: data.error?.type || data.error?.code,
    };
  } catch {
    return { message: raw.slice(0, 300) };
  }
}

function statusMessage(status: number, fallback: string): string {
  if (status === 401) return "API Key 无效或已过期。";
  if (status === 402) return "DeepSeek 账户余额不足。";
  if (status === 403) return "请求被拒绝（403）。";
  if (status === 429) return "请求过于频繁（429），请降低并发或稍后重试。";
  if (status >= 500) return `DeepSeek 服务异常（${status}），请稍后重试。`;
  return fallback;
}

export async function runDeepSeekProbe(params: {
  prompt: string;
  config: DeepSeekConfig;
  signal?: AbortSignal;
}): Promise<DeepSeekProbeResult> {
  const { prompt, config, signal } = params;

  if (!config.apiKey.trim() && !config.baseUrl?.trim()) {
    throw new DeepSeekApiError("请先在设置里填写 DeepSeek API Key，或配置代理地址。", {
      status: 401,
      retryable: false,
      code: "missing_api_key",
    });
  }

  const timeout = AbortSignal.timeout(180_000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const body = {
    model: config.model || DEFAULT_MODEL,
    max_tokens: config.maxTokens || 3000,
    system: config.systemPrompt || SYSTEM_PROMPT,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: config.maxUses || 5,
      },
    ],
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
    ...(typeof config.temperature === "number" ? { temperature: config.temperature } : {}),
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": ANTHROPIC_VERSION,
  };
  if (config.apiKey.trim()) headers["x-api-key"] = config.apiKey;

  let response: Response;
  try {
    response = await fetch(buildMessagesUrl(config.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: combinedSignal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError" && !signal?.aborted) {
      throw new DeepSeekApiError("请求超时（180 秒）。", { retryable: true, code: "timeout" });
    }
    if (signal?.aborted) throw error;
    throw new DeepSeekApiError(
      `网络请求失败：${error instanceof Error ? error.message : String(error)}`,
      { retryable: true, code: "network_error" },
    );
  }

  const raw = await response.text();

  if (!response.ok) {
    const parsed = parseErrorBody(raw);
    throw new DeepSeekApiError(statusMessage(response.status, parsed.message), {
      status: response.status,
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      code: parsed.code || `http_${response.status}`,
    });
  }

  let data: AnthropicResponse;
  try {
    data = JSON.parse(raw) as AnthropicResponse;
  } catch {
    throw new DeepSeekApiError("DeepSeek 返回了无法解析的响应。", {
      retryable: true,
      code: "invalid_json",
    });
  }

  const blocks = Array.isArray(data.content) ? data.content : [];

  const answer = blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const queryMap = new Map<string, string>();
  const queryErrors = new Map<string, string>();

  for (const block of blocks) {
    if (block.type !== "server_tool_use" || !block.id) continue;
    const query = block.input?.query?.trim();
    if (!query) continue;
    queryMap.set(block.id, query);
  }

  for (const block of blocks) {
    if (block.type !== "web_search_tool_result" || !block.tool_use_id) continue;
    if (Array.isArray(block.content)) continue;
    if (block.content && typeof block.content === "object") {
      const content = block.content as { error_code?: string; type?: string };
      queryErrors.set(
        block.tool_use_id,
        content.error_code || content.type || "web_search_failed",
      );
    }
  }

  const rawSources: RawSource[] = [];
  const resultCounts = new Map<string, number>();

  for (const block of blocks) {
    if (block.type !== "web_search_tool_result" || !block.tool_use_id) continue;
    if (!Array.isArray(block.content)) continue;

    const queryId = block.tool_use_id;
    const query = queryMap.get(queryId) ?? "";
    let rank = 0;

    for (const item of block.content as Array<{
      type?: string;
      title?: string;
      url?: string;
      page_age?: string | null;
    }>) {
      if (item?.type !== "web_search_result" || !item.url) continue;
      rank += 1;
      rawSources.push({
        queryId,
        query,
        rank,
        title: item.title || "",
        url: item.url,
        pageAge: item.page_age ?? null,
      });
    }

    resultCounts.set(queryId, rank);
  }

  const queries: SearchQuery[] = Array.from(queryMap.entries())
    .map(([id, query], index) => ({
      id,
      query: isInternalQuery(query) ? "内部检索" : query,
      order: index + 1,
      resultCount: resultCounts.get(id) ?? 0,
      error: queryErrors.get(id),
    }))
    .filter((query) => query.query !== "");

  const usage: ProbeUsage = {
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
    webSearchRequests: data.usage?.server_tool_use?.web_search_requests ?? queries.length,
  };

  return {
    answer,
    queries,
    sources: rawSources,
    usage,
    requestId: data.id,
    stopReason: data.stop_reason ?? null,
    model: data.model || config.model || DEFAULT_MODEL,
  };
}

export async function testDeepSeekKey(params: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  if (!params.apiKey.trim() && !params.baseUrl?.trim()) {
    clearTimeout(timeout);
    return { ok: false, latencyMs: 0, message: "请填写 API Key 或代理地址。" };
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": ANTHROPIC_VERSION,
  };
  if (params.apiKey.trim()) headers["x-api-key"] = params.apiKey;

  try {
    const response = await fetch(buildMessagesUrl(params.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: params.model || DEFAULT_MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const raw = await response.text();
      const parsed = parseErrorBody(raw);
      return {
        ok: false,
        latencyMs,
        message: statusMessage(response.status, parsed.message),
      };
    }

    return {
      ok: true,
      latencyMs,
      message: `连接成功，耗时 ${latencyMs}ms。`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
