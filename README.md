# Aura — London dating, curated

> One hand-picked proposal a day. No infinite swiping. No endless chat. Real, tailored connections — across London.

Aura is the women-first London dating app. Women receive **one curated date proposal per day** from verified men, hand-picked by our matchmakers. There's no chat — only real plans at real London venues.

## The three pillars

1. **No infinite swiping** — one curated proposal per day, that's it
2. **No endless chat** — women accept or pass; accepted proposals become real dates with real plans
3. **Real, tailored connections** — every proposal is hand-picked at a real London venue (postcode, tube station, time, who pays, all decided)

## Tech stack

- **React Native + Expo SDK 54** (managed workflow)
- **TypeScript**
- **Expo Router v6** — file-based routing
- **Zustand** + AsyncStorage / SecureStore — state with persistence
- **Native integrations**: Face ID/Touch ID (`expo-local-authentication`), Calendar (`expo-calendar`), Location (`expo-location`), Notifications (`expo-notifications`), Image picker, Linear gradient, Maps via Linking

## Getting started

### Prerequisites
- Node.js 18 or 20
- An iPhone or Android phone with [Expo Go](https://expo.dev/go) installed
- Same WiFi network for phone + dev machine (LAN), OR an [ngrok](https://ngrok.com) authtoken (Tunnel)

### Install

```bash
npm install --legacy-peer-deps
```

### Run (LAN — same WiFi)

```bash
npx expo start --lan
```

Scan the QR code with **Expo Go**.

### Run (Tunnel — different network or mobile data)

```bash
# One-time: configure your ngrok authtoken
ngrok config add-authtoken <your-authtoken>

# Then start
npx expo start --tunnel
```

## Project structure

```
app/
├── (tabs)/                    # Bottom tab screens
│   ├── _layout.tsx            # Tab bar config
│   ├── index.tsx              # Today — single curated proposal
│   ├── connections.tsx        # Dates — upcoming + past
│   ├── events.tsx             # Curated London group events
│   └── profile.tsx            # Hinge-style profile + settings hub
├── auth/                      # Login, register, onboarding
├── verify/                    # Biometric + selfie + liveness flow
├── settings/                  # Notifications, privacy, preferences, safety, subscription
├── events/                    # Event detail + create modals
├── proposal/                  # Date proposal compose modal
└── _layout.tsx                # Root navigator + boot sequence

components/                    # Avatar, Button, Card, Input, Badge, InterestTag
constants/
├── colors.ts                  # "Velvet" palette: deep rose + champagne gold + aubergine + cream
├── london.ts                  # 22 London neighbourhoods + 24 curated venues with coords
└── api.ts                     # API endpoints
lib/
├── api.ts                     # Axios client + auth interceptors
├── location.ts                # Real GPS, Haversine distance, UK formatting
├── calendar.ts                # Add dates to device calendar with reminders
├── notifications.ts           # Push registration + scheduled reminders
├── maps.ts                    # Open native Maps with venue coords
└── format.ts                  # UK locale date/time + greeting helpers
store/
├── auth.ts                    # User + token (SecureStore-persisted)
├── proposals.ts               # Daily proposals (AsyncStorage-persisted)
└── dates.ts                   # Confirmed + past dates (AsyncStorage-persisted)
```

## Key features built

### Already working
- ✅ Biometric verification flow (Face ID / Touch ID + selfie + liveness)
- ✅ One curated London proposal per day, deterministic per-day rotation
- ✅ Accept proposal → adds to phone calendar → schedules push reminders (2h + 30 min before)
- ✅ Real London venues (Padella, Dishoom, Tate Modern, Hampstead Heath, Lyaness, Connaught Bar…)
- ✅ Maps integration — "Directions" opens Apple/Google Maps with venue coords
- ✅ All settings screens: Date preferences, Notifications, Privacy, Safety, Subscription
- ✅ "Velvet" palette — deep rose + champagne gold + warm cream
- ✅ Persistent state across app restarts

### To do
- [ ] Real backend (replace seed data with API)
- [ ] Push notifications via dev client (Expo Go has SDK 53+ limitations)
- [ ] Photo upload
- [ ] Onboarding flow with location permission
- [ ] Men's app (separate flow for proposers)
- [ ] Production build for App Store / Play Store

## Environment

The app reads `lib/api.ts` baseURL from a constant. For local server testing, run the optional Express backend in `server/` (see `server/README.md`).

## Conventions

- **Branches**: `main` is protected · feature branches like `feat/today-screen` · PRs reviewed before merge
- **Commits**: Conventional commits style (`feat:`, `fix:`, `chore:`, `docs:`)
- **Code style**: TypeScript strict; no implicit `any`; functional React components; Zustand for global state, local `useState` for component state

## License

Private — all rights reserved.
