type RouteMetric = {
  count: number;
  errorCount: number;
  slowCount: number;
  totalMs: number;
  maxMs: number;
};

const startedAt = new Date();
const routes = new Map<string, RouteMetric>();

function routeKey(method: string, route: string) {
  return `${method.toUpperCase()} ${route}`;
}

export function recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number) {
  const key = routeKey(method, route);
  const metric = routes.get(key) ?? { count: 0, errorCount: 0, slowCount: 0, totalMs: 0, maxMs: 0 };
  metric.count += 1;
  metric.totalMs += durationMs;
  metric.maxMs = Math.max(metric.maxMs, durationMs);
  if (statusCode >= 500) metric.errorCount += 1;
  if (durationMs > 750) metric.slowCount += 1;
  routes.set(key, metric);
}

export function getMetricsSnapshot() {
  const topRoutes = [...routes.entries()]
    .map(([route, metric]) => ({
      route,
      count: metric.count,
      errorCount: metric.errorCount,
      slowCount: metric.slowCount,
      avgMs: Math.round(metric.totalMs / Math.max(metric.count, 1)),
      maxMs: metric.maxMs
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    routesTracked: routes.size,
    topRoutes
  };
}
