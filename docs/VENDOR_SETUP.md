# Vendor setup — ID verification (Persona) & content moderation (OpenAI)

Both integrations are built and deployed. They stay dormant (and never block
users) until you add the keys below. Apple requires both for a dating app.

---

## Content moderation — OpenAI (free)

Screens every uploaded profile photo; rejects sexual/violent/hateful images.

1. Create an API key at **platform.openai.com → API keys**.
2. Set it on Supabase (one command):
   ```
   npx supabase secrets set OPENAI_API_KEY=sk-...
   ```
3. That's it — the `moderate-image` function is already deployed. Next time a
   user saves a profile photo it's screened; flagged photos are rejected with
   "didn't pass our content guidelines."

Notes:
- Until the key is set, moderation "fails open" (allows everything) so nothing
  breaks. Once set, it's live immediately — no app rebuild needed.
- Covers still images. Proposal **videos** would need frame-sampling — a
  follow-up if Apple asks for video moderation.

---

## ID verification — Persona

Replaces the manual selfie+liveness review with a real ID + selfie check.

1. Create a **Persona** account (withpersona.com).
2. Build an **Inquiry Template** (Government ID + Selfie). Copy its id
   (`itmpl_...`).
3. Put it in `app.json` → `extra.personaTemplateId` (tell Claude and he'll
   add it), then make a new build (config change).
4. Set up the **webhook**:
   - Persona → Webhooks → add `https://krkibouizxurqboyahon.supabase.co/functions/v1/persona-webhook`
   - Copy the webhook **secret**, then:
     ```
     npx supabase secrets set PERSONA_WEBHOOK_SECRET=<secret>
     ```
5. Done. When configured, the Verify screen opens Persona's hosted flow; when
   Persona approves/declines, the webhook flips `profiles.verification_status`
   automatically.

Notes:
- Until `personaTemplateId` is set, the Verify screen uses the existing in-app
  selfie + liveness flow — nothing breaks.
- The flow is native-module-free (opens in the browser), but adding the
  template id to `app.json` is a config change, so it needs a fresh build.

---

## Deployed functions (already live)

| Function | Auth | Purpose |
|----------|------|---------|
| `moderate-image` | JWT | Screen an image via OpenAI |
| `persona-webhook` | shared secret | Apply Persona results to the profile |
| `notify` | JWT | Push notifications |
| `revenuecat-webhook` | shared secret | Aura Gold status sync |
| `delete-account` | JWT | Account deletion |
