# Architecture

This page is the compact map. The evidence-rich [production architecture audit](production/architecture.md) is the detailed source inventory and states its baseline and limits.

## Android

The Gradle project separates the app, core modules, and feature modules. Compose screens render UI state; app/feature ViewModels, repositories, shared API/data clients, navigation, sockets, cache, and media modules provide the surrounding behavior. Actual dependency boundaries and ownership vary by feature and must be inspected before refactoring.

## Backend

The API is a TypeScript Express modular monolith. `app.ts` composes middleware and routes; `index.ts` bootstraps database and runtime services; route modules validate/dispatch requests; services implement shared business operations; Mongoose models define persisted records. `packages/shared` contains client/server schemas and constants. Socket.IO, optional Redis/BullMQ, the admin app, and external providers are separate boundaries.

## Trust and state

Android/admin/provider/socket inputs and external provider responses are untrusted. The backend is authoritative for valuable state and persisted business transitions. MongoDB transaction support, deployed infrastructure, and live data state are not proven by source. Follow [API contracts](API_CONTRACTS.md), [realtime contracts](REALTIME_EVENTS.md), and [security rules](SECURITY_RULES.md).

## Source map

See [project context](PROJECT_CONTEXT.md), [navigation map](NAVIGATION_MAP.md), [state management](STATE_MANAGEMENT.md), and [database schema](DATABASE_SCHEMA.md). Do not infer full integration from a module, model, route, or screen existing.
