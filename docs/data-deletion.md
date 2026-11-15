# Account & Data Deletion Instructions – Yugm

*Last Updated: November 15, 2026*

At **Yugm**, you have full control over your personal data. In compliance with Google Play’s **User Data & Account Deletion Policy**, this page explains how you can permanently delete your Yugm account and associated personal data—even if you no longer have the mobile app installed.

## Option 1: Delete Directly Inside the Yugm App (Instant)

If you have the Yugm Android app installed on your device, you can initiate permanent account deletion directly:

1. Open the **Yugm** app and log in to your account.

2. Tap on your **Profile** icon in the bottom navigation bar.

3. Open **Settings** (gear icon) $\to$ **Account**.

4. Tap **Delete Account**.

5. Confirm your choice when prompted to permanently schedule your account for deletion.

## Option 2: Request Deletion via Web / Email (Without App Access)

If you have uninstalled the app or cannot access your account, you can request full account and data deletion through our support channel:

1. Send an email to **`support@yugmapp.com`** *(replace with your active support email)* with the subject line:
   **`Account Deletion Request – Yugm`**

2. Include the **phone number** or **email address** registered with your Yugm account so we can verify ownership.

3. Our team will verify your request and process the deletion within **7 business days**, sending you a confirmation email once completed.

## What Data Is Deleted vs. Retained

When you delete your Yugm account, we permanently erase the following personal data from our active production servers and databases within **30 days**:

### **Permanently Deleted Data:**

* **Profile Information:** Name, bio, age/date of birth, gender, interests, and prompts.

* **Media & Photos:** All uploaded profile pictures and gallery media.

* **Location Data:** Stored GPS coordinates and city/radius preferences.

* **Social & Match Data:** Match history, likes, room history, and private text messages.

* **Authentication & Device Tokens:** Login credentials and Firebase Cloud Messaging (FCM) push tokens.

### **Data Retained Temporarily for Legal & Security Reasons:**

* **Financial & Transaction Records:** Records of Google Play In-App Purchases (coins, gifts, or subscriptions) are retained in anonymized/accounting form as required by applicable tax, audit, and anti-fraud laws (e.g., GST/financial compliance in India).

* **Safety & Ban Logs:** Minimal hashed identifiers (such as banned device/phone hashes) may be retained solely to prevent banned users from creating new accounts to abuse or harass other members.

## Contact Us

If you need assistance deleting your account or have questions about how your data is handled, contact our Data Protection & Support Team:

* **App Name:** Yugm

* **Developer:** Sarvesh / Yugm Team

* **Support Email:** `support@yugmapp.com` *(replace with your active support email)*

## How to Link This in Google Play Console

Google Play’s **Data Safety** form specifically asks for a **"Delete account URL"** in addition to your Privacy Policy URL:

1. Host this page at a dedicated public route—for example:

   * **GitHub Pages:** `https://sarvesh-x.github.io/yugm-legal/delete-account`

   * **Render Backend:** `https://your-backend-url.onrender.com/delete-account`

2. Go to **Google Play Console** $\to$ **App Content** $\to$ **Data Safety** $\to$ **Account deletion** and paste that exact URL.