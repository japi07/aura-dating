import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore } from '@/store/proposals';
import { useDatesStore } from '@/store/dates';
import { useSettingsStore } from '@/store/settings';
import { useUsersStore } from '@/store/users';
import { useIntroStore } from '@/store/intro';
import { useSubscriptionStore } from '@/store/subscription';
import { COLORS } from '@/constants/colors';
import {
  registerForPushNotifications,
  scheduleDailyProposalReminder,
} from '@/lib/notifications';
import { savePushTokenToServer } from '@/lib/profile-supabase';

export default function RootLayout() {
  const { token, user, hydrate } = useAuthStore();
  const hydrateProposals = useProposalsStore((s) => s.hydrate);
  const hydrateDates = useDatesStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateUsers = useUsersStore((s) => s.hydrate);
  const upsertUser = useUsersStore((s) => s.upsertUser);
  const hydrateSubscription = useSubscriptionStore((s) => s.hydrate);
  // Pull the reactive intro flag so this component re-renders when it changes.
  const hasSeenIntro = useIntroStore((s) => s.hasSeenIntro);
  const hydrateIntro = useIntroStore((s) => s.hydrate);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      await hydrate();
      await Promise.all([
        hydrateProposals(),
        hydrateDates(),
        hydrateSettings(),
        hydrateUsers(),
        hydrateIntro(),
      ]);
      setIsReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    upsertUser(user);
    (async () => {
      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        try { await savePushTokenToServer(pushToken); } catch { /* offline — retried next launch */ }
      }
      await scheduleDailyProposalReminder();
      await hydrateSubscription();
    })();
  }, [token, user]);

  if (!isReady) return null;

  const isLoggedIn = !!token && !!user;
  const profileComplete = user?.profileComplete ?? false;

  // Routing logic precedence (top wins):
  //  1. Logged-in + profile complete  → tabs
  //  2. Logged-in + profile incomplete → onboarding
  //  3. Not logged in + intro not seen → intro
  //  4. Not logged in + intro seen     → auth
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={COLORS.BG} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.BG },
        }}
      >
        <Stack.Screen
          name="intro/index"
          options={{ animation: 'fade' }}
          redirect={isLoggedIn || hasSeenIntro}
        />
        <Stack.Screen
          name="auth"
          options={{ animation: 'fade' }}
          redirect={isLoggedIn || !hasSeenIntro}
        />
        <Stack.Screen
          name="onboarding"
          options={{ animation: 'none' }}
          redirect={!isLoggedIn || profileComplete}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ animation: 'none' }}
          redirect={!isLoggedIn || !profileComplete}
        />
        <Stack.Screen name="proposal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="verify/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings/notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/privacy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/preferences" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/safety" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/help" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
