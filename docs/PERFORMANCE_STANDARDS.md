# Performance standards

- Measure before optimizing. Bound list pagination, media sizes, background work, retries, caches, and user-visible waiting states.
- Avoid unbounded per-resource labels, work queues, collections, or retry loops. Keep cleanup and lifecycle ownership explicit.
- For Android, inspect module dependencies and large Compose/Kotlin hot paths before builds. Follow the [build performance audit](android-build-performance-audit.md); builds/lint can be expensive on the development machine.
- For backend changes, inspect query filters/projections/index needs and avoid unbounded scans or fanout. Verify required indexes and transaction topology in an isolated environment.
- Do not claim production latency, scale, or memory safety from source review alone. No workload baseline or production SLO is established by this page.
