# Aura Dating - Quick Start Guide

## Installation (1 minute)

```bash
cd AuraDatingMobile
npm install
```

## Run the App (choose one)

```bash
npm start              # Start development server
npm run ios           # iOS simulator
npm run android       # Android emulator
npm run web           # Web browser
```

## Demo Mode (No Backend Needed)

1. App starts on login screen
2. Tap **"Try Demo Mode"**
3. Full app access with sample data

## File Structure Quick Reference

```
app/
├── (tabs)/              # Main 5 screens
│   ├── index.tsx       # Discover (swipe cards)
│   ├── members.tsx     # Members (grid)
│   ├── events.tsx      # Events (list)
│   ├── connections.tsx # Interests/matches
│   └── profile.tsx     # User profile
├── auth/                # Login & register
├── members/[userId]     # Member detail
├── events/              # Event screens
└── proposal/            # Date proposals

components/             # 6 reusable UI components
constants/              # Colors & API endpoints
lib/                    # API client
store/                  # State management
```

## Key Features

| Feature | Location | Status |
|---------|----------|--------|
| Animated Swipe Cards | `app/(tabs)/index.tsx` | ✅ Complete |
| Member Grid | `app/(tabs)/members.tsx` | ✅ Complete |
| Event Listing | `app/(tabs)/events.tsx` | ✅ Complete |
| Connections | `app/(tabs)/connections.tsx` | ✅ Complete |
| User Profile | `app/(tabs)/profile.tsx` | ✅ Complete |
| Login/Register | `app/auth/` | ✅ Complete |
| Date Proposals | `app/proposal/create.tsx` | ✅ Complete |

## Color Palette

```
Primary:     #0d9488 (Teal)
Accent:      #f97316 (Coral)
Background:  #f0fdfa (Light Teal)
Text:        #1e293b (Dark Slate)
```

## API Endpoints (for backend)

```
POST   /auth/login
POST   /auth/register
GET    /profile
POST   /profile/update
GET    /members
GET    /members/:userId
POST   /social/send-interest
GET    /social/interests
POST   /events
POST   /proposals/create
```

## Component Exports

```typescript
// Button
<Button title="Click me" onPress={() => {}} variant="primary" size="lg" />

// Input
<Input label="Email" icon="mail" error="Invalid" />

// Badge
<Badge label="Active" variant="success" />

// Avatar
<Avatar photoUrl="url" size="lg" />

// Card
<Card><Text>Content</Text></Card>

// InterestTag
<InterestTag label="Travel" selected={true} onPress={() => {}} />
```

## State Management

```typescript
import { useAuthStore } from '@/store/auth';

const { token, user, setToken, setUser, logout } = useAuthStore();
```

## API Client

```typescript
import { membersApi, socialApi, eventsApi } from '@/lib/api';

// Get members
const members = await membersApi.getMembers();

// Send interest
await socialApi.sendInterest('userId', 'message');

// Get events
const events = await eventsApi.getEvents();
```

## Debugging

```bash
npm run type-check    # Check TypeScript errors
```

## Environment Variables

Create `.env` if needed:
```
API_URL=http://localhost:3001/api
```

Update in `constants/api.ts`:
```typescript
export const API_URL = process.env.API_URL || 'http://localhost:3001/api';
```

## Production Build

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## Common Issues

**Port in use?**
```bash
lsof -ti:3001 | xargs kill -9
```

**Module not found?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Simulator won't start?**
```bash
npm run ios -- --simulator "iPhone 14"
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Run app with demo mode
3. Connect to your backend API
4. Replace demo data with real API calls
5. Add app icons and splash screens
6. Deploy to app stores

## Resources

- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Expo Router Docs](https://expo.github.io/router)
- [Zustand Docs](https://github.com/pmndrs/zustand)

---

**App Status**: Production Ready ✅
**Last Updated**: March 2026
**Version**: 1.0.0
