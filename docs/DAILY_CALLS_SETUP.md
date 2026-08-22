# Live calls — setup

Call dates need a native SDK, so unlike everything else in Aura they cannot be
switched on with an over-the-air update. The app knows this: until a build with
the Daily code is installed, the call card says "Arrives in the next app update"
and the queue is unreachable. Nothing breaks in the meantime.

Four things have to happen, in this order.

---

## 1. Get a Daily API key

1. Sign up at <https://dashboard.daily.co/> (no card needed to start).
2. **Developers → API keys** → copy the key.
3. Add a card if you want more than a handful of simultaneous calls — without
   one, Daily caps concurrency.

**Cost.** 10,000 participant-minutes a month are free. A 7-minute one-to-one
call is 14 participant-minutes, so roughly **700 free calls a month**. After
that, audio-only is about **1.4p per call** and video about **5.6p**. Aura's
calls are audio-only, which is deliberate — video is four times the price and a
worse first date.

---

## 2. Set the key as a Supabase secret

```bash
npx supabase secrets set DAILY_API_KEY=your_key_here
```

The key never reaches a phone. The app only ever receives a room URL and a
short-lived meeting token minted for that one person for that one call.

---

## 3. Run migration 0013 and deploy the two functions

Paste `supabase/migrations/0013_calls_daily.sql` into the Supabase SQL Editor
and run it. It is safe to run twice.

```bash
npx supabase functions deploy call-match
npx supabase functions deploy call-token
```

Check the migration landed:

```sql
select proname from pg_proc
where proname in ('call_my_state','call_submit_outcome','call_queue_size');
```

Three rows means it worked.

---

## 4. Build a new binary

This is the part that cannot be skipped. `eas update` ships JavaScript; the
WebRTC framework is a compiled binary.

```bash
eas build --profile production --platform ios
```

Then submit it to TestFlight as usual. For local testing you need a dev client
build first (`eas build --profile development --platform ios`) — Expo Go will
never run this.

Once a tester is on the new build, the Meet tab's call card turns live on its
own. No further switch to flip.

---

## How the seven minutes are enforced

Not by the countdown on screen. Daily ejects both people from its own media
servers at a fixed instant, which survives the app being backgrounded, killed
or tampered with — the right property for a project with no scheduler.

The subtlety worth knowing: Daily's `eject_at_token_exp` **overrides** the
room's eject settings for the session. Setting both and hoping is not a
strategy, because the token always wins. So the deadline lives on the meeting
tokens, and `call-token` mints both people's tokens with the same `exp`, read
from `calls.expires_at`. That single column is also what the two phones count
down to, so the timer and the hang-up are the same instant rather than two
numbers that drift apart.

The room carries a later `exp` purely as a join gate and a backstop.

## Why the private answer is private

The call screen promises that if they don't feel the same, they never find out
you said yes. That is enforced in Postgres, not in the app:

- `UPDATE` on `public.calls` is revoked from members, so nobody can write the
  other person's answer.
- `SELECT` on `a_wants_to_meet` and `b_wants_to_meet` is revoked, so nobody can
  read it either — RLS filters rows, not columns, so a policy alone would not
  have been enough.
- `call_submit_outcome` decides which column belongs to you from your JWT.
- `call_my_state` returns the date id only once *you* have said yes, so a
  missing date is genuinely ambiguous from your side.

## Two runtime conflicts

Both are real and both are iOS:

- **Audio.** `AVAudioSession` is process-wide and WebRTC assumes it owns it.
  Do not play an `expo-video` with sound while a call is live — it gets ducked
  to the earpiece and sometimes stays quiet afterwards.
- **The microphone.** `expo-camera` and Daily cannot both hold the mic. The
  verification selfie and video-intro screens must be fully unmounted before a
  call starts, and vice versa.

## Versions, and why they are pinned

| Package | Version | Why |
|---|---|---|
| `@daily-co/react-native-daily-js` | 0.87.0 | Daily's table names 0.82.0 for SDK 54, but 0.82.0 only accepts AsyncStorage v1 and Expo 54 ships v2. Support for v2 arrived in 0.86.0. Same native surface, so the config plugin still applies cleanly. |
| `@daily-co/react-native-webrtc` | 124.0.6-daily.1 (exact) | The version Daily's compatibility table names for Expo 54. |
| `@daily-co/config-plugin-rn-daily-js` | 0.0.11 | 0.0.12 is npm `latest` but peers on Expo **55**. |
| `react-native-background-timer` | ^2.4.1 | Required peer, genuinely required at runtime. |
| `react-native-get-random-values` | ^1.11.0 | Required peer. npm `latest` is 2.0.0, which does *not* satisfy the range. |

`@config-plugins/react-native-webrtc` is **not** needed — it was folded into
Daily's own plugin at 0.0.9. Daily's README still lists it in one place; that
snippet is stale.

---

## Testing outside 19:00–21:00

Everything that starts something — the call queue, the blind pool, sending a
proposal — is gated to the nightly window. That is unarguable in production
and miserable for testing, so there is a switch.

In `app.json`:

```json
"extra": { "windowAlwaysOpen": true }
```

Set it to `true`, publish an OTA update, and every gate opens; set it back to
`false` and publish again to restore the real hours. No rebuild either way,
because `extra` travels in the update manifest. The countdown says "Testing
mode" while it is on, so nobody mistakes it for the real thing.

Development builds ignore the window entirely — waiting until 19:00 to check a
layout is absurd.

---

## "account-missing-payment-method"

If a call pairs, the room is created, and then both handsets drop with this
error, nothing in this repository is wrong. Daily is refusing the *join*.

Creating a room is a management-API call and works on an unbilled account.
Joining one is a media-server session, and Daily will not open a session for
an account with no payment method on file. The symptom is confusing because
everything up to the last step succeeds.

Confirm it from the API — an account in this state has never run a session:

```bash
curl -s -H "Authorization: Bearer $DAILY_API_KEY" \
  "https://api.daily.co/v1/meetings?limit=3"
# {"total_count":0,"data":[]}
```

The fix is to add a card at <https://dashboard.daily.co/> under Billing. It
has to be done by the account owner; it cannot be scripted, and nobody should
be entering someone else's card details on their behalf.

Adding a card does not by itself start charging: the free monthly allowance
still applies, and Aura's calls are audio-only, which is the cheap tier.
Check the current numbers on the dashboard rather than trusting a figure
written down here.
