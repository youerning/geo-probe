type Env = {
  DEEPSEEK_API_KEY: string;
  ALLOWED_ORIGIN?: string;
};

const UPSTREAM = "https://api.deepseek.com/anthropic/v1/messages";

function corsHeaders(env: Env): Headers {
  const headers = new Headers();
  headers.set("access-control-allow-origin", env.ALLOWED_ORIGIN || "*");
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set(
    "access-control-allow-headers",
    "content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
  );
  headers.set("access-control-max-age", "86400");
  headers.set("vary", "origin");
  return headers;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/anthropic/v1/messages") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(env) });
    }

    if (!env.DEEPSEEK_API_KEY) {
      return new Response("Proxy is missing DEEPSEEK_API_KEY", {
        status: 500,
        headers: corsHeaders(env),
      });
    }

    const body = await request.text();
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": env.DEEPSEEK_API_KEY,
      },
      body,
    });

    const headers = corsHeaders(env);
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};

export default worker;
