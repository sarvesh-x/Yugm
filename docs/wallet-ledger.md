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
# Wallet, Earnings, And Payouts

Yugm keeps normal coin wallet activity separate from creator payout eligibility.

- Coin wallet: in-app purchases, gifts sent, cosmetics, VIP, and rewards.
- Creator earnings: received gift transactions that may become eligible for real-money withdrawal.
- Creator Payout KYC: required only for real-money withdrawal, not for dating/social verified badges.
- Yugm Trust Verification: used for platform trust and verified badges, not payout identity compliance.

The current withdrawal MVP calculates available creator earnings from received gifts minus pending, approved, and paid withdrawal locks. Future ledger work should split purchased coins, promotional coins, creator earnings, payout locks, and cash payout settlement into dedicated ledger accounts.
