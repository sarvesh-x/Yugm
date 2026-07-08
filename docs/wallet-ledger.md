# Wallet Ledger Safety

Yugm wallet balances must only change through ledger services:

- `creditWallet`
- `debitWallet`

Admin adjustment route:

```text
POST /api/admin/wallet/users/:userId/adjust
```

Rules:

- Requires `wallet.adjust`.
- Requires amount and reason.
- Blocks adjustment when `UserSafetyStatus.isWalletFrozen` is true.
- Uses immutable `WalletTransaction` rows.
- Never directly edits balance from admin route code.
- Audit logs every adjustment.

Recommended production additions:

- Dual approval for large adjustments.
- Refund provider webhook reconciliation.
- Debt/fraud workflow when refunds exceed remaining balance.
- Withdrawal hold ledger model before enabling cash payouts.
