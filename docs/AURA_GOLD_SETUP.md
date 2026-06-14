# Aura Gold — Going Live with Real Payments

This is the full checklist to turn Aura Gold from "wired up in code" into
"actually charging real money." All the **code** is done. These are the
**account/dashboard** steps only you can do.

Order matters — do them top to bottom. Step 2 (Apple banking/tax) can take a
day or two to process, so start it early.

Your details:
- **Bundle ID:** `com.auradating.ios`
- **Supabase project:** `krkibouizxurqboyahon`
- **RevenueCat entitlement name (must match exactly):** `gold`
- **Suggested product IDs:**
  - `com.auradating.ios.gold.monthly`
  - `com.auradating.ios.gold.sixmonth`
  - `com.auradating.ios.gold.yearly`

---

## Step 1 — Database migration (30 seconds)

Adds two columns so the server remembers who's a Gold member.

1. Go to **supabase.com/dashboard** → your project → **SQL Editor** (left sidebar).
2. Click **+ New query**, paste this, click **Run**:

```sql
alter table public.profiles add column if not exists is_gold boolean default false;
alter table public.profiles add column if not exists gold_expires_at timestamptz;
```

3. You should see "Success. No rows returned." Done.

---

## Step 2 — App Store Connect (the money plumbing)

### 2a. Sign the Paid Applications Agreement
1. Go to **appstoreconnect.apple.com** → **Business** (or **Agreements, Tax, and Banking**).
2. Find **Paid Applications** → click **View / Set Up**.
3. Accept the agreement.
4. Fill in **Bank Account** details (where Apple sends your money).
5. Fill in **Tax** forms (Apple requires these per country).
   - ⚠️ This can take a day or two to show as "Active." Nothing below works
     until the agreement status is **Active**.

### 2b. Make sure your app record exists
1. App Store Connect → **My Apps**.
2. If "Aura Dating" isn't there: click **+** → **New App**.
   - Platform: iOS
   - Name: Aura Dating
   - Bundle ID: select `com.auradating.ios`
   - SKU: anything unique, e.g. `auradating001`

### 2c. Create the subscription group + 3 subscriptions
1. Open your app → left menu **Monetization** → **Subscriptions**.
2. Click **Create** next to Subscription Groups. Name it `Aura Gold`
   (users can only have one active subscription per group — correct here).
3. Inside the group, **Create** a subscription for each plan:

   | Plan      | Product ID                          | Duration  |
   |-----------|-------------------------------------|-----------|
   | Monthly   | `com.auradating.ios.gold.monthly`   | 1 Month   |
   | 6 months  | `com.auradating.ios.gold.sixmonth`  | 6 Months  |
   | Yearly    | `com.auradating.ios.gold.yearly`    | 1 Year    |

4. For **each** subscription, fill in:
   - **Reference Name** (internal, e.g. "Aura Gold Monthly")
   - **Subscription Price** → pick your price per region (set GBP for UK)
   - **Localization** → Display Name (e.g. "Aura Gold") + Description
   - **Review Information** → upload one screenshot of the paywall screen +
     a short note like "Unlocks Aura Gold premium features."
5. Status will be **"Ready to Submit"** — that's fine. Subscriptions get
   reviewed together with your first app submission (TestFlight sandbox works
   before then).

---

## Step 3 — RevenueCat (ties it all together)

### 3a. Create the project
1. Sign up at **revenuecat.com** (free).
2. **Create a new Project** → name it "Aura".
3. **+ New app** → choose **App Store** (Apple).
   - App name: Aura Dating
   - App Bundle ID: `com.auradating.ios`

### 3b. Give RevenueCat access to your subscriptions
RevenueCat needs to verify purchases with Apple. Use the **In-App Purchase Key**:
1. App Store Connect → **Users and Access** → **Integrations** tab →
   **In-App Purchase** → **Generate In-App Purchase Key**.
2. Download the `.p8` file (you can only download once) + note the **Key ID**
   and your **Issuer ID**.
3. In RevenueCat → your app settings → paste the **Key ID**, **Issuer ID**,
   and upload the `.p8`.

### 3c. Add products
1. RevenueCat → **Products** → **+ New** → add all three product IDs exactly:
   - `com.auradating.ios.gold.monthly`
   - `com.auradating.ios.gold.sixmonth`
   - `com.auradating.ios.gold.yearly`

### 3d. Create the entitlement
1. RevenueCat → **Entitlements** → **+ New**.
2. Identifier: **`gold`** (must match exactly — the app looks for this).
3. **Attach** all three products to it.

### 3e. Create the offering
1. RevenueCat → **Offerings** → there's a `default` offering → **+ New Package**
   three times:
   - Package "Monthly" → attach `...gold.monthly`
   - Package "6 Month" → attach `...gold.sixmonth`
   - Package "Annual" → attach `...gold.yearly`
   (Use RevenueCat's standard package types Monthly / 6 Month / Annual — the app
   maps those automatically.)

### 3f. Get the API key → give it to me
1. RevenueCat → **API Keys** (or **Project Settings → API Keys**).
2. Copy the **Apple App Store** public SDK key — it starts with `appl_...`.
3. Send it to me. I'll paste it into `app.json` →
   `extra.revenueCatApiKeyIos`.

### 3g. Set up the webhook (keeps subscriptions in sync)
1. Pick a long random string as a secret (e.g. mash your keyboard, 30+ chars).
2. Tell me the string — I'll run
   `npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=...` for you. (Or run it
   yourself.)
3. RevenueCat → **Integrations** → **Webhooks** → **+ New**:
   - **URL:** `https://krkibouizxurqboyahon.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization header:** the same random string from step 1.
   - Save.

---

## Step 4 — Build & test

1. After I add the API key, make a fresh build (the SDK is native code):
   ```
   eas build --profile development --platform ios
   ```
   (or `--profile preview` for a standalone copy).
2. On your phone, open the new build → Profile → Aura Gold.
3. To test a real purchase without spending money, create a **Sandbox Tester**
   in App Store Connect → **Users and Access → Sandbox Testers**, then sign in
   with it on your iPhone (Settings → App Store → Sandbox Account).
4. Subscribe in the app → it should go through the Apple sheet → you become
   Gold → the webhook flips `is_gold` to true in Supabase.

---

## How it behaves before you finish this

- The app runs normally; the Aura Gold screen shows the perks and plans.
- Tapping "Become a Gold Member" shows a friendly "almost ready" message
  instead of charging — because no API key / native build exists yet.
- Nothing crashes. Once steps 1–4 are done, it becomes a real purchase.
