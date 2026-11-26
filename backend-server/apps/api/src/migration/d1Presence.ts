/**
 * Host-neutral presence port. Presence is ephemeral and never proves that an
 * authoritative write committed; D1 remains the source of truth for all durable
 * state. The default implementation keeps the documented empty/false shape when
 * no host adapter is injected.
 */
export interface D1PresencePort {
  getPresenceCount(): number | Promise<number>;
  isUserOnline(userId: string): boolean | Promise<boolean>;
  getOnlineUserIds(): Array<string> | Promise<Array<string>>;
  markOnline(userId: string): Promise<void> | void;
  markOffline(userId: string): Promise<void> | void;
  emitUser?(userId: string, event: string, payload: unknown): Promise<void> | void;
  disconnectUser?(userId: string): Promise<void> | void;
}

export const noD1Presence: D1PresencePort = {
  getPresenceCount: () => 0,
  isUserOnline: () => false,
  getOnlineUserIds: () => [],
  markOnline: () => {},
  markOffline: () => {}
};
