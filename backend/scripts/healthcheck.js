#!/usr/bin/env node
/**
 * HyperFi TTS Backend — Automated Command-Line Health & Diagnostics Probe
 * Usage: node scripts/healthcheck.js [PORT=4000]
 */

const http = require("http");

const PORT = process.env.PORT || process.argv[2] || 4000;
const BASE_URL = `http://localhost:${PORT}`;

// ANSI color codes for rich terminal formatting
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function fetchEndpoint(path, options = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: options.method || "GET",
        headers: {
          traceparent: "00-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6-ecda4cd12e5fc1cf-01",
          ...options.headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            latencyMs: Date.now() - start,
          });
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        status: 0,
        error: err.message,
        latencyMs: Date.now() - start,
      });
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runHealthcheck() {
  console.log(`${COLORS.bold}${COLORS.cyan}==========================================================================");
  console.log(` HyperFi Production Health & Diagnostics Probe (` + `${BASE_URL}` + `)`);
  console.log(`==========================================================================${COLORS.reset}`);

  // 1. Liveness Probe (/health/live)
  process.stdout.write(`[1/4] Probing Liveness Endpoint (/health/live)... `);
  const liveRes = await fetchEndpoint("/health/live");
  if (liveRes.status === 200) {
    console.log(`${COLORS.green}OK${COLORS.reset} (${liveRes.latencyMs}ms)`);
  } else {
    console.log(`${COLORS.red}FAILED status=${liveRes.status} error=${liveRes.error || "unknown"}${COLORS.reset}`);
    process.exitCode = 1;
  }

  // 2. Readiness Probe (/health/ready)
  process.stdout.write(`[2/4] Probing Deep Readiness & SQLite/Cache (/health/ready)... `);
  const readyRes = await fetchEndpoint("/health/ready");
  if (readyRes.status === 200) {
    let data = {};
    try {
      data = JSON.parse(readyRes.body);
    } catch (e) {}
    console.log(
      `${COLORS.green}READY${COLORS.reset} (${readyRes.latencyMs}ms) | DB Status: ${COLORS.green}${data.checks?.database || "OK"}${COLORS.reset} | Cache Status: ${COLORS.green}${data.checks?.audioCache || "OK"}${COLORS.reset}`
    );
  } else {
    console.log(`${COLORS.red}NOT READY status=${readyRes.status}${COLORS.reset}`);
    process.exitCode = 1;
  }

  // 3. W3C Distributed Tracing Propagation Check
  process.stdout.write(`[3/4] Verifying W3C Distributed Trace Headers... `);
  const traceHeader = readyRes.headers?.["traceparent"] || readyRes.headers?.["x-trace-id"];
  if (traceHeader && traceHeader.includes("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")) {
    console.log(`${COLORS.green}VERIFIED${COLORS.reset} (traceparent preserved cleanly across middleware)`);
  } else if (traceHeader) {
    console.log(`${COLORS.green}GENERATED${COLORS.reset} (traceparent=${traceHeader})`);
  } else {
    console.log(`${COLORS.yellow}WARNING (No W3C trace header returned in response)${COLORS.reset}`);
  }

  // 4. Prometheus Metrics & SLA Probe (/metrics)
  process.stdout.write(`[4/4] Probing Prometheus Registry (/metrics)... `);
  const metricsRes = await fetchEndpoint("/metrics");
  if (metricsRes.status === 200 && metricsRes.body.includes("http_requests_total")) {
    console.log(`${COLORS.green}ACTIVE${COLORS.reset} (${metricsRes.latencyMs}ms, ${metricsRes.body.split("\n").length} metrics lines exported)`);
  } else {
    console.log(`${COLORS.red}FAILED to retrieve metrics registry${COLORS.reset}`);
    process.exitCode = 1;
  }

  console.log(`${COLORS.bold}${COLORS.cyan}==========================================================================${COLORS.reset}`);
  if (process.exitCode === 1) {
    console.log(`${COLORS.bold}${COLORS.red}Diagnostics finished with errors. Inspect logs above.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.bold}${COLORS.green}All systems operational and verified for high-availability traffic!${COLORS.reset}`);
  }
}

runHealthcheck();
