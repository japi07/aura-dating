import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore } from '@/store/proposals';
import { useDatesStore } from '@/store/dates';
import { useSettingsStore } from '@/store/settings';
import { useUsersStore } from '@/store/users';
import { COLORS } from '@/constants/colors';
import {
  registerForPushNotifications,
  scheduleDailyProposalReminder,
} from '@/lib/notifications';
import { HAS_SEEN_INTRO_KEY } from './intro';

export default function RootLayout() {
  const { token, user, hydrate } = useAuthStore();
  const hydrateProposals = useProposalsStore((s) => s.hydrate);
  const hydrateDates = useDatesStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateUsers = useUsersStore((s) => s.hydrate);
  const upsertUser = useUsersStore((s) => s.upsertUser);
  const [isReady, setIsReady] = useState(false);
  // Default to true so the intro doesn't briefly flash for returning users.
  // Updated from AsyncStorage during boot.
  const [hasSeenIntro, setHasSeenIntro] = useState(true);

  useEffect(() => {
    (async () => {
      await hydrate();
      await Promise.all([hydrateProposals(), hydrateDates(), hydrateSettings(), hydrateUsers()]);
      try {
        const seen = await AsyncStorage.getItem(HAS_SEEN_INTRO_KEY);
        setHasSeenIntro(seen === '1');
      } catch {
        setHasSeenIntro(true);
      }
      setIsReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    upsertUser(user);
    (async () => {
      await registerForPushNotifications();
      await scheduleDailyProposalReminder();
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
          name="intro"
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
        <Stack.Screen name="verify" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings/notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/privacy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/preferences" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/safety" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
