# Aura Dating - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd AuraDatingMobile
npm install
```

### 2. Run the Development Server

```bash
npm start
```

### 3. Launch on Device/Simulator

After running `npm start`, you'll see options to:

**iOS Simulator (Mac)**
```bash
npm run ios
```

**Android Emulator**
```bash
npm run android
```

**Web Browser**
```bash
npm run web
```

## Demo Mode (No Backend Required)

The app includes a full-featured demo mode that works completely offline:

1. Open the app
2. On the login screen, tap **"Try Demo Mode"**
3. You'll be logged in with demo data
4. Explore all features: Discover, Members, Events, Connections, Profile

The demo includes:
- 5 sample member profiles
- 5 sample events
- Sample connections and matches
- Full navigation and interactions

## Backend Integration

To connect to your own backend:

### 1. Ensure Backend is Running

Your backend should be running on `http://localhost:3001/api`

### 2. Update API URL (if needed)

Edit `constants/api.ts`:

```typescript
export const API_URL = 'http://your-backend-url:3001/api';
```

### 3. API Endpoints Expected

The app expects these endpoints:

**Authentication**
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Register new user

**Profile**
- `GET /profile` - Get current user profile
- `POST /profile/update` - Update profile
- `POST /profile/upload-photo` - Upload profile photo

**Members**
- `GET /members` - Get list of members
- `GET /members/:userId` - Get member details

**Social (Interests)**
- `POST /social/send-interest` - Send interest to member
- `GET /social/interests` - Get interests sent/received
- `POST /social/respond-interest` - Accept/decline interest

**Proposals (Date Proposals)**
- `POST /proposals/create` - Create date proposal
- `GET /proposals` - Get proposals sent/received
- `POST /proposals/respond` - Accept/decline proposal

**Events**
- `GET /events` - Get list of events
- `GET /events/:eventId` - Get event details
- `POST /events/create` - Create event
- `POST /events/:eventId/apply` - Apply to event

## TypeScript Compilation

Check for TypeScript errors:

```bash
npm run type-check
```

## Available Scripts

```bash
npm start       # Start dev server
npm run ios     # Run on iOS simulator
npm run android # Run on Android emulator
npm run web     # Run on web
npm run test    # Run tests
npm run lint    # Lint code
npm run type-check # TypeScript check
```

## Project Structure

- `app/` - Expo Router file-based routes
- `components/` - Reusable UI components
- `constants/` - App configuration and design tokens
- `lib/` - Utility functions and API client
- `store/` - Zustand state management
- `app.json` - Expo app configuration
- `tsconfig.json` - TypeScript configuration

## Color Palette

The app uses a teal and coral color scheme. All colors are defined in `constants/colors.ts`:

- **Primary Teal**: #0d9488
- **Accent Coral**: #f97316
- **Light Background**: #f0fdfa
- **Text**: #1e293b

## Important Notes

### Authentication Storage

Tokens are securely stored using Expo Secure Store. On first login, the token is persisted locally and automatically included in subsequent API requests.

### Demo Mode Token

Demo mode uses a fake token: `demo-token-12345`. This won't make real API calls.

### Image Placeholders

The demo uses `i.pravatar.cc` for placeholder avatars. Replace with real image URLs in production.

## Troubleshooting

### Port Already in Use

If port 3001 is in use:
```bash
# Kill the process using port 3001
lsof -ti:3001 | xargs kill -9
```

### Simulator Won't Start

For iOS:
```bash
# Close simulator and retry
xcrun simctl erase all
npm run ios
```

For Android:
```bash
# Check if emulator is running
emulator -list-avds
```

### Module Not Found

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
npm run type-check
# Fix any errors reported
```

## Performance Tips

1. Use demo mode during development to avoid API latency
2. Run on a physical device for better performance testing
3. Use React DevTools: `npm install -g react-devtools`
4. Monitor bundle size with `expo-cli` diagnostics

## Next Steps

1. Connect your backend API
2. Update logo in `app.json` (replace icon.png and splash.png)
3. Configure push notifications (see `app.json` plugins)
4. Customize colors in `constants/colors.ts`
5. Add your own member profiles and events data

## Support

For issues with Expo or React Native:
- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Expo Community Forums](https://forums.expo.dev)

## License

MIT
