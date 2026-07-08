const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const TOKEN = process.env.LOAD_TEST_TOKEN ?? "";
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY ?? 50);
const DURATION_SECONDS = Number(process.env.LOAD_TEST_SECONDS ?? 30);

const endpoints = [
  { method: "GET", path: "/health", authRequired: false },
  { method: "GET", path: "/api/rooms/trending", authRequired: false },
  { method: "GET", path: "/api/rooms?type=VOICE", authRequired: false },
  { method: "GET", path: "/api/games/leaderboard?gameId=vibe_tap", authRequired: true },
  { method: "GET", path: "/api/games/catalog", authRequired: true }
].filter((item) => !item.authRequired || TOKEN);

const deadline = Date.now() + DURATION_SECONDS * 1000;
const latencies = [];
let ok = 0;
let failed = 0;

async function hit(endpoint) {
  const start = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
      method: endpoint.method,
      headers: endpoint.authRequired ? { Authorization: `Bearer ${TOKEN}` } : undefined
    });
    await response.arrayBuffer();
    if (response.ok) ok++;
    else failed++;
  } catch {
    failed++;
  } finally {
    latencies.push(performance.now() - start);
  }
}

async function worker(id) {
  while (Date.now() < deadline) {
    await hit(endpoints[id % endpoints.length]);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, index) => worker(index)));

latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;
const total = ok + failed;

console.log(JSON.stringify({
  apiBaseUrl: API_BASE_URL,
  concurrency: CONCURRENCY,
  durationSeconds: DURATION_SECONDS,
  total,
  ok,
  failed,
  requestsPerSecond: Number((total / DURATION_SECONDS).toFixed(2)),
  latencyMs: {
    p50: Number(percentile(0.5).toFixed(1)),
    p95: Number(percentile(0.95).toFixed(1)),
    p99: Number(percentile(0.99).toFixed(1))
  }
}, null, 2));
