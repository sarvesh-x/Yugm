export const pkLifecycleStates = [
  "DRAFT", "INVITED", "INVITING", "MATCHMAKING", "PREPARING", "READY", "COUNTDOWN",
  "ACTIVE", "FINAL_CRUNCH", "OVERTIME", "FINALIZING", "COMPLETED", "CANCELLED", "ABORTED", "CLOSED",
  // Kept for records created by earlier app versions.
  "WAITING", "ENDED", "FORCE_ENDED", "DECLINED", "EXPIRED"
] as const;

export type PkLifecycleState = typeof pkLifecycleStates[number];

const transitions: Record<PkLifecycleState, readonly PkLifecycleState[]> = {
  DRAFT: ["INVITING", "MATCHMAKING", "PREPARING", "CANCELLED", "ABORTED"],
  INVITED: ["PREPARING", "DECLINED", "EXPIRED", "CANCELLED", "ABORTED"],
  INVITING: ["PREPARING", "CANCELLED", "ABORTED"],
  MATCHMAKING: ["INVITING", "PREPARING", "CANCELLED", "ABORTED"],
  PREPARING: ["READY", "CANCELLED", "ABORTED"],
  READY: ["COUNTDOWN", "CANCELLED", "ABORTED"],
  COUNTDOWN: ["ACTIVE", "CANCELLED", "ABORTED"],
  ACTIVE: ["FINAL_CRUNCH", "FINALIZING", "ABORTED"],
  FINAL_CRUNCH: ["FINALIZING", "ABORTED"],
  OVERTIME: ["FINALIZING", "ABORTED"],
  FINALIZING: ["COMPLETED", "ABORTED"],
  COMPLETED: ["CLOSED"],
  CANCELLED: ["CLOSED"],
  ABORTED: ["CLOSED"],
  CLOSED: [],
  WAITING: ["PREPARING", "ACTIVE", "CANCELLED", "ABORTED"],
  ENDED: ["CLOSED"],
  FORCE_ENDED: ["CLOSED"],
  DECLINED: ["CLOSED"],
  EXPIRED: ["CLOSED"]
};

export function canTransitionPk(from: string, to: string): boolean {
  return (transitions[from as PkLifecycleState] ?? []).includes(to as PkLifecycleState);
}

export function assertPkTransition(from: string, to: string): void {
  if (!canTransitionPk(from, to)) throw new Error(`Illegal PK state transition: ${from} -> ${to}`);
}
