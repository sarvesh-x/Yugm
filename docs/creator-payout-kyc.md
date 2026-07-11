# Creator Payout KYC

Creator Payout KYC is required only for creators/hosts who want to withdraw real money earned from gifts.

User-facing name: **Creator Payout Verification**

User-facing copy: **Required only when you withdraw real money earned from gifts.**

Do not show Creator Payout KYC during signup. Do not use it for dating/social verified badges. Normal users should never be forced into payout KYC.

## Scope

Creator Payout KYC may collect payout-specific identity and payment details:

- Legal full name
- Date of birth
- PAN
- UPI ID
- Bank account details
- Payout declarations

## Security

- Raw PAN, UPI, and bank account values are encrypted at rest.
- Public/user responses expose only masked values such as PAN last four, UPI masked ID, and bank last four.
- Admin access is limited to finance/admin roles.
- Raw PAN, UPI, and bank account values are never returned to browser or mobile clients, including finance clients.
- `creator_kyc.sensitive.read` permits finance staff to access the most detailed masked payout record; it does not expose decrypted identifiers.
- Every list, view, and action on Creator Payout KYC writes an admin audit log.
- Moderators and content reviewers must not access payout identity or payment fields.

## API

- `GET /api/creator/payout-kyc`
- `POST /api/creator/payout-kyc/submit`
- `PATCH /api/creator/payout-kyc`
- `GET /api/creator/payout-kyc/status`

Admin finance routes:

- `GET /api/admin/creator-kyc`
- `GET /api/admin/creator-kyc/:userId`
- `POST /api/admin/creator-kyc/:userId/approve`
- `POST /api/admin/creator-kyc/:userId/reject`
- `POST /api/admin/creator-kyc/:userId/request-retry`
- `POST /api/admin/creator-kyc/:userId/freeze-payout`
- `POST /api/admin/creator-kyc/:userId/enable-payout`
