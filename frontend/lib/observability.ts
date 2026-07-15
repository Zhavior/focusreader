// Frontend Observability & W3C Distributed Tracing Bridge (Pillar 3)

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: string;
  traceparent: string;
}

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

function generateTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").padEnd(32, "0").slice(0, 32);
  }
  return Math.random().toString(16).substring(2, 18) + Math.random().toString(16).substring(2, 18);
}

function generateSpanId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Math.random().toString(16).substring(2, 18).slice(0, 16);
}

export function getOrCreateTraceContext(headers?: Headers | Record<string, string>): TraceContext {
  let traceparent = "";
  if (headers) {
    if (typeof (headers as Headers).get === "function") {
      traceparent = (headers as Headers).get("traceparent") || "";
    } else if (typeof headers === "object") {
      traceparent = (headers as Record<string, string>).traceparent || (headers as Record<string, string>).Traceparent || "";
    }
  }

  let traceId = "";
  let traceFlags = "01";

  if (traceparent) {
    const match = traceparent.trim().match(TRACEPARENT_REGEX);
    if (match && match[1] !== "00000000000000000000000000000000" && match[2] !== "0000000000000000") {
      traceId = match[1].toLowerCase();
      traceFlags = match[3].toLowerCase();
    }
  }

  if (!traceId) {
    traceId = generateTraceId();
  }

  const spanId = generateSpanId();
  const formatted = `00-${traceId}-${spanId}-${traceFlags}`;

  return {
    traceId,
    spanId,
    traceFlags,
    traceparent: formatted,
  };
}

export async function tracedFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const ctx = getOrCreateTraceContext(options.headers as any);
  const headers = new Headers(options.headers || {});
  headers.set("traceparent", ctx.traceparent);
  headers.set("x-trace-id", ctx.traceId);

  const start = Date.now();
  try {
    const response = await fetch(url, { ...options, headers });
    const dur = Date.now() - start;
    if (process.env.NODE_ENV !== "production") {
      console.info(`[tracedFetch] ${options.method || "GET"} ${url} - ${response.status} (${dur}ms) [traceId=${ctx.traceId}]`);
    }
    return response;
  } catch (err: any) {
    const dur = Date.now() - start;
    console.error(`[tracedFetch] ${options.method || "GET"} ${url} - ERROR (${dur}ms) [traceId=${ctx.traceId}]:`, err.message);
    throw err;
  }
}

export function captureException(err: any, context: Record<string, any> = {}): void {
  const traceCtx = getOrCreateTraceContext();
  const errorPayload = {
    timestamp: new Date().toISOString(),
    traceId: traceCtx.traceId,
    message: err?.message || String(err),
    stack: err?.stack || null,
    context,
  };
  console.error("[Observability] Captured Exception:", JSON.stringify(errorPayload, null, 2));
}

export function withTracing(
  handler: (req: Request, ctx: TraceContext) => Promise<Response>,
  routeName: string
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const traceCtx = getOrCreateTraceContext(req.headers);
    const start = Date.now();

    try {
      const response = await handler(req, traceCtx);
      const dur = Date.now() - start;
      response.headers.set("traceparent", traceCtx.traceparent);
      response.headers.set("x-trace-id", traceCtx.traceId);
      console.info(`[APITrace] ${req.method} ${routeName} - ${response.status} (${dur}ms) [traceId=${traceCtx.traceId}]`);
      return response;
    } catch (err: any) {
      const dur = Date.now() - start;
      captureException(err, { routeName, method: req.method, url: req.url, dur });
      return new Response(
        JSON.stringify({ error: "Internal Server Error", traceId: traceCtx.traceId }),
        { status: 500, headers: { "Content-Type": "application/json", traceparent: traceCtx.traceparent } }
      );
    }
  };
}
