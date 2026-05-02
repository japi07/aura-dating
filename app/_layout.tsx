import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore } from '@/store/proposals';
import { useDatesStore } from '@/store/dates';
import { COLORS } from '@/constants/colors';
import {
  registerForPushNotifications,
  scheduleDailyProposalReminder,
} from '@/lib/notifications';

export default function RootLayout() {
  const { token, user, hydrate } = useAuthStore();
  const hydrateProposals = useProposalsStore((s) => s.hydrate);
  const hydrateDates = useDatesStore((s) => s.hydrate);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      // 1. Restore auth state
      await hydrate();
      // 2. Hydrate persistent app state in parallel
      await Promise.all([hydrateProposals(), hydrateDates()]);
      // 3. Mark ready so first frame can render
      setIsReady(true);
    })();
  }, []);

  // Once user is authenticated, set up notifications (non-blocking)
  useEffect(() => {
    if (!token || !user) return;
    (async () => {
      await registerForPushNotifications();
      await scheduleDailyProposalReminder();
    })();
  }, [token, user]);

  if (!isReady) return null;

  const isLoggedIn = !!token && !!user;
  const profileComplete = user?.profileComplete ?? false;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={COLORS.BG} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.BG },
        }}
      >
        {isLoggedIn ? (
          <>
            {!profileComplete ? (
              <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
            ) : (
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            )}
            <Stack.Screen name="events/[eventId]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="events/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="proposal/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="verify/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="settings/notifications" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/privacy" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/preferences" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/safety" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </>
        ) : (
          <Stack.Screen name="auth" options={{ animation: 'none' }} />
        )}
      </Stack>
    </SafeAreaProvider>
  );
}
