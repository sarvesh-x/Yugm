/**
 * Migration-facing re-export of the runtime media access policy.
 *
 * The pure policy lives in `services/mediaAccessPolicy.ts` so the design harness
 * and runtime cannot drift. This module keeps the historical DCR-4 import path.
 */
export * from "../services/mediaAccessPolicy.js";
