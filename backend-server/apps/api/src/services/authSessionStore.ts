import type { UserRole } from "@yugm/shared";

export interface AuthSessionAccount {
  id: string;
  role: UserRole;
  tokenVersion: number;
}

export interface RefreshSession {
  id: string;
  userId: string;
  familyId: string;
  tokenVersion?: number;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByHash: string | null;
}

export interface NewRefreshSession {
  refreshHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface AuthSessionStore {
  findAccount(userId: string): Promise<(AuthSessionAccount & { isBlocked: boolean }) | null>;
  findRefreshSession(refreshHash: string): Promise<RefreshSession | null>;
  issue(userId: string, familyId: string, session: NewRefreshSession, now: Date): Promise<{ id: string; tokenVersion: number } | null>;
  rotate(old: RefreshSession, tokenVersion: number, replacement: NewRefreshSession, now: Date): Promise<string | null>;
  revokeById(sessionId: string, now: Date): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  revokeAll(userId: string, now: Date): Promise<void>;
  logout(userId: string, refreshHash: string | undefined, now: Date, deviceToken?: string): Promise<void>;
}
