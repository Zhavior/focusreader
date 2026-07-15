const DURATION_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

// Internal storage maps
let httpRequestsTotal = new Map();
let httpRequestDuration = new Map(); // key -> { count, sum, buckets: Map(le -> count) }
let ttsSynthesisDuration = new Map();
let ttsFailoverTotal = new Map();
let cacheHitsTotal = new Map();
let cacheMissesTotal = new Map();
let activeConnectionsCount = 0;

function normalizeRoute(url) {
  if (!url) return "unknown";
  // Strip query string
  const clean = url.split("?")[0];
  // Normalize UUIDs and alphanumeric IDs in path to :id for low cardinality
  return clean
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/[0-9a-zA-Z_-]{16,}/g, "/:id");
}

function makeKey(labels) {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
}

function recordHttpRequest(method = "GET", url = "/", statusCode = 200, durationMs = 0) {
  const route = normalizeRoute(url);
  const labels = { method: method.toUpperCase(), route, status_code: String(statusCode) };
  const key = makeKey(labels);

  // Increment counter
  const currCount = httpRequestsTotal.get(key) || 0;
  httpRequestsTotal.set(key, currCount + 1);

  // Record histogram
  let hist = httpRequestDuration.get(key);
  if (!hist) {
    const buckets = new Map();
    for (const b of DURATION_BUCKETS) buckets.set(b, 0);
    buckets.set("+Inf", 0);
    hist = { count: 0, sum: 0, buckets, labels };
    httpRequestDuration.set(key, hist);
  }

  hist.count += 1;
  hist.sum += durationMs;
  for (const b of DURATION_BUCKETS) {
    if (durationMs <= b) {
      hist.buckets.set(b, hist.buckets.get(b) + 1);
    }
  }
  hist.buckets.set("+Inf", hist.buckets.get("+Inf") + 1);
}

function recordTtsSynthesis(provider = "edge", voiceId = "en-US", status = "success", durationMs = 0) {
  const labels = { provider: String(provider), voice_id: String(voiceId), status: String(status) };
  const key = makeKey(labels);

  let hist = ttsSynthesisDuration.get(key);
  if (!hist) {
    const buckets = new Map();
    for (const b of DURATION_BUCKETS) buckets.set(b, 0);
    buckets.set("+Inf", 0);
    hist = { count: 0, sum: 0, buckets, labels };
    ttsSynthesisDuration.set(key, hist);
  }

  hist.count += 1;
  hist.sum += durationMs;
  for (const b of DURATION_BUCKETS) {
    if (durationMs <= b) {
      hist.buckets.set(b, hist.buckets.get(b) + 1);
    }
  }
  hist.buckets.set("+Inf", hist.buckets.get("+Inf") + 1);
}

function recordTtsFailover(fromProvider = "edge", toProvider = "local", reason = "error") {
  const labels = { from_provider: String(fromProvider), to_provider: String(toProvider), reason: String(reason) };
  const key = makeKey(labels);
  const curr = ttsFailoverTotal.get(key) || 0;
  ttsFailoverTotal.set(key, curr + 1);
}

function setActiveConnections(count) {
  activeConnectionsCount = Math.max(0, Number(count) || 0);
}

function recordCacheHit(cacheType = "audio") {
  const labels = { cache_type: String(cacheType) };
  const key = makeKey(labels);
  const curr = cacheHitsTotal.get(key) || 0;
  cacheHitsTotal.set(key, curr + 1);
}

function recordCacheMiss(cacheType = "audio") {
  const labels = { cache_type: String(cacheType) };
  const key = makeKey(labels);
  const curr = cacheMissesTotal.get(key) || 0;
  cacheMissesTotal.set(key, curr + 1);
}

function getCacheHitRatio(cacheType = "audio") {
  const labels = { cache_type: String(cacheType) };
  const key = makeKey(labels);
  const hits = cacheHitsTotal.get(key) || 0;
  const misses = cacheMissesTotal.get(key) || 0;
  const total = hits + misses;
  return total === 0 ? 0 : Number((hits / total).toFixed(4));
}

function getPrometheusMetrics() {
  const lines = [];

  // http_requests_total
  lines.push("# HELP http_requests_total Total number of HTTP requests processed.");
  lines.push("# TYPE http_requests_total counter");
  for (const [key, val] of httpRequestsTotal.entries()) {
    lines.push(`http_requests_total{${key}} ${val}`);
  }
  lines.push("");

  // http_request_duration_ms
  lines.push("# HELP http_request_duration_ms Histogram of HTTP request latencies in milliseconds.");
  lines.push("# TYPE http_request_duration_ms histogram");
  for (const hist of httpRequestDuration.values()) {
    const labelStr = makeKey(hist.labels);
    for (const [le, count] of hist.buckets.entries()) {
      lines.push(`http_request_duration_ms_bucket{${labelStr},le="${le}"} ${count}`);
    }
    lines.push(`http_request_duration_ms_sum{${labelStr}} ${hist.sum.toFixed(2)}`);
    lines.push(`http_request_duration_ms_count{${labelStr}} ${hist.count}`);
  }
  lines.push("");

  // tts_synthesis_duration_ms
  lines.push("# HELP tts_synthesis_duration_ms Histogram of audio synthesis duration across TTS engines.");
  lines.push("# TYPE tts_synthesis_duration_ms histogram");
  for (const hist of ttsSynthesisDuration.values()) {
    const labelStr = makeKey(hist.labels);
    for (const [le, count] of hist.buckets.entries()) {
      lines.push(`tts_synthesis_duration_ms_bucket{${labelStr},le="${le}"} ${count}`);
    }
    lines.push(`tts_synthesis_duration_ms_sum{${labelStr}} ${hist.sum.toFixed(2)}`);
    lines.push(`tts_synthesis_duration_ms_count{${labelStr}} ${hist.count}`);
  }
  lines.push("");

  // tts_failover_total
  lines.push("# HELP tts_failover_total Total number of TTS engine failovers triggered.");
  lines.push("# TYPE tts_failover_total counter");
  for (const [key, val] of ttsFailoverTotal.entries()) {
    lines.push(`tts_failover_total{${key}} ${val}`);
  }
  lines.push("");

  // active_connections
  lines.push("# HELP active_connections Current active WebSocket/HTTP connections.");
  lines.push("# TYPE active_connections gauge");
  lines.push(`active_connections ${activeConnectionsCount}`);
  lines.push("");

  // cache_hits_total
  lines.push("# HELP cache_hits_total Total number of CDN and local storage cache hits.");
  lines.push("# TYPE cache_hits_total counter");
  for (const [key, val] of cacheHitsTotal.entries()) {
    lines.push(`cache_hits_total{${key}} ${val}`);
  }
  lines.push("");

  // cache_misses_total
  lines.push("# HELP cache_misses_total Total number of CDN and local storage cache misses.");
  lines.push("# TYPE cache_misses_total counter");
  for (const [key, val] of cacheMissesTotal.entries()) {
    lines.push(`cache_misses_total{${key}} ${val}`);
  }
  lines.push("");

  return lines.join("\n");
}

function resetMetrics() {
  httpRequestsTotal.clear();
  httpRequestDuration.clear();
  ttsSynthesisDuration.clear();
  ttsFailoverTotal.clear();
  cacheHitsTotal.clear();
  cacheMissesTotal.clear();
  activeConnectionsCount = 0;
}

module.exports = {
  recordHttpRequest,
  recordTtsSynthesis,
  recordTtsFailover,
  setActiveConnections,
  recordCacheHit,
  recordCacheMiss,
  getCacheHitRatio,
  getPrometheusMetrics,
  resetMetrics,
  normalizeRoute,
};
