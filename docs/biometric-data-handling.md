# Biometric Data Handling

Yugm Trust Verification uses face, liveness, and voice evidence only for platform trust, fake-profile prevention, dating safety, host credibility, and verified badges.

## Principles

- Use the user-facing name **Yugm Trust Verification**.
- Do not call this flow KYC.
- Collect consent before review submission.
- Keep biometric verification separate from Creator Payout KYC.
- Store media through the upload/storage pipeline and submit URLs to verification APIs.
- Limit media review to admins with `trust_verification.media.read`.
- General trust-review access exposes submission counts only. Media URLs and provider evidence require `trust_verification.media.read`, and detail access is audit-logged.
- Retain provider responses only when needed for review, fraud defense, and safety records.

## Consent

The backend records `consentVersion` and `consentAcceptedAt` on `trust_verifications`. The current version is `trust-verification-v1`.

## Review

Trust review can be automated, manual, or mixed. Approval enables the verified badge and creator trust flag. Rejection or suspension disables both.
