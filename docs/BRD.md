# Aura — Business Requirements Document

**Version:** 1.0 · **Status:** For design & engineering review
**Audience:** Senior product designer, senior software developer, operations lead

> **Working name.** This document uses "Aura" as the product name. The model described here (daily window, three modes, token economy, concierge-planned dates) is a significant evolution of the existing Aura proposal-only prototype; where the two differ, this document supersedes it.

---

## 1. Product Overview

Aura is a mobile dating product that exists to move serious, compatible people from **discovery to a real-world date** in the shortest respectful path possible.

It replaces the conventional `swipe → match → chat for weeks → maybe meet` loop with:

**Discover → Express intentional interest → Commit (tokens) → Interact → Meet → Feedback**

Three things make it structurally different from existing apps:

1. **A single daily interaction window** (default 19:00–21:00 local). Dating happens as an event, not a background habit.
2. **Three interaction modes** of escalating commitment — live calls, app-organised blind dates, and curated date proposals — priced in tokens accordingly.
3. **Human date concierge.** Once two people commit, Aura's operations team plans the actual date. Users never negotiate logistics.

Success is measured in **attended dates**, not matches.

---

## 2. Problem Statement

For the core user — a single woman seeking a serious partner — conventional dating apps fail in specific, addressable ways:

| Problem | Consequence | Aura's structural answer |
|---|---|---|
| Unlimited browsing | Hours spent, no dates | Daily 2-hour window, capped daily supply |
| Zero-cost "likes" | Low-effort interest floods the inbox | Tokens make commitment cost something |
| Endless pre-date chat | Emotional labour, no meeting | No open chat before a date is confirmed |
| Matches that never convert | Fatigue, churn | Acceptance *is* the date commitment |
| Logistics friction | "We should meet sometime" | Concierge plans and books it |
| Unverifiable intent | Time wasted on unserious people | Verification + token cost + behaviour signals |

For men, the same mechanics deliver a different but equally real benefit: **clear signals of genuine interest** and a far higher proposal-to-date conversion rate than a like-based app.

---

## 3. Product Vision

> Aura is not designed to help people spend more time dating online. It is designed to efficiently move serious, compatible people from discovery to genuine human interaction and ultimately to a well-organised real-world date.

Design consequences that follow from this and should govern every decision:

- Time-in-app is **not** a success metric. A user who opens the app for 12 minutes and gets a date is a better outcome than one who browses for 2 hours.
- There is **no open-ended messaging** in the MVP. Communication is structured and tied to an interaction.
- Every mode terminates in either a **date**, a **no**, or an **expiry** — never in an indefinite "match" state.

---

## 4. Target Users

**Primary — "Intentional Woman", 27–40.** Employed, time-poor, has used Hinge/Bumble and is tired of them. Wants to meet someone serious without managing five conversations. Values safety and low effort-to-date ratio. Will pay for a better filter.

**Secondary — "Serious Man", 28–45.** Willing to make effort and spend money on a real date. Frustrated that effort is invisible on like-based apps. Values clear signals and no ambiguity.

**Explicitly not the target:** casual/hookup-seeking users, people wanting a pen-pal experience, users unwilling to meet within ~2 weeks.

**Launch market:** London only. Single-city launch is required for concierge viability (venue knowledge, ops load, matching liquidity within one window).

---

## 5. Core Product Principles

| Principle | Concrete design rule |
|---|---|
| Intentionality over engagement | No infinite feed. Daily caps on all modes. |
| Real-world outcomes over matches | Dashboard/KPIs count attended dates, not matches. |
| Limited choice | Max 10 curated profiles per user per window. |
| Commitment has value | Tokens charged at the moment of real commitment, never for browsing. |
| Reduce fatigue | Outside the window, the app is deliberately quiet. |
| Women-first trust | Women control acceptance; contact details never auto-shared. |
| Not punitive to men | Proposals are free to send; tokens only on success. |
| Human + technology | Software matches; humans curate the date. |

---

## 6. High-Level User Journey

```
Launch → Register → Verify → Build Profile → Set Preferences → Set Availability
   → Home (pre-window countdown)
   → 19:00 Window Opens → Choose Mode
        ├─ Mode A: Calls → matched → live call → mutual interest? → Date
        ├─ Mode B: Blind Date pool → system match → Date
        └─ Mode C: Curated Proposals → send → recipient accepts → Date
   → Tokens deducted → Concierge plans date → Date details confirmed
   → Reminders → Check-in → Date happens
   → Feedback (both sides) → Outcome (second date / closed)
```

---

## 7. Detailed Functional Requirements by Screen

### 7.1 Launch & Registration

| ID | Screen | Requirement | User Action | System Behaviour | Rules |
|---|---|---|---|---|---|
| REG-01 | Splash | Determine session state | — | If valid session → Home. If session but incomplete profile → resume at last onboarding step. Else → Welcome. | Onboarding progress persisted server-side so it resumes across devices |
| REG-02 | Welcome | Communicate the model before signup | Taps *Get started* / *Sign in* | — | Three-panel explainer: "One window a day", "Three ways to meet", "We plan the date". Skippable. |
| REG-03 | Sign up | Create account | Enters email+password, or Apple, or Google | Creates auth user, sends verification | Apple Sign-In mandatory if any social login offered (App Store rule) |
| REG-04 | Age gate | Enforce 18+ | Enters date of birth | Computes age; blocks <18 permanently (device+email flagged) | DOB immutable after signup; changing requires support |
| REG-05 | Phone verify | Establish one-person-one-account | Enters mobile, then SMS code | Verifies via SMS OTP; stores hashed number | One account per phone number. Blocks VOIP ranges. |
| REG-06 | Location | Confirm serviceable market | Grants location or picks city | If outside London radius → waitlist screen | Waitlist captures email; no profile creation outside market |

**Assumption:** Phone verification is mandatory at MVP. It is the cheapest high-value deterrent to duplicate and throwaway accounts, and it enables no-show accountability.

### 7.2 Identity Verification

| ID | Screen | Requirement | User Action | System Behaviour | Rules |
|---|---|---|---|---|---|
| VER-01 | Verify intro | Explain why | Taps *Verify* | — | Explains: required to participate, artefacts never shown on profile |
| VER-02 | Liveness | Prove real human | Records 3–15s liveness video following on-screen prompts | Uploads to private bucket; submits to vendor | Vendor (Persona/Stripe Identity) performs face-match + liveness |
| VER-03 | ID document | Confirm identity & age | Photographs government ID | Vendor extracts DOB, compares to entered DOB | DOB mismatch >0 days → manual review, not auto-reject |
| VER-04 | Pending | Set expectation | — | Status `pending`; user may complete profile meanwhile | Cannot enter any interaction window until `verified` |
| VER-05 | Result | Communicate outcome | — | `verified` → badge + window access. `rejected` → reason + one retry. Second rejection → manual appeal only | Push notification on state change |

**VER-06 (Rule):** Verification is a **hard gate on participation**, not on registration. Users can browse their own profile and buy tokens while pending, but cannot enter the window, send proposals, or join pools.

### 7.3 Profile Creation

Delivered as a **6-step wizard with a visible progress bar**. Each step is individually saved; the user may exit and resume. Target completion time: **7–9 minutes**.

| Step | Fields | Mandatory | Visibility |
|---|---|---|---|
| 1. Basics | First name, DOB (from REG-04), gender, height, job title, education | Name, DOB, gender mandatory | Public (age shown, not DOB) |
| 2. Photos | 3–6 photos | Min 3 | Public |
| 3. Voice note | 20–30s audio: "What are you actually looking for?" | Mandatory | Public (see PROF-04) |
| 4. Intent | Relationship intention, timeline, children stance, relocation openness | All mandatory | Public |
| 5. Character | Social energy slider, weekend personality, communication style, 3 values, 5 interests, 2 written prompts | All mandatory | Public |
| 6. Dating logistics | Preferred date styles, budget comfort, areas, spontaneity comfort, dietary/accessibility needs | Date styles + areas mandatory | **Private** — matching + concierge only |

| ID | Requirement | Detail |
|---|---|---|
| PROF-01 | Minimum completion to participate | 3 photos + voice note + all mandatory fields. Progress ring on Home shows % until complete. |
| PROF-02 | No free-text bio | Replaced by structured prompts + voice note. Prevents Instagram handles, height filters, and copy-paste bios. |
| PROF-03 | Prompt library | User picks 2 of ~12 prompts, e.g. *"A great date with me looks like…"*, *"I'll always say yes to…"*, *"The thing I'm actually looking for is…"* — 200 char limit each. |
| PROF-04 | Voice note is the differentiator | Mandatory. Playable on any profile card. Cannot be replaced by text. Screened by moderation (PROF-07). Rationale: voice conveys warmth and effort, and is far harder to fake or outsource than photos. |
| PROF-05 | Video intro | **Optional** at MVP; earns a "Made an effort" signal used in ranking. Phase 2: mandatory for Mode C senders. |
| PROF-06 | Deal-breakers | Up to 3, private, applied as **hard filters** in matching. |
| PROF-07 | Moderation on upload | Every photo, voice note and video screened automatically before going live. Flagged → held, user notified, manual review within 12h. |
| PROF-08 | Edit rules | Photos/prompts editable anytime. Gender, DOB, and relationship intention require support intervention (prevents gaming the pool). |

### 7.4 Dating Preferences & Availability

| ID | Screen | Requirement | Rules |
|---|---|---|---|
| PREF-01 | Preferences | Age range, max distance (km), gender(s) sought, intention alignment | Age range max span 15 years; min age 18. Distance 1–40km. |
| PREF-02 | Preferences | Deal-breaker selection (from PROF-06) | Hard filter, both directions |
| PREF-03 | Preferences | "Open to" toggles per mode: Calls / Blind Dates / Proposals | User may disable any mode entirely; disabled modes are hidden at mode selection |
| AVAIL-01 | Availability | Weekly recurring availability grid — days × time bands (Weekday lunch / Weekday evening / Weekend day / Weekend evening) | **Mandatory before any mode.** Minimum 2 bands selected. |
| AVAIL-02 | Availability | Blackout dates (holidays etc.) | Overrides recurring availability |
| AVAIL-03 | System | Availability drives concierge scheduling and blind-date matching | Stale availability (>30 days untouched) triggers a re-confirm prompt |

### 7.5 Home Screen — three states

The Home screen is state-driven and is the app's centre of gravity.

**State 1 — Pre-window (00:00–18:59)**

| ID | Requirement |
|---|---|
| HOME-01 | Large countdown to 19:00: *"Tonight's window opens in 4h 12m"* |
| HOME-02 | Today's readiness checklist: verified ✓, profile complete ✓, availability set ✓, token balance. Any incomplete item is tappable and blocks entry. |
| HOME-03 | Upcoming confirmed dates (if any) surfaced above the fold |
| HOME-04 | Any pending proposals awaiting *your* response, with expiry countdown |
| HOME-05 | Outstanding feedback requests (blocking — see FEED-07) |
| HOME-06 | Deliberately **no** browsable profiles. Discovery is not available pre-window. |

**State 2 — Window open (19:00–21:00)**

| ID | Requirement |
|---|---|
| HOME-07 | Header switches to live state: *"Window open · 1h 47m left"* with a persistent progress bar |
| HOME-08 | Mode selection is the primary content (see 7.6) |
| HOME-09 | Live participation signal: *"312 people are online in London right now"* (bucketed, never exact if <50) |

**State 3 — Post-window (21:00–23:59)**

| ID | Requirement |
|---|---|
| HOME-10 | Summary of tonight: calls taken, proposals sent/received, outcomes |
| HOME-11 | Countdown to tomorrow's window |
| HOME-12 | Any proposals received tonight remain actionable until their 24h expiry — the window closing does **not** kill a pending proposal |

### 7.6 Daily Interaction Window

| ID | Requirement | Detail |
|---|---|---|
| WINDOW-01 | Window is 19:00–21:00 in the user's local timezone | Configurable per market via server config, not client build |
| WINDOW-02 | Entry gate | Requires: verified + profile complete + availability set + ≥1 token. Failing any → blocking sheet with the specific fix. |
| WINDOW-03 | Pre-window notification | Push at 18:45: *"Tonight's window opens in 15 minutes."* Opt-out available. |
| WINDOW-04 | Opening notification | Push at 19:00 to users who opted in and are not already in-app |
| WINDOW-05 | Late joining | Permitted at any point. No penalty. Call queue and proposal deck are both available until 21:00. |
| WINDOW-06 | Mode switching | Permitted freely **except** while in an active call or while a blind-date match is being confirmed. Switching does not refund or re-grant daily caps. |
| WINDOW-07 | Daily caps per user | Calls: max 5 connected. Blind date: 1 pool entry. Proposals: max 3 sent, max 10 profiles viewed. |
| WINDOW-08 | Window end at 21:00 | Call queue closes at 20:50 (no new matches after, so calls can complete). Any call in progress runs to its natural end. Proposal composer in progress can be submitted up to 21:05 (grace). Blind-date pool resolves at 21:00. |
| WINDOW-09 | Insufficient liquidity | If <10 eligible users are in a mode's pool, that mode's card shows *"Quiet tonight — we'll notify you when it picks up"* and entry is disabled for Calls/Blind. Mode C remains available (proposals are asynchronous). |
| WINDOW-10 | Missed window | No penalty, no streak mechanic. Deliberately: streaks would reintroduce compulsion. |

**Assumption:** The window governs **discovery**. Responding to a proposal, viewing dates, giving feedback, and buying tokens are available 24/7. Restricting *responses* to the window would strand time-sensitive proposals.

### 7.7 Mode Selection Screen

| ID | Requirement |
|---|---|
| MODE-01 | Three cards, always in the same order: Calls (cheapest) → Blind Date (medium) → Proposals (premium) |
| MODE-02 | Each card shows: name, one-line description, token cost, tonight's remaining allowance, and live availability |
| MODE-03 | Cards the user has disabled in PREF-03 are hidden entirely, not greyed |
| MODE-04 | A card whose token cost exceeds the user's balance shows *"Top up to unlock"* and routes to the wallet, rather than failing at the point of action |
| MODE-05 | Selecting a mode does not charge tokens. Charging occurs at the points defined in section 14. |

---

## 8. Mode A — Interest-Based Calls

**Purpose:** the lowest-friction way to experience a real human. Cheapest by design, and the top of the funnel into dates.

### Flow

`Mode card → Topic select → Queue → Match found → Countdown → Live call → Post-call rating → (mutual interest?) → Date trigger`

| ID | Screen | Requirement | System Behaviour | Rules |
|---|---|---|---|---|
| CALL-01 | Topic select | User picks 1–3 conversation topics from ~12 (e.g. travel, food, career, film, "what I'm looking for") | Topics become a soft matching input and the call's opening prompt | Optional; skipping means topics ignored in matching |
| CALL-02 | Audio/video toggle | User chooses audio-only or video for tonight | Both users must have selected the same medium to be matched; audio-only is default | **Assumption:** audio default lowers the barrier, especially for women. Video is opt-in on both sides. |
| CALL-03 | Queue | Shows animated waiting state + estimated wait | Server places user in pool, runs matcher every 10s | Max queue wait 3 minutes → then offers to keep waiting or exit |
| CALL-04 | Match found | Shows **limited** pre-call info: first name, age, one photo, shared topics, shared interests | 10-second countdown with *Decline* available | Declining costs nothing, returns to queue, and applies a 7-day soft avoid between the pair |
| CALL-05 | Live call | 7-minute timer, visible to both. Mute, camera toggle, end call, report. | Call connects via WebRTC. **Token charged here** (CALL-11). | Neither party's surname, photos beyond the one, or profile detail is available during the call |
| CALL-06 | Time extension | At 6:00, both are offered *"Add 5 minutes?"* | Extends only if **both** accept | One extension maximum (12 min total) |
| CALL-07 | Call end | Auto-ends at timer expiry | Both routed immediately to post-call | No lingering connection |
| CALL-08 | Post-call | Single question: *"Would you like to meet {name} in person?"* — Yes / No | Answers are **private** and never revealed if not mutual | 60-second decision window, then defaults to No |
| CALL-09 | Mutual yes | Both said yes | Full profiles unlock for both. A **date is created** and enters the concierge queue (section 15). | This is a match → date, with no chat step |
| CALL-10 | Non-mutual | One or neither said yes | Nothing is revealed to either party. Interaction closed silently. | Never communicate that the other person declined |
| CALL-11 | Charging | 1 token, charged to **both** users at the moment the call successfully connects (media flowing both ways ≥5s) | Not charged at queue entry or on a failed connection | See TOKEN-06 for failure refunds |
| CALL-12 | Disconnection <60s | Either party drops in the first 60s | Call voided, **both refunded**, both returned to queue | Repeated early drops by one user → flagged (TRUST-08) |
| CALL-13 | Disconnection >60s | Either party drops after 60s | Call ends. No refund. Post-call screen still shown to both. | The dropping user's post-call answer defaults to No |
| CALL-14 | No answer | Match found, one user doesn't tap through the countdown | Match voided, no charge, both re-queued | 3 no-answers in one window → removed from queue for that window |
| CALL-15 | Daily cap | Max 5 connected calls per user per window | Cap reached → *"That's tonight's calls. See you tomorrow."* | Prevents call-roulette behaviour |

**Assumption:** 7 minutes is long enough to sense chemistry and short enough that a bad call is cheap. Configurable server-side.

---

## 9. Mode B — App-Organised Blind Dates

**Purpose:** for users who would rather delegate than choose. *"I'm available and I trust you to find someone."*

### Flow

`Mode card → Blind date brief → Confirm & join pool → Pool closes 21:00 → Matched → Date created → Reveal at T-24h`

| ID | Screen | Requirement | System Behaviour | Rules |
|---|---|---|---|---|
| BLIND-01 | Brief | Collects, pre-filled from profile and editable per-entry: preferred dates in next 14 days, time bands, area(s), budget band (£/££/£££), date style preferences, dietary needs, accessibility needs | Persisted as this entry's constraints | Constraints are **hard** for the concierge, not suggestions |
| BLIND-02 | Confirm | Explicit commitment screen: *"If we find you a match, you're committing to attend."* Requires an explicit toggle. | Records commitment timestamp | Deliberate friction — this is the primary defence against blind-date no-shows |
| BLIND-03 | Join pool | Deducts nothing yet. User enters tonight's pool. | Pool is per-window, single entry per user | Cannot also queue for calls simultaneously while pool is resolving (post-21:00) |
| BLIND-04 | Pool resolution | At 21:00 the matcher pairs the pool | Optimises on compatibility score + overlapping availability + overlapping area + compatible budget | Users who cannot be paired are notified, not charged, and offered priority in tomorrow's pool |
| BLIND-05 | Match created | Both users notified: *"You've been matched. We're planning your date."* | **Tokens deducted from both here** (BLIND-11). Date enters concierge queue. | No profile information revealed at this point |
| BLIND-06 | Progressive reveal | T-24h before the date: first name, age, one photo, and voice note revealed to both | Push notification | **Assumption:** revealing 24h ahead reduces no-shows (the date becomes a person) while preserving the blind premise |
| BLIND-07 | Full reveal | At date start time, full profiles unlock for both | — | Enables post-date feedback and second-date decisions |
| BLIND-08 | Cancellation ≥48h before | User cancels | Full token refund. Other user notified, offered priority rematch. | 2 cancellations in 60 days → blind mode suspended 30 days |
| BLIND-09 | Cancellation <48h | User cancels | **No refund.** Other user fully refunded + priority rematch + apology comms. | Recorded as a reliability signal |
| BLIND-10 | No-show | Reported by the attending user post-date | No-show pays nothing back; attendee fully refunded + 1 bonus token. | 1 no-show → warning. 2 → 90-day suspension from blind mode. 3 → account review. |
| BLIND-11 | Charging | 6 tokens, both users, at match creation (BLIND-05) | — | See section 14 |

---

## 10. Mode C — Curated Date Proposals

**Purpose:** maximum control, maximum intentionality, highest cost. This is the flagship mechanic.

**Design constraint:** this must not read as swiping. There is no left/right gesture, no like button, and no match celebration.

### 10.1 Browsing

| ID | Screen | Requirement | Rules |
|---|---|---|---|
| PROP-01 | Deck | Max **10** profiles per user per window, delivered as a vertical list of rich cards — not a swipe stack | Deck is generated at window open and fixed for the night. No refresh, no "get more". |
| PROP-02 | Card content | Photos (carousel), first name, age, area, intention, 3 values, 5 interests, voice note player, shared-interest highlights | Compatibility framed qualitatively (*"You both want something serious and both love live music"*) — **never** a percentage score |
| PROP-03 | Profile detail | Full-screen view: all photos, both prompts, voice note, video if present, intention, lifestyle | Reached by tapping a card |
| PROP-04 | Actions | Two only: **Pass** or **Propose a date** | Pass is silent, permanent for that user, removes the card. No "undo" — deliberate. |
| PROP-05 | No like button | There is no low-effort positive action | This is the core differentiator; effort is the filter |

### 10.2 Composing a Proposal

Presented as a short guided flow, ~90 seconds. Progress indicator; all steps required.

| ID | Step | Requirement | Rules |
|---|---|---|---|
| PROP-06 | Date style | Pick 1–3 from a curated set (cocktails, coffee & walk, exhibition, comedy, mini-golf, dinner, activity, live music) | Multiple choices increase acceptance probability and give the concierge latitude |
| PROP-07 | Availability | Availability planner: pick days in the next 14 and time slots within each | Minimum 3 total slots required — single-slot proposals convert poorly and constrain the concierge |
| PROP-08 | Area | 1–3 preferred areas | Pre-filled from profile, editable |
| PROP-09 | Budget | Select band (£/££/£££) | Sets concierge budget envelope |
| PROP-10 | Personal note | 200 chars max, mandatory, with a structured starter: *"I'd like to take you out because…"* | Enforced max prevents essays; enforced min (40 chars) prevents "hey" |
| PROP-11 | Review & send | Shows exactly what the recipient will see | Sending is free (PROP-14) |

### 10.3 Receiving a Proposal

| ID | Screen | Requirement | System Behaviour | Rules |
|---|---|---|---|---|
| PROP-12 | Inbox | Pending proposals with expiry countdown | Push on receipt | Max 5 pending inbound at once; further proposals to that user are blocked with *"{name} has a full inbox tonight"* — protects women from flooding |
| PROP-13 | Proposal detail | Full sender profile + their note + offered date styles + their availability grid + area + budget | — | Framed as an invitation, not a like: *"José would like to take you out. He's free Thu or Sat evening and suggested cocktails, an exhibition, or mini-golf."* |
| PROP-14 | Send cost | **0 tokens to send** | Sender's tokens are **held** (see PROP-18), not charged | Rationale: charging to send punishes effort and suppresses supply |
| PROP-15 | Decline | Recipient declines | Sender's hold released immediately. Sender told only *"{name} isn't available"* — never a rejection framing. | No reason required; optional private reason feeds matching |
| PROP-16 | Expiry | 48 hours from send | Auto-declines. Hold released. Both notified. | Expiry is generous because the recipient may not be in the next window |
| PROP-17 | Accept | Recipient accepts and selects **one** offered slot | Charge executes (PROP-18) → match confirmed → full profiles unlock both ways → date enters concierge queue | Selecting a slot is mandatory at acceptance |
| PROP-18 | Charging | **12 tokens each**, deducted from **both** at the moment of acceptance | At send: sender's 12 tokens are placed on **hold** (reserved, not spent). At acceptance: sender's hold converts to a charge and recipient is charged. | See the assumption below |
| PROP-19 | Recipient has insufficient tokens | Accept is attempted with <12 tokens | Accept button becomes *"Top up to accept"*; proposal is preserved and its expiry **paused for up to 24h** while they top up | Never lose a match to a payment wall |
| PROP-20 | Sender's hold cannot be honoured | Edge case: hold released by refund dispute etc. | Proposal voided; recipient told *"This proposal is no longer available"* | Recipient is never blamed or charged |
| PROP-21 | Daily caps | Max 3 proposals sent per window; max 10 profiles viewed | Enforced server-side | Scarcity forces genuine selection |

**Assumption (important):** Tokens are **held at send, charged at acceptance**. The brief specifies tokens must not be *charged* for sending; a hold is a reservation, fully released on decline or expiry, and it eliminates the failure mode where a sender's balance has been spent elsewhere by the time the recipient accepts. This is flagged in Open Product Decisions as it has commercial implications (it caps concurrent outbound proposals at balance ÷ 12).

---

## 11. Matching & Compatibility Logic

Applied consistently across all three modes.

**Hard filters (exclusionary — a user failing any is never surfaced):**

| ID | Filter |
|---|---|
| MATCH-01 | Mutual gender preference satisfied |
| MATCH-02 | Mutual age range satisfied |
| MATCH-03 | Within mutual max distance |
| MATCH-04 | Both `verified` |
| MATCH-05 | Neither has blocked the other |
| MATCH-06 | No deal-breaker of either party violated |
| MATCH-07 | Not previously matched/passed within cool-off (Pass: permanent; Call decline: 7 days; completed date: permanent unless mutual second-date interest) |
| MATCH-08 | Both active in the last 14 days |

**Soft scoring (ranks the surviving candidates, 0–100):**

| Signal | Weight | Rationale |
|---|---|---|
| Relationship intention alignment | 25 | The single strongest predictor of a good outcome for this audience |
| Availability overlap | 20 | A date that can't be scheduled is worthless |
| Shared interests & values | 20 | Conversation quality |
| Date-style overlap | 10 | Concierge feasibility |
| Geographic convenience | 10 | Attendance rate |
| Reliability signal (TRUST-09) | 10 | Protects good users from unreliable ones |
| Profile effort (video, voice quality, completeness) | 5 | Rewards effort |

| ID | Requirement |
|---|---|
| MATCH-09 | Compatibility is **never** exposed as a number or percentage to users. It is expressed qualitatively or not at all. |
| MATCH-10 | Deck diversity: no more than 4 of 10 curated profiles may share the same primary interest cluster |
| MATCH-11 | Exposure fairness: a daily cap on how many times any one profile can appear across all decks, preventing winner-take-all dynamics |
| MATCH-12 | New-user boost: first 3 windows, a modest ranking uplift to seed initial interactions |

---

## 12. Token Economy

### 12.1 Pricing

| Interaction | Cost per user | Charged when | Rationale |
|---|---|---|---|
| Call | **1** | On successful connect | Cheap enough to try repeatedly; funnel entry |
| Blind date | **6** | At match creation | Real commitment, but user delegated choice |
| Accepted proposal | **12** | At acceptance, both sides | Maximum control and selectivity commands the highest price |

Ratio **1 : 6 : 12** — a date costs roughly an order of magnitude more than a call, and full control costs double delegation.

| ID | Requirement |
|---|---|
| TOKEN-01 | New users receive **12 free tokens** on completing verification — exactly enough to complete one full date journey, or ~12 calls. Rationale: every new user should be able to experience the core value once before paying. |
| TOKEN-02 | Both participants always pay the same amount for the same interaction (see Open Decisions re asymmetric pricing) |
| TOKEN-03 | Tokens never expire |
| TOKEN-04 | Tokens are non-transferable and non-refundable for cash |
| TOKEN-05 | Purchase via Apple IAP / Google Play Billing (mandatory — tokens are a digital good) |

### 12.2 Refund Matrix

| ID | Event | Sender/User A | Recipient/User B |
|---|---|---|---|
| TOKEN-06 | Call fails to connect | Full refund | Full refund |
| TOKEN-07 | Call drops <60s | Full refund | Full refund |
| TOKEN-08 | Call drops >60s | No refund | No refund |
| TOKEN-09 | Proposal declined | Hold released (no charge) | Not charged |
| TOKEN-10 | Proposal expires | Hold released | Not charged |
| TOKEN-11 | Blind date — no match found | Not charged | — |
| TOKEN-12 | Date cancelled ≥48h ahead by A | Full refund to both | Full refund to both |
| TOKEN-13 | Date cancelled <48h ahead by A | **No refund to A** | Full refund to B |
| TOKEN-14 | No-show by A | No refund to A | Full refund to B **+1 bonus token** |
| TOKEN-15 | Aura cancels (venue failure, ops error) | Full refund both **+2 bonus tokens each** | Same |
| TOKEN-16 | Both cancel / mutual | Full refund both | Full refund both |
| TOKEN-17 | Safety report upheld | Reporter fully refunded | Reported user forfeits |

### 12.3 Wallet Screens

| ID | Screen | Requirement |
|---|---|---|
| TOKEN-18 | Wallet | Balance, tokens **on hold** (shown separately and explained), buy CTA, history link |
| TOKEN-19 | Purchase | 4 bundles with clear per-token value; largest bundle flagged best value. No subscription at MVP. |
| TOKEN-20 | History | Every credit and debit with date, type, counterpart first name, and running balance. Refunds clearly labelled with reason. |
| TOKEN-21 | Low balance | When balance < cost of the cheapest enabled mode, a non-blocking prompt appears on Home |

---

## 13. Date Concierge — Operations Workflow

This is the human layer. It is **not automatable at MVP** and the ops cost must be understood as part of unit economics.

### Date lifecycle states

```
CREATED → PLANNING → PROPOSED → CONFIRMED → REMINDED → IN_PROGRESS
        → COMPLETED → FEEDBACK_PENDING → CLOSED
        (any state → CANCELLED / NO_SHOW)
```

| ID | Stage | Owner | SLA | Detail |
|---|---|---|---|---|
| OPS-01 | CREATED | System | Instant | Triggered by mutual call interest, blind match, or proposal acceptance. Both users see *"We're planning your date."* |
| OPS-02 | PLANNING | Ops | **12 working hours** | Ops console shows both users' merged constraints: availability intersection, areas, budget, date styles, dietary, accessibility |
| OPS-03 | Venue selection | Ops | — | Chosen from a curated venue database (name, area, category, price band, dietary suitability, accessibility, booking method, ops notes). Never an ad-hoc web search. |
| OPS-04 | Booking | Ops | — | Ops books under a house reservation where possible. Venue is told it's an Aura booking, not a blind date. |
| OPS-05 | PROPOSED | System | — | Both users receive: venue, address, date, time, what to expect, price expectation, and who pays (per PROP-09 budget + payment convention) |
| OPS-06 | Confirmation | Users | 24h to respond | **Both** must confirm. One rejection → back to PLANNING with a note (max 2 replans, then cancel + full refunds) |
| OPS-07 | CONFIRMED | System | — | Calendar invite, map link, and reminders scheduled |
| OPS-08 | Venue falls through | Ops | ASAP | Ops rebooks and notifies. If <12h to date and no alternative → cancel + TOKEN-15 |
| OPS-09 | Escalation | Ops | — | Any safety report during an active date escalates immediately to on-call ops |

**Ops console requirements (internal web tool, ADMIN-01…07 in section 20):** date queue by state and SLA, merged user constraints, venue database with search/filter, one-click propose, comms templates, cancellation/refund actions with reason codes, no-show adjudication.

**Capacity assumption:** one ops coordinator can plan ~40 dates/day. This caps London launch throughput and should govern how aggressively pools are filled.

---

## 14. Confirmed Date Journey

| ID | Screen | Requirement | Rules |
|---|---|---|---|
| DATE-01 | Planning | Status card: *"We're planning your date with {name}"* + expected timeframe | No venue shown yet |
| DATE-02 | Proposed | Venue name, photo, address, area, date, time, category, what to expect, price band, payment convention | Accept / Request change |
| DATE-03 | Request change | Structured reasons: time doesn't work / area / venue type / other | Returns to OPS-06 |
| DATE-04 | Confirmed | Full detail + Add to calendar + Directions + Contact Aura + Cancel | Calendar event created with venue and time |
| DATE-05 | Reminders | 48h before (with reveal for blind dates), 24h before, 3h before, 30min before | Push; user-configurable |
| DATE-06 | Pre-date messaging | **Limited structured messaging unlocks 24h before**: templated messages only ("Running 10 min late", "I'm here", "Something's come up") plus 3 free-text messages each, max 200 chars | **Assumption:** full open chat re-creates the fatigue the product exists to remove; zero communication makes running-late scenarios hostile. Templates plus a hard cap solve both. |
| DATE-07 | Contact details | Phone numbers and surnames are **never** shared by the app, at any stage | Users may share personally after the date |
| DATE-08 | Check-in | 15 min after start time, both prompted: *"Are you there?"* | Fires the safety flow if one checks in and the other doesn't (TRUST-11) |
| DATE-09 | Safety during date | Persistent, discreet SOS entry point on the active date screen: call 999, alert trusted contacts with live location | Trusted contacts stored locally, set up in Safety Centre |
| DATE-10 | Cancellation | Requires a reason; shows the refund consequence **before** confirming | Applies TOKEN-12/13 |
| DATE-11 | Post-date | 3h after start → moves to FEEDBACK_PENDING | Triggers FEED-01 |

---

## 15. Post-Interaction Feedback

| ID | Interaction | Questions | Timing |
|---|---|---|---|
| FEED-01 | Date (any origin) | 1. Did they attend? (Yes / No / I couldn't make it) 2. Did they match their profile? 3. Did you feel comfortable and safe? 4. Would you like to see them again? 5. How was the venue? 6. Optional private comment | Prompted 3h after start; reminder next morning |
| FEED-02 | Call | Already captured at CALL-08. Optional: *"Anything we should know?"* | Immediate |
| FEED-03 | Cancelled | Single question: *"Was this handled well?"* | On cancellation |
| FEED-04 | No-show reported | Structured follow-up + optional evidence | Immediate, escalated to ops |

| ID | Requirement |
|---|---|
| FEED-05 | All feedback is **private**. The other person never sees any answer, score, or comment. |
| FEED-06 | Mutual "would like to see them again" → both notified, second date offered at **50% token cost** (6 tokens each). Rationale: reward the outcome the product exists to produce. |
| FEED-07 | Feedback on a completed date is **blocking**: the user cannot enter a new window until submitted. Rationale: no-show and safety detection depend on near-100% response rates. Escapable via an explicit "Skip" that still records attendance. |
| FEED-08 | Feedback feeds: matching weights, reliability signal, venue quality scoring, and trust & safety review |
| FEED-09 | "Did not feel safe" triggers immediate T&S review regardless of other answers |
| FEED-10 | After feedback from both sides, interaction → CLOSED |

---

## 16. Trust, Safety & Moderation

| ID | Requirement | Detail |
|---|---|---|
| TRUST-01 | Mandatory ID + liveness verification | Hard gate on participation (VER-06) |
| TRUST-02 | Mandatory phone verification | One account per number |
| TRUST-03 | Automated media moderation | All photos, voice notes, videos screened pre-publication |
| TRUST-04 | Report | Available on: profile, in-call, proposal, active date, past interaction. Structured reasons + optional detail. |
| TRUST-05 | Block | Immediate, mutual, permanent. Blocked users never appear in any pool for each other. |
| TRUST-06 | In-call safety | One-tap end + report. Reported calls retain metadata (not content) for 90 days. |
| TRUST-07 | No public ratings | There is **no** visible score, rating, or review of any person, anywhere. Non-negotiable. |
| TRUST-08 | Behavioural signals (internal only) | No-shows, late cancellations, early call drops, reports received, feedback patterns, decline rates |
| TRUST-09 | Reliability signal | Internal 0–100, feeds MATCH ranking. Never shown to anyone, including the user themselves. |
| TRUST-10 | Enforcement ladder | Warning → mode suspension → full suspension → ban. Every step logged with reason and reviewer. |
| TRUST-11 | Asymmetric check-in | One person checks in, the other doesn't respond within 20 min → welfare push to both; if still nothing, ops alerted |
| TRUST-12 | Safety Centre | Trusted contacts, safety guidance, SOS setup, blocked list, reporting history |
| TRUST-13 | Data minimisation | Surname, phone, exact address and DOB are never shown to another user under any circumstance |
| TRUST-14 | Account deletion | In-app, server-side, cascades all personal data. Retained only where legally required. |

---

## 17. Notifications

| ID | Trigger | Timing | Default |
|---|---|---|---|
| NOTIF-01 | Window opening soon | 18:45 | On |
| NOTIF-02 | Window open | 19:00 | On |
| NOTIF-03 | Proposal received | Immediate | On (not mutable — time-sensitive) |
| NOTIF-04 | Proposal expiring | 6h before expiry | On |
| NOTIF-05 | Proposal accepted | Immediate | On (not mutable) |
| NOTIF-06 | Blind match created | Immediate | On |
| NOTIF-07 | Blind reveal | T-24h | On |
| NOTIF-08 | Date proposed by ops | Immediate | On (not mutable) |
| NOTIF-09 | Date reminders | 48h / 24h / 3h / 30min | Configurable |
| NOTIF-10 | Feedback due | 3h after date + next morning | On |
| NOTIF-11 | Mutual second-date interest | Immediate | On |
| NOTIF-12 | Verification result | Immediate | On |
| NOTIF-13 | Quiet hours | No non-critical notifications 22:00–08:00 | Enforced server-side |

---

## 18. Internal Admin / Operations Requirements

| ID | Requirement |
|---|---|
| ADMIN-01 | **Date queue** — all dates by state, sorted by SLA breach risk; assignment to coordinators |
| ADMIN-02 | **Date detail** — merged constraints of both users, availability intersection visualised, previous dates for each, dietary/accessibility flags |
| ADMIN-03 | **Venue database** — CRUD, filter by area/category/price/dietary/accessibility, booking contact, ops notes, historical feedback score |
| ADMIN-04 | **Verification review** — manual queue for vendor-inconclusive cases |
| ADMIN-05 | **Moderation queue** — flagged media with approve/reject and user notification |
| ADMIN-06 | **Trust & safety console** — reports, user history, enforcement actions with mandatory reason codes and audit trail |
| ADMIN-07 | **Token adjustments** — manual credit/refund with reason code; every adjustment audited |
| ADMIN-08 | **Window configuration** — per-market window times, caps, token prices, without an app release |
| ADMIN-09 | **Liquidity dashboard** — live pool sizes per mode, match rates, unmatched users |

---

## 19. Important Edge Cases

| ID | Case | Behaviour |
|---|---|---|
| EDGE-01 | User's tokens spent elsewhere between sending and acceptance | Prevented by the hold model (PROP-18) |
| EDGE-02 | Both users propose to each other in the same window | First acceptance wins; the second proposal auto-voids with holds released and both are told they matched |
| EDGE-03 | User accepts a proposal, then a blind match is also created | Both proceed. Ops flags to avoid same-week scheduling collisions. |
| EDGE-04 | User deletes account with a confirmed upcoming date | Date cancelled, counterpart fully refunded + 2 bonus tokens + apology comms |
| EDGE-05 | Verification revoked after matching | Date cancelled, counterpart fully refunded, matches suspended |
| EDGE-06 | Timezone change (user travels) | Window follows the user's device timezone. Existing dates keep London time. |
| EDGE-07 | Window opens while user is mid-onboarding | Access blocked until profile complete; they can complete and join late |
| EDGE-08 | Both users no-show | Neither refunded; both receive a reliability penalty |
| EDGE-09 | Venue closed on arrival | Ops-caused → TOKEN-15 applies; users prompted to a nearby alternative where possible |
| EDGE-10 | User in an active call at 21:00 | Call completes normally; post-call flow unaffected |
| EDGE-11 | Recipient inbox full (5 pending) | Further proposals blocked before composition begins, so no effort is wasted |
| EDGE-12 | Under-18 detected post-verification | Immediate permanent ban, all data purged, any counterpart dates cancelled with full refunds |
| EDGE-13 | Fewer than 2 users in blind pool | No match, nobody charged, priority granted tomorrow |
| EDGE-14 | Payment refund/chargeback after tokens spent | Balance may go negative; account frozen for interactions until cleared |

---

## 20. MVP Scope

**In scope**

- Registration, phone + ID/liveness verification, 6-step profile with mandatory voice note
- Preferences, deal-breakers, weekly availability
- Daily window (19:00–21:00) with all three states
- **All three modes** — the model is incoherent with fewer, since the token ladder needs all three rungs
- Matching engine (hard filters + weighted scoring)
- Token economy: balances, holds, purchase via IAP, full refund matrix, history
- Concierge workflow with internal ops console
- Confirmed date journey with reminders, check-in, limited pre-date templated messaging
- Feedback for calls and dates; mutual second-date discount
- Trust & safety: report, block, SOS, trusted contacts, enforcement ladder
- London only, iOS only

**Explicitly out of MVP**

- Open-ended chat (deliberate, likely permanent)
- Android
- Subscriptions
- Group/double dates
- In-app venue payment
- Automated venue booking (ops does it manually)
- Multi-city

---

## 21. Phase 2 Candidates

Ranked by expected value:

1. **Semi-automated concierge** — venue recommendation engine proposing 3 options for one-click ops approval. Directly relieves the MVP's hardest scaling constraint.
2. **Second-date flow** — dedicated, discounted, streamlined re-booking. Cheapest possible growth from existing successful matches.
3. **Curated group events** — 6–8 verified members at a real venue. Adds a lower-pressure entry point and a new revenue line.
4. **Video intro mandatory for proposal senders** — raises effort floor on the premium mode.
5. **Ops-suggested proposals** — Aura suggests who to propose to, with reasoning.
6. **Multi-city + configurable windows per market.**
7. **Reliability tiers with genuine perks** (early window access, priority planning) — never a public score.
8. **Android.**

---

## 22. Key Metrics

**North star: attended dates per active user per month.**

| Layer | Metric | Why |
|---|---|---|
| Funnel | Window participation rate | Is the window mechanic working? |
| Funnel | Interaction → date conversion, by mode | Which mode actually produces dates? |
| Funnel | Date confirmation rate | Is the concierge proposing good dates? |
| **Outcome** | **Attendance rate** | The number that matters |
| Outcome | Mutual second-date rate | Quality of matching |
| Quality | "Felt safe" rate | Non-negotiable floor |
| Quality | Profile-accuracy rate | Catfishing / misrepresentation |
| Commercial | Tokens per paying user per month; free-to-paid conversion | |
| Ops | Dates planned per coordinator per day; SLA adherence | Scaling constraint |
| Health | Women's 30-day retention (tracked separately) | The supply side that determines viability |

**Deliberately not tracked as success:** session length, sessions per day, matches, swipes.

---

## 23. Open Product Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **Symmetric pricing?** Should women pay the same as men? | Symmetric / women free or discounted / women earn tokens by attending | Launch symmetric; instrument closely. If female supply is the constraint (likely), move to women-discounted. This is the single highest-leverage commercial decision. |
| 2 | Token hold on proposals | Hold (recommended) / no hold | Hold. Eliminates EDGE-01, but caps concurrent proposals — validate that 3/window × 12 tokens isn't punitive |
| 3 | Window timing | 19:00–21:00 / longer / two windows | Launch 19:00–21:00; A/B a weekend afternoon window |
| 4 | Blocking feedback (FEED-07) | Blocking / nagging only | Blocking, with a visible skip. Revisit if it drives churn. |
| 5 | Pre-date messaging scope | Templates + 3 free-text (recommended) / templates only / none | As recommended; monitor for abuse |
| 6 | Voice note mandatory | Mandatory (recommended) / optional | Mandatory. It is the profile differentiator and a strong effort filter — but it *will* reduce signup completion. Measure the drop-off. |
| 7 | Blind-date reveal timing | T-24h (recommended) / at venue / never before | T-24h balances no-show reduction against the blind premise |
| 8 | Who pays on the date | Splitting default / sender pays / stated per proposal | State expectation at proposal time; never enforce in-app |
| 9 | Call medium default | Audio (recommended) / video | Audio default, video mutual opt-in |
| 10 | Concierge cost recovery | Absorbed in token price / separate booking fee | Absorb at MVP; revisit once cost per planned date is measured |

---

## 24. Assumptions Register

| # | Assumption | Impact if wrong |
|---|---|---|
| A1 | Phone + ID verification is acceptable friction for this audience | Signup completion collapses; would need to defer ID to pre-first-date |
| A2 | Users will accept a 2-hour daily window | Core mechanic fails; would need a longer or dual window |
| A3 | Tokens held (not charged) at proposal send satisfies the "free to send" requirement | Rework charging model |
| A4 | 7-minute calls are the right length | Tune server-side; low cost to change |
| A5 | Ops can plan ~40 dates/coordinator/day | Unit economics and launch throughput change materially |
| A6 | Revealing blind dates at T-24h reduces no-shows more than it dilutes the concept | A/B testable |
| A7 | Responses to proposals should be available outside the window | Otherwise time-sensitive proposals strand |
| A8 | 12 free tokens (one full date) is the right onboarding grant | Adjust based on free-to-paid conversion |
| A9 | Both parties paying is acceptable to women | See Open Decision 1 — most likely assumption to be wrong |

---

## 25. Glossary

| Term | Definition |
|---|---|
| **Window** | The daily 19:00–21:00 period when discovery is available |
| **Mode** | One of the three interaction types (Calls / Blind Date / Proposals) |
| **Proposal** | A structured date invitation sent in Mode C |
| **Hold** | Tokens reserved against a pending proposal, not yet spent |
| **Concierge** | The internal ops team that plans and books real dates |
| **Reliability signal** | Internal-only behavioural score; never displayed |
| **Reveal** | The staged disclosure of a blind-date match's identity |
