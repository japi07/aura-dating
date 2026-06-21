# Aura — App Store listing (copy-paste ready)

Everything you need for the App Store Connect "App Information" + "Version"
screens. Character limits are noted; all drafts respect them.

---

## App Name  (max 30 chars)

Apple requires a unique name. "Aura" alone is almost certainly taken, so:

- **Primary:** `Aura — Dates, Not Swipes`  (24)
- Alt 1: `Aura: Real London Dating`  (24)
- Alt 2: `Aura Dating`  (11 — try it; may be taken)

## Subtitle  (max 30 chars)

- **Primary:** `Real dates, not endless swipes`  (30)
- Alt: `Invitation-first dating`  (23)

## Promotional Text  (max 170 chars — editable anytime without review)

> No swiping. No endless chat. Each day, receive one real date proposal — a
> place, a time, and a video hello. Say yes, and the date's set. Verified, women-first.

## Keywords  (max 100 chars, comma-separated, no spaces)

```
dating,london,date,singles,women,match,relationship,video,verified,meet,romance,first date,serious
```

## Description  (max 4000 chars)

```
Aura is dating, reimagined — for people who'd rather go on a real date than scroll for hours.

No swiping. No endless small talk. On Aura, you receive one thoughtfully curated date proposal at a time: a real London venue, a date and time, and a short video introduction from the person asking. You watch, you feel the vibe, and you simply say yes or no. Say yes, and the date is instantly confirmed and added to your calendar.

WHY AURA IS DIFFERENT

• One proposal at a time — quality over quantity, no infinite feed
• Real plans, not "hey" — every proposal is an actual invitation to a real place
• Video-first — see and hear the person before you decide
• Women-first & respectful — designed to feel safe and intentional
• Verified humans — selfie + ID checks keep Aura real

BUILT FOR REAL CONNECTION

Aura curates around genuine compatibility — shared interests, your part of the city, and what you're actually looking for. Every match is a step toward meeting in person, not pen-pal limbo.

SAFETY AT THE CORE

• Verified profiles with selfie and identity checks
• Block and report anyone, anytime
• Built-in SOS: call for help or alert your trusted contacts with your live location
• First-date safety tips and curated, public venues

AURA GOLD

Upgrade to Aura Gold for more daily proposals, incognito browsing, priority curation, and members-only events.

Aura is 18+ and currently focused on London. Your next real date starts here.
```

## What's New (for v1.0.0)

```
Welcome to Aura — invitation-first dating for London. One curated date proposal
a day, real video introductions, verified profiles, and built-in safety tools.
```

---

## App Information settings

| Field | Value |
|-------|-------|
| **Primary category** | Social Networking (or Lifestyle) |
| **Secondary category** | Lifestyle |
| **Age rating** | **17+** (required — dating + unrestricted web/user content) |
| **Privacy Policy URL** | https://japi07.github.io/aura-dating/legal/privacy.html |
| **Support URL** | https://japi07.github.io/aura-dating/legal/ (or a support page) |
| **Marketing URL** | (optional) |
| **Support email** | azpiazujavier@gmail.com (swap for a branded one ideally) |

### Age rating questionnaire — expect to answer "Yes" to:
- Unrestricted web access: No (the app has no open browser)
- "Dating" / mature themes: Yes → results in 17+
- Infrequent/mild sexual content or nudity: No (moderation blocks it)

---

## Privacy "Nutrition Labels" (App Privacy section)

Declare these **data types collected** (all linked to the user's identity):

| Data | Used for | Linked to user |
|------|----------|----------------|
| Email address | App Functionality, Account | Yes |
| Name | App Functionality | Yes |
| Photos / Videos | App Functionality | Yes |
| Other user content (bio, messages) | App Functionality | Yes |
| Coarse location | App Functionality (distance) | Yes |
| Sensitive info (sexual orientation via gender preference) | App Functionality | Yes |
| Identifiers (user ID, device/push token) | App Functionality | Yes |
| Usage data / diagnostics | Analytics, App Functionality | Yes |

- **Used for tracking?** No. Aura does not track users across other apps.
- **Data not collected:** browsing history, contacts, financial info, health.

---

## Screenshots (required: 6.7" iPhone, ideally 6.5" too)

Capture these flows (Claude can grab them from the running app):
1. The Today screen with a date proposal (the hero magazine card)
2. A proposal's video introduction playing
3. Confirmed date / Dates tab
4. Profile with the verified badge
5. Aura Gold paywall
6. Safety centre / SOS

Tip: add a one-line caption band over each (e.g. "One real date a day",
"See them before you say yes", "Verified humans only").

---

## TestFlight — "What to Test" notes

```
Thanks for testing Aura! Please try:
1. Sign up + complete your profile (add a photo)
2. Send a date proposal to another tester (record a video)
3. Accept a proposal you receive — check it lands in Dates + your calendar
4. Try verification, block/report, and the SOS screen
5. Browse Aura Gold (don't need to buy)
Report anything confusing or broken. Thank you!
```

---

## Submission gotchas for dating apps (Apple)

- **Demo account**: App Review will need a working login — create a test
  account and put the credentials in "App Review Information," plus a second
  account so they can see a proposal exchange.
- **Account deletion**: must be in-app (✅ Profile → Privacy → Delete account).
- **Moderation + reporting**: must exist (✅ done).
- **Age gate**: 18+ enforced at sign-up (✅ date of birth).
- Fill the **company/legal entity** fields in the privacy policy before submitting.
```
