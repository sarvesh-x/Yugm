# Withdrawals

Withdrawals are available only to creators/hosts with gift earnings. Normal users do not need Creator Payout KYC and should not see payout KYC unless they become creators/hosts or request withdrawal.

## Creator Flow

1. Creator receives gifts.
2. Creator opens earnings/withdrawal.
3. System checks Yugm Trust Verification.
4. System checks Creator Payout KYC.
5. System checks earning balance, wallet/account restrictions, reports, and fraud signals.
6. System creates a withdrawal request and payout review.
7. Finance/admin approves or rejects.
8. Payout is marked paid after the actual transfer.

## User APIs

- `GET /api/creator/withdrawals/eligibility`
- `POST /api/creator/withdrawals`
- `GET /api/creator/withdrawals`

## Accounting

The current MVP calculates creator earnings from received gift transactions and subtracts pending, approved, and paid withdrawal requests. Future ledger work can split purchasable coins and creator cash earnings into separate balances.
