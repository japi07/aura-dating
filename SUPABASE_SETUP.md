# Aura — Backend & Build Setup

Step-by-step guide to wire up Supabase, run the schema, configure EAS Build, and submit to the App Store.

---

## 1. Create a Supabase project

1. Go to https://supabase.com → **Start your project** (free tier is fine to begin)
2. Create a new project in the **EU (Ireland)** region (closest to UK users + GDPR friendly)
3. Wait ~2 min for provisioning
4. Project Settings → **API** → copy:
   - `Project URL` (e.g. `https://abcdefg.supabase.co`)
   - `anon` `public` key (a long JWT)

## 2. Run the database schema

1. In Supabase, open the **SQL Editor** (left sidebar)
2. Copy the contents of `supabase/schema.sql` from this repo
3. Paste and click **Run**

You should see four storage buckets created (`profile-photos`, `proposal-videos`, `verification-photos`, `verification-videos`) and seven tables (`profiles`, `proposals`, `dates`, `blocks`, `reports`, `verifications`, `push_tokens`).

## 3. Configure auth providers

In Supabase → **Authentication** → **Providers**:

- **Email**: enable; set "Confirm email" to **on** for production (off for testing)
- **Apple**: enable → fill in your **Service ID**, **Team ID**, **Key ID**, and **Private Key** from Apple Developer

Apple Sign-In setup is detailed below in section 6.

## 4. Add the keys to the app

### For local development (Expo Go):
Open `app.json` and replace the placeholders in `extra`:

```json
"extra": {
  "supabaseUrl": "https://YOURPROJECT.supabase.co",
  "supabaseAnonKey": "eyJh...your-anon-key...",
  ...
}
```

### For EAS Build secrets:
Don't put real keys in `app.json` if your repo is public. Instead, set them as EAS secrets:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_DEV --value "https://YOURDEV.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY_DEV --value "eyJh...dev..."

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_PROD --value "https://YOURPROD.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD --value "eyJh...prod..."
```

`eas.json` already references these via `$EXPO_PUBLIC_SUPABASE_URL_DEV` etc.

## 5. Set up EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in (creates account if you don't have one — free)
eas login

# Initialise EAS in this project
eas init

# Configure the project (auto-detects iOS / Android settings)
eas build:configure

# Open the EAS dashboard for the project — copy the projectId
eas project:info
```

Paste the `projectId` into `app.json` → `extra.eas.projectId`.

### Build profiles in `eas.json`

| Profile | Use |
| --- | --- |
| `development` | Internal dev build with the Expo dev client |
| `preview` | TestFlight / internal testing builds |
| `production` | App Store / Play Store submissions |

```bash
# Development build (install on simulator or your own iPhone via UDID)
eas build --platform ios --profile development

# Preview build for TestFlight
eas build --platform ios --profile preview

# Production build
eas build --platform ios --profile production
```

## 6. Apple Sign-In setup

Apple Sign-In requires more than just the package — you need to register it with Apple:

1. **Apple Developer account** ($99/year): https://developer.apple.com
2. **Certificates, Identifiers & Profiles** → **Identifiers** → register `com.auradating.app`
3. Enable the **Sign in with Apple** capability on that identifier
4. Create a **Service ID** (e.g. `com.auradating.app.signin`) — needed for Supabase to validate tokens
5. Create a **Sign in with Apple Key** (download the `.p8` file once)
6. In **Supabase → Authentication → Apple**, paste:
   - Service ID
   - Team ID (top-right in Apple Developer)
   - Key ID (visible after creating the key)
   - Private key (paste the contents of the `.p8` file)

## 7. Submit to the App Store

### Before submission, you MUST have:

- [ ] Apple Developer account, $99/year paid
- [ ] App Store Connect listing created with:
  - [ ] App name & subtitle
  - [ ] Description (up to 4000 chars)
  - [ ] Keywords (up to 100 chars)
  - [ ] **5–8 screenshots** per device size (6.7", 6.5", 5.5") — use a tool like rotato.xyz
  - [ ] Privacy Policy URL (host `legal/PRIVACY_POLICY.md` somewhere publicly accessible)
  - [ ] Support URL
  - [ ] Marketing URL (optional)
  - [ ] Age rating questionnaire (you'll mark 17+ for dating)
- [ ] **Privacy Policy hosted at a real URL** — Apple will check it loads
- [ ] **Terms of Service** hosted similarly
- [ ] Real backend running with all endpoints functional
- [ ] Content moderation pipeline running (so user-uploaded photos/videos are screened)
- [ ] Real identity verification (Persona / Onfido / Stripe Identity active)
- [ ] **Demo account credentials** for App Store reviewers — they'll log in and test
- [ ] Tested via TestFlight with at least 20 real users for ~2 weeks

### Then:

```bash
# Build the production binary
eas build --platform ios --profile production

# Submit it to App Store Connect (eas.json submit config kicks in)
eas submit --platform ios --latest
```

Apple Review typically takes 24–48 hours for the first submission. **Expect 1–3 rejection rounds** before approval — they will find issues in the demo account flow.

## 8. Privacy Policy & Terms hosting

`legal/PRIVACY_POLICY.md` and `legal/TERMS_OF_SERVICE.md` are templates. To host them:

- **Cheap**: Render them with [Vercel](https://vercel.com), [Netlify](https://netlify.com), or [Cloudflare Pages](https://pages.cloudflare.com) — connect this repo and point to a `/privacy` and `/terms` route
- **Cheapest**: paste into GitHub Pages (free)
- The URLs need to be **publicly accessible without login** for Apple Review

## 9. Things still to build before launch

| Feature | Why | Effort |
| --- | --- | --- |
| Push notifications via backend | Real "new proposal" alerts | 1 day |
| Photo moderation (OpenAI / AWS Rekognition Content Moderation) | Apple requires it | 1–2 days |
| Real identity verification (Persona webhooks) | Apple requires it for dating apps | 1 day |
| In-App Purchase for Aura Gold (RevenueCat or Apple StoreKit) | Required if monetising | 2–3 days |
| Account-deletion server endpoint | Apple requires it | 0.5 days |
| Reporting backend + admin panel | Apple requires it | 2–3 days |
| TestFlight beta with 20+ real users | Sanity check before submission | 2 weeks |

---

## Quick reference: env vars

| Env var | Used in | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile app via `lib/supabase.ts` | Public — safe to expose |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile app via `lib/supabase.ts` | Public — safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | edge functions only | **NEVER** put in the mobile app |
| `APPLE_ID_EMAIL` | EAS submit | Your Apple Developer email |
| `APPLE_TEAM_ID` | EAS submit | From Apple Developer portal |
| `APPLE_ASC_APP_ID` | EAS submit | From App Store Connect (numeric) |
