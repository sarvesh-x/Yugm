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

Creator earnings are calculated from received gift transactions. Pending and approved requests are reported as locked; paid requests are reported as withdrawn; all three are deducted from available earnings. The settlement rate is shared by creator dashboards, eligibility responses, and finance records so displayed estimates match the final withdrawal amount.
