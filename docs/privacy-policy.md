# Privacy Policy for Yugm (Dating & Social App)

*Last Updated: November 15, 2026*

This Privacy Policy describes how **Yugm** ("we," "our," or "us") collects, uses, stores, and protects your personal information when you use our mobile application and related services (the "Service"). 

By creating an account or using Yugm, you agree to the collection and use of information in accordance with this policy.

---

## 1. Eligibility & Age Restriction (18+ Only)
Yugm is strictly intended for individuals who are **18 years of age or older**. We do not knowingly collect personal information from anyone under the age of 18. If we become aware that a user is under 18, we will immediately terminate their account and delete all associated data.

---

## 2. Information We Collect

### A. Information You Provide Directly
* **Account & Profile Data:** Name, date of birth/age, gender, sexual orientation/preferences, bio, interests, languages spoken, photos, and prompts.
* **Authentication Details:** Phone number, email address, or third-party login identifiers (e.g., Google Sign-In via Firebase Authentication).
* **Communications & User Content:** Text messages, room chat messages, audio/video streams during live sessions, and user reports/feedback.
* **Purchase & Transaction History:** Records of virtual currency (coins), gifts, or premium subscriptions purchased via Google Play Billing (note: we do not collect or store your raw credit card or bank details; all payments are processed securely by Google Play).

### B. Information Collected Automatically
* **Precise & Approximate Location Data:** With your explicit permission, we collect real-time GPS coordinates (latitude and longitude) to show nearby profiles, calculate distance, and enable location-based matching.
* **Device & Usage Data:** Device model, OS version, IP address, app crash logs (via Firebase Crashlytics), and Firebase Cloud Messaging (FCM) device tokens for push notifications.
* **Camera & Microphone Access:** Accessed only when you actively upload profile photos, join audio/video rooms, or initiate live WebRTC video calls.

---

## 3. How We Use Your Information
We use the collected data to:
* Create and manage your account and display your public profile to potential matches.
* Power real-time geo-spatial discovery, compatibility scoring, and matchmaking recommendations.
* Enable real-time text chat, live audio rooms, and WebRTC video calls.
* Process in-app purchases, manage wallet balances, and prevent fraudulent transactions.
* Moderate content, enforce our Community Guidelines, and investigate safety reports or abuse.
* Send essential service alerts, match notifications, and incoming call alerts via push notifications.

---

## 4. How We Share Your Information
We **do not sell** your personal data to third parties. We only share data in the following circumstances:
* **With Other Users:** Your public profile details (first name, age, photos, bio, approximate distance) are visible to other users on the platform.
* **Service Providers & Infrastructure:** We use trusted third-party infrastructure providers strictly to operate the app, including:
  * **Google Firebase** (Authentication, Push Notifications, Crash Analytics)
  * **Google Play Billing** (In-app purchase & subscription verification)
  * **Cloud Hosting & Media Servers** (Render, PostgreSQL/PostGIS, Redis, and WebRTC SFU servers for real-time audio/video routing)
* **Legal & Safety Compliance:** We may disclose information if required by law, court order, or to protect the safety, rights, and security of our users and the public.

---

## 5. Data Retention & Account Deletion Policy
* **Retention:** We retain your personal data only as long as your account remains active or as needed to provide the Service and comply with legal obligations.
* **How to Delete Your Account & Data:** You can permanently delete your account and associated personal data at any time by:
  1. Opening the **Yugm App** $\to$ **Settings** $\to$ **Account** $\to$ **Delete Account**.
  2. Or by submitting a deletion request via our web portal / email at: **`support@yugmapp.com`** *(replace with your support email)*.
* Upon deletion, your profile, photos, and match history are permanently removed from active servers within **30 days** (excluding minimal transaction records required by tax/financial regulations).

---

## 6. Security Measures
We implement industry-standard security safeguards—including encrypted HTTPS/TLS transit, WebRTC SRTP media encryption, secure JWT token authentication, and ACID-compliant database ledgers—to protect your data against unauthorized access or disclosure.

---

## 7. Your Privacy Rights
Depending on your jurisdiction (including India's Digital Personal Data Protection Act / DPDP Act, GDPR, or CCPA), you have the right to:
* Access, review, and update your profile information directly inside the app.
* Withdraw permissions (such as Location, Camera, or Microphone) at any time via your Android device settings.
* Request permanent deletion of your account and personal data.

---

## 8. Contact Us
If you have any questions, safety concerns, or privacy requests regarding this Privacy Policy, please contact us at:
* **Developer / Entity Name:** Sarvesh / Yugm Team
* **Support Email:** `support@yugmapp.com` *(replace with your active email)*

---
---

# How to Turn This Into a Public URL for Google Play Console (Free)

Google Play requires a **publicly accessible HTTPS URL** (not a Google Doc or PDF download link). Here are the two fastest free ways to host this policy:

### Option 1: GitHub Pages (Takes 2 Minutes)
1. Create a public repository on GitHub (e.g., `yugm-legal`).
2. Create an `index.html` or `privacy-policy.md` file and paste the Privacy Policy text above (with your real contact email).
3. Go to **Repository Settings** $\to$ **Pages** $\to$ Under **Branch**, select `main` and click **Save**.
4. GitHub will give you a live HTTPS URL like:
   `https://sarvesh-x.github.io/yugm-legal/privacy-policy`

### Option 2: Cloudflare Worker (Since You Already Use Cloudflare)
1. The deployed API already serves the policy at `/legal/privacy`, giving you:
   `https://yugm-api-staging.sarveshkumar10101.workers.dev/legal/privacy`
2. Paste that exact URL into **Google Play Console** $\to$ **App Content** $\to$ **Privacy Policy** (and link it on your app's Login/Settings screen).