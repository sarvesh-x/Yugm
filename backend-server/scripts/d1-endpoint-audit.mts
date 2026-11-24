import type { D1Database } from "@cloudflare/workers-types";
import type { Express } from "express";

// Build just the routing stacks. Never listen, initialize services, or load
// project .env files to discover route declarations.
process.env.NODE_ENV = "test";
process.env.YUGM_RUNTIME = "cloudflare";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/yugm_route_audit";
process.env.REDIS_URL = "";
process.env.STORAGE_DRIVER = "local";

const [{ createApp }, { createD1App }] = await Promise.all([
  import("../apps/api/src/app.js"),
  import("../apps/api/src/migration/d1App.js")
]);

interface Layer {
  regexp: RegExp & { fast_slash?: boolean };
  route?: { path: string | RegExp | Array<string | RegExp>; methods: Record<string, boolean> };
  handle: { stack?: Layer[] };
}

function routes(layers: Layer[], prefix = ""): string[] {
  const endpoints: string[] = [];
  for (const layer of layers) {
    if (layer.route) {
      for (const path of [layer.route.path].flat()) {
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (enabled) endpoints.push(`${method.toUpperCase()} ${prefix}${path === "/" && prefix ? "" : path}`);
        }
      }
    } else if (layer.handle.stack) {
      const mount = layer.regexp.fast_slash ? "" :
        layer.regexp.source.replaceAll("\\/", "/").match(/^\^(\/[a-z0-9/_-]+)\/\?\(\?=\/\|\$\)$/i)?.[1];
      if (mount === undefined) throw new Error(`Unsupported router mount: ${layer.regexp.source}`);
      endpoints.push(...routes(layer.handle.stack, prefix + mount.replace(/\/$/, "")));
    }
  }
  return endpoints;
}

function appRoutes(app: Express) {
  return routes((app as Express & { _router: { stack: Layer[] } })._router.stack);
}

function canonical(endpoint: string) {
  return endpoint.replace(/:[a-z_]\w*(?:\(([^)]*)\))?/gi, (_, constraint?: string) =>
    constraint && constraint !== "[a-fA-F0-9]{24}" ? `:parameter(${constraint})` : ":parameter");
}

// Fetch-level declarations are outside the Express stack in d1Api.ts and
// d1ProfileReads.ts. Implicit HEAD/OPTIONS behavior is outside this census.
const workerRoutes = [
  "GET /health", "GET /api/health", "GET /ready", "GET /api/ready",
  "GET /api/users/me", "GET /api/users/:id", "GET /api/users/public/:id",
  "GET /api/users/by-username/:username", "GET /api/assets/published/:assetId/:variant"
];

const noIo = new Proxy({}, { get() { throw new Error("Endpoint audit attempted binding I/O"); } });
const noRequest = () => { throw new Error("Endpoint audit attempted request handling"); };
const legacy = new Map(appRoutes(createApp()).map(endpoint => [canonical(endpoint), endpoint]));
const worker = new Map([
  ...appRoutes(createD1App(noIo as D1Database, {
    authLimiter: noRequest, authIdentifierLimiter: noRequest, refreshLimiter: noRequest
  }, {
    grantSecret: "fixture-only",
    buckets: {
      assets: noIo, "public-media": noIo, "private-media": noIo, originals: noIo, staging: noIo
    } as NonNullable<Parameters<typeof createD1App>[2]>["buckets"]
  })),
  ...workerRoutes
].map(endpoint => [canonical(endpoint), endpoint]));

const missing = [...legacy].filter(([key]) => !worker.has(key)).map(([, endpoint]) => endpoint).sort();
const matched = legacy.size - missing.length;
const grouped = new Map<string, { mounted: number; missing: number }>();
for (const [key, endpoint] of legacy) {
  const parts = endpoint.split(" ", 2)[1].split("/");
  const group = parts[1] === "api" ? "/api/" + (parts[2] ?? "") : "/" + (parts[1] ?? "");
  const row = grouped.get(group) ?? { mounted: 0, missing: 0 };
  if (worker.has(key)) row.mounted++;
  else row.missing++;
  grouped.set(group, row);
}

console.log("HTTP route inventory (mounts only, not behavioral verification)");
console.log(JSON.stringify({ legacy: legacy.size, d1: worker.size, matched, missing: missing.length }, null, 2));
console.table(Object.fromEntries([...grouped].sort(([a], [b]) => a.localeCompare(b))));
if (process.argv.includes("--missing")) {
  console.log("\nLegacy routes without a D1 mount:");
  missing.forEach(endpoint => console.log(endpoint));
}
