# Yugm Trust Verification

Yugm Trust Verification is the platform trust system for normal users, dating trust, verified badges, fake-profile prevention, host credibility, and community safety.

User-facing name: **Yugm Trust Verification**

User-facing tagline: **Show people you're real.**

This flow is optional for normal users and must not be called KYC in user-facing screens. It does not collect PAN, UPI, or bank details.

## Flow

1. User signs up and creates a profile.
2. User optionally starts Yugm Trust Verification from profile/settings.
3. User accepts biometric/voice consent.
4. User submits face, liveness, and voice verification evidence.
5. Content review/admin reviews automated signals and media.
6. Approved users receive the verified badge.

## API

- `GET /api/trust-verification/me`
- `POST /api/trust-verification/start`
- `POST /api/trust-verification/consent`
- `GET /api/trust-verification/voice-prompt`
- `POST /api/trust-verification/face`
- `POST /api/trust-verification/voice`
- `POST /api/trust-verification/submit-review`
- `POST /api/trust-verification/retry`
- `GET /api/trust-verification/status`

## Admin Review

Trust Verification review is separate from Creator Payout KYC. `CONTENT_REVIEWER` can review and approve/reject Trust Verification, but cannot access payout identity or bank fields.
