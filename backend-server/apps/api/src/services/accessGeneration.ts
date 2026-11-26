export interface AccessClaims {
  sub: string;
  sid: string;
  tokenVersion?: number;
  expiresAt?: number;
}

export interface AccessAccount {
  tokenVersion?: number;
  isBlocked?: boolean;
  moderationReason?: string;
  suspendedUntil?: Date;
}

export interface AccessSession {
  tokenVersion?: number | null;
}

export type ReadAccessContext<Account extends AccessAccount = AccessAccount, Session extends AccessSession = AccessSession> =
  (claims: AccessClaims) => Promise<{ user: Account | null; session: Session | null; invalidate?: () => void }>;

export function matchesAccessGeneration(claims: AccessClaims, user: AccessAccount, session: AccessSession) {
  return (session.tokenVersion ?? claims.tokenVersion) === claims.tokenVersion &&
    (claims.tokenVersion === undefined || user.tokenVersion === claims.tokenVersion);
}
