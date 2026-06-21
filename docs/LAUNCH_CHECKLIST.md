# Aura — Launch Readiness Checklist

The app is feature-complete and database-backed. What remains is launch ops:
mostly your accounts and decisions, with a few pieces Claude can build once you
choose vendors. Items are ordered by what blocks the most downstream work.

Legend:  👤 = only you can do it · 🤖 = Claude can do it · 💷 = costs money

---

## 1. Aura Gold go-live  (see AURA_GOLD_SETUP.md for full detail)

- 👤 Sign Apple **Paid Applications Agreement** + banking/tax (1–2 days to clear)
- 👤 Create the 3 subscription products in App Store Connect
- 👤 Create a **RevenueCat** account, entitlement `gold`, offering, products
- 👤 Send Claude the RevenueCat **iOS API key** → 🤖 wires it into app.json
- 👤 Pick a webhook secret → 🤖 sets it on Supabase + you paste it in RevenueCat
- 👤 New build + sandbox-test a purchase

---

## 2. ID verification vendor  💷  (Apple requirement for dating apps)

Your current verification uploads a selfie+video for manual review. Apple wants
a real identity check. Pick ONE vendor:

| Vendor | Cost | Notes |
|--------|------|-------|
| **Stripe Identity** (recommended) | ~£1.20 / check, no monthly min | Easiest for a solo founder; you may already trust Stripe |
| Persona | Custom, free tier | More configurable, popular with dating apps |
| Onfido | Higher, sales-led | Enterprise-grade |

- 👤 Create the account, get API keys
- 🤖 Build the verification handoff (open the vendor flow, store the pass/fail
  result on the `verifications` row + flip `profiles.verification_status`)
- 👤 Fund the account

Decision needed: **which vendor?**

## 3. Content moderation  💷/free  (Apple requirement for dating apps)

Every uploaded photo/video must be screened for nudity/abuse. Options:

| Option | Cost | Notes |
|--------|------|-------|
| **OpenAI omni-moderation** (recommended) | free | Handles images; one Edge Function; you just need an OpenAI API key |
| AWS Rekognition | ~$1 / 1000 images | Robust, more setup |
| Sightengine | free tier then paid | Purpose-built for nudity detection |

- 👤 Create the account / API key
- 🤖 Build an Edge Function that screens each profile photo + proposal/verification
  media on upload and blocks or flags it

Decision needed: **which provider?**

---

## 4. Host legal docs  (free)

You have `legal/PRIVACY_POLICY.md` + `legal/TERMS_OF_SERVICE.md`. They must be at
public URLs (Apple + the in-app links need them).

- 🤖 Convert them to simple HTML pages
- 👤 Enable **GitHub Pages** on the repo (Settings → Pages → deploy from `main`,
  `/docs` folder) — gives you `https://japi07.github.io/aura-dating/...`
- 🤖 Point the in-app Legal links + Apple metadata at the hosted URLs

(Alternative: a free Vercel/Netlify site if you want a custom domain.)

## 5. Real support email

- 👤 Decide the address (e.g. a Gmail, or `hello@yourdomain`)
- 🤖 Swap the placeholder `support@auradating.app` in the Help screen

---

## 6. App Store listing + TestFlight

- 👤 In App Store Connect, fill in: app name, subtitle, description, keywords,
  **age rating** questionnaire (17+ for dating), **privacy nutrition labels**,
  support URL, marketing URL
- 🤖 Draft the description, subtitle, keywords, and "what to test" notes
- 🤖 Capture App Store **screenshots** from the running app
- 👤 / 🤖 Build + upload via `eas build --profile production` then
  `eas submit -p ios`
- 👤 Invite yourself + friends to **TestFlight**, test the full flow
- 👤 Submit for App Store review

---

## 7. Standalone preview build (optional but handy now)

So you can use the app without the laptop + Metro running:

- 🤖 / 👤 `eas build --profile preview --platform ios`
- 👤 Install the resulting build on your iPhone

---

## Suggested order

1. **Standalone preview build** (#7) — lets you test everything hands-free today
2. **Host legal docs + support email** (#4, #5) — quick, free, unblocks Apple metadata
3. **Pick moderation + ID vendors** (#2, #3) — the real Apple blockers; Claude builds once chosen
4. **Aura Gold** (#1) — revenue, can run in parallel
5. **App Store listing + TestFlight** (#6) — last, once the above are in
