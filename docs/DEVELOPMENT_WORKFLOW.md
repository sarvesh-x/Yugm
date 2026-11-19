# Development and handoff workflow

1. Read root `AGENTS.md`, this index, and `CURRENT_TASK.md`; load relevant docs and inspect source.
2. Record the scope, affected user journeys/files, constraints, and acceptance criteria in the active task.
3. Check working-tree changes. Preserve unrelated user edits and avoid editing an already modified file unless the task requires it.
4. Trace dependencies and authoritative state. For a feature, follow UI → state holder → use case/service → API/realtime → database → emitted event → receiving client.
5. Implement one reviewable change. Follow existing module, route, service, contract, and theme boundaries.
6. Verify only the scoped behavior with an appropriate check; respect Android resource limits and isolated backend environment requirements.
7. Update relevant source-of-truth docs and progress with evidence, uncertainty, and checks run/not run.
8. If unfinished, write a dated handoff under `docs/handoffs/` and leave `CURRENT_TASK.md` with the exact next action.

Use focused branches and small commits when requested by the owner. Do not commit, push, deploy, migrate shared data, or publish an APK without explicit authorization. Do not restart from prior conversation assumptions; reconstruct context from this workflow and repository evidence.
