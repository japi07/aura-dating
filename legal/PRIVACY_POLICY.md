# Privacy Policy

**Last updated: 21 June 2026**

This Privacy Policy describes how Aura ("Aura", "we", "us", "our") collects, uses, and protects your information when you use the Aura mobile application (the "App") and related services (collectively, the "Services").

> ⚠️ Replace every `[BRACKETED]` field with your real values before publishing. This template is written to satisfy Apple App Store Review (Guidelines 5.1.1, 5.1.2), Google Play, UK GDPR, and the California Consumer Privacy Act. **You must have it reviewed by a qualified lawyer in your jurisdiction before you ship.**

---

## 1. Who we are

Aura is operated by **[Aura Dating Limited]**, a company registered in England and Wales (company number **[XXXXXXXX]**), with registered office at **[Your Registered Address, London, UK]**.

- **Data Controller**: [Aura Dating Limited]
- **Data Protection Officer (DPO)**: [name + email]
- **Contact email**: azpiazujavier@gmail.com
- **Support email**: azpiazujavier@gmail.com

## 2. Summary

| What we collect | Why |
| --- | --- |
| Email, name, age, gender, gender preference | Account creation, eligibility (must be 18+) |
| Photos, video introductions | Profile & date proposal content |
| Selfie + liveness video | Identity verification (real-human check) |
| Date of birth | Age verification — required by Apple for dating apps |
| Approximate location | Showing distance to dates / matches |
| Calendar permissions (optional) | Adding confirmed dates to your calendar |
| Camera, microphone, photos | To record videos and pictures you choose to share |
| Push token | Sending notifications you've opted into |
| Device & usage analytics | App performance & abuse prevention |

We do **not** sell your personal information. We never share your photos, videos, selfie, or contact details with third parties for advertising.

## 3. Information we collect

### 3.1 Account information
When you sign up we collect your **email address**, **name**, **password (hashed; we never see plaintext)**, **date of birth**, **gender**, **gender preference**, **city**, **bio**, **interests**, and **profile photo**.

### 3.2 Identity verification
To earn the verified badge you submit a **selfie photograph** and a short **liveness video (3–15 seconds)**. These are processed by our verification provider **[Persona / Onfido / Stripe Identity]** for face matching and liveness detection. Original artifacts are retained for **[180 days]** then automatically deleted.

### 3.3 Content you create
Profile photos, **30-second video introductions** in proposals, date plans, captions, and ratings.

### 3.4 Device and usage data
Device model, OS version, app version, crash logs, anonymous analytics, IP address (for fraud prevention and roughly locating your city).

### 3.5 Location
**Approximate** location only, used to show distance to potential matches and venues. We do **not** track your real-time location and we never share it with other users beyond "X km away".

### 3.6 Apple Sign-In
If you sign in with Apple, we receive a private email relay (e.g. `xyz@privaterelay.appleid.com`) and your name. We use these solely to create your account; we never use Apple-relayed emails for marketing.

## 4. How we use information

We process your information to:

1. Create and maintain your account
2. **Verify you are 18 or older** (legal requirement; cannot be opted out)
3. **Verify you are a real human** (selfie + liveness check)
4. Match you with appropriate proposers based on your stated preferences
5. Deliver proposals, dates, and reminders
6. Send transactional notifications (proposal received, date confirmed, etc.)
7. Detect, prevent, and respond to abuse, fraud, harassment, and illegal activity
8. Improve the Service via aggregate analytics
9. Comply with legal obligations (court orders, safety investigations)

### Lawful bases (UK GDPR)
- **Contract**: providing the Service to you
- **Consent**: optional features like push notifications, calendar integration
- **Legitimate interest**: fraud prevention, security, service improvement
- **Legal obligation**: age verification, responses to lawful requests

## 5. How we share information

We share information only with:

- **Other users** — limited to your public profile (name, age, city, bio, interests, photo, intent). We **never** share email, exact location, phone, birthday, or verification artifacts.
- **Service providers** (data processors) bound by contract to use the data only as instructed:
  - **Supabase** (database, file storage) — EU region
  - **[Persona / Onfido / Stripe Identity]** (verification)
  - **AWS / Cloudflare** (infrastructure)
  - **Expo / Apple / Google** (push notifications)
  - **OpenAI / AWS Rekognition Content Moderation** (automated content moderation)
- **Law enforcement** when required by a valid legal order, in good faith, or to protect the safety of users.

We do **not** sell your personal data. We do **not** use your photos or videos to train AI models.

## 6. Your rights

If you're in the UK or EEA you have the right to:

- **Access** — request a copy of your data
- **Rectification** — correct inaccurate data
- **Erasure** — delete your account at any time (Profile → Privacy → Delete my account, or email azpiazujavier@gmail.com)
- **Restriction** — limit how we process your data
- **Portability** — receive your data in a portable format
- **Object** — to processing based on legitimate interests
- **Withdraw consent** — for any consent-based processing
- **Complain** — to the UK Information Commissioner's Office (ICO) at https://ico.org.uk

California residents have analogous rights under the CCPA/CPRA.

We respond to all verified requests within **30 days**.

## 7. Account deletion

You can delete your account in-app at any time: **Profile → Privacy → Delete my account**.

When you delete your account:
- Your public profile is removed immediately
- Your photos, videos, and account record are permanently deleted within **30 days**
- Verification artifacts are deleted within **30 days**
- Aggregate, anonymized analytics may be retained

Some records may be retained where legally required (e.g. reported abuse, fraud investigations) for up to **6 years**, in line with UK statutory limitation periods.

## 8. Data retention

| Data | Retention |
| --- | --- |
| Account profile | Until you delete it |
| Verification selfie + video | 180 days from submission |
| Proposal videos | 90 days from sending |
| Date records | 24 months |
| Push tokens | 90 days from last use |
| Crash logs / analytics | 13 months (aggregated thereafter) |
| Records related to reports of abuse | Up to 6 years |

## 9. Security

- Passwords are hashed with bcrypt (we never store plaintext)
- All data is encrypted **in transit** (TLS 1.2+)
- Data at rest is encrypted on Supabase storage (AES-256)
- Verification artifacts are stored in **private** buckets readable only by the user and authorised admin reviewers
- We use Row-Level Security policies to prevent users from accessing each other's private data

## 10. International transfers

Your data is stored on servers in the **EU** (Ireland). Some service providers (Apple, Google, Expo) process data in the US under Standard Contractual Clauses or the EU-US Data Privacy Framework.

## 11. Children

Aura is **strictly 18+**. We do not knowingly collect data from anyone under 18. If we discover that a user is under 18, we will delete their account and all associated data immediately. If you believe a minor is using Aura, please contact azpiazujavier@gmail.com and we will act within 24 hours.

## 12. Cookies and tracking

The Aura mobile app does **not** use third-party advertising cookies or cross-app tracking. We do not use the Identifier for Advertisers (IDFA). We do not implement App Tracking Transparency consent because we do not track users across other apps.

## 13. Marketing

We send marketing communications (e.g. weekly digest) only with your explicit consent (Settings → Notifications → Aura Weekly digest). You can withdraw consent at any time in the same place.

## 14. Changes to this policy

If we materially change this Privacy Policy we will notify you in-app and via email at least **30 days** before the change takes effect.

## 15. Contact

For any privacy question or to exercise your rights:

- Email: **azpiazujavier@gmail.com**
- Postal: [Aura Dating Limited, Your Registered Address, London, UK]
- Lead supervisory authority: **UK Information Commissioner's Office** (https://ico.org.uk)
