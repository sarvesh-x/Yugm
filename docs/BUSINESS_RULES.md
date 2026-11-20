# Business rules and security boundaries

This is a map to existing authoritative code/docs. Treat server validation and persisted state as authoritative; confirm current source before changing a rule.

- **Wallet and purchases:** balances are server-owned and ledger-backed. See `docs/wallet-ledger.md`, `docs/withdrawals.md`, `docs/payout-review.md`, and backend wallet/purchase services. Review the current transaction and replay findings in `docs/production/current-progress.md`.
- **Trust versus payout KYC:** Yugm Trust Verification serves user safety/credibility. Creator Payout KYC applies to real-money withdrawals; the two are separate. See `docs/trust-verification.md` and `docs/creator-payout-kyc.md`.
- **Permissions and moderation:** consult `docs/permissions.md`, `docs/moderation-workflow.md`, and `docs/admin-system.md`; authentication alone does not prove resource authorization.
- **Relationships:** see `docs/bonds.md` and the bond routes/services/shared rules. Keep eligibility, capacity, and transitions server-authoritative.
- **PK:** see `docs/pk-battle-architecture.md`; scores/rewards and settlement require server authority.
- **Privacy and deletion:** see `docs/privacy-policy.md`, `docs/data-deletion.md`, and `docs/biometric-data-handling.md`.
- **Authentication/profile setup:** a signed-out cold start repeats onboarding until the user authenticates; no intro-completion flag is persisted. Successful auth routes from the backend session/profile snapshot. **Email/password accounts must be verified before account creation/use** (server rejects unverified password-provider tokens; client requires verification before completing backend session exchange). Profile setup exits only when the server returns `profileCompleted=true`; the shared server rule and locked completion contract (including required identity/profile fields and terms acceptance as implemented) apply, while a persisted completion timestamp remains authoritative for legacy profiles. See [auth-flow audit](features/auth-flow-audit.md).

Do not invent product eligibility or consent behavior. The production finding register records unresolved authorization, transaction, socket, event, and call policies. Record unresolved choices there or in the scoped task and seek product confirmation when code cannot establish the answer.
