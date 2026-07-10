# Payout Review

Payout reviews are created when a creator requests a withdrawal. The review combines eligibility signals without merging Trust Verification and Creator Payout KYC into one system.

## Checks

Withdrawal request checks:

1. Creator earning balance is available.
2. Wallet/account is not restricted.
3. User is not blocked or actively suspended.
4. Yugm Trust Verification is verified and creator trust is enabled.
5. Creator Payout KYC is verified and payout status is enabled.
6. Fraud checks pass or route the request to manual review.
7. Requested creator earning amount is locked by a withdrawal request.
8. Finance/admin reviews and approves or rejects.
9. Payout is marked paid only after actual transfer.

## Clear Messages

- `Complete Yugm Trust Verification before withdrawing.`
- `Complete Creator Payout KYC before withdrawing.`
- `Your payout KYC is under review.`
- `Your wallet is temporarily restricted.`
- `Your withdrawal needs manual review.`

## Admin API

- `GET /api/admin/payout-reviews`
- `GET /api/admin/payout-reviews/:id`
- `POST /api/admin/payout-reviews/:id/approve`
- `POST /api/admin/payout-reviews/:id/reject`
- `POST /api/admin/payout-reviews/:id/manual-review`
- `POST /api/admin/payout-reviews/:id/mark-paid`
