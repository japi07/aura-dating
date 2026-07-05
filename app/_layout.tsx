import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { handleRecoveryUrl } from '@/lib/auth-supabase';
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

/**
 * Catches any render-time crash and shows the actual error instead of a
 * white screen — vital for diagnosing release builds where there's no
 * dev overlay.
 */
class BootErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#FBF6F2' }} contentContainerStyle={{ padding: 28, paddingTop: 90 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#1F1428', marginBottom: 10 }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 13, color: '#5C4A5E', marginBottom: 16 }}>
            Please screenshot this and send it to support.
          </Text>
          <Text selectable style={{ fontSize: 12, color: '#8E0E40', fontFamily: 'Courier' }}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

/** Branded boot screen — shown instead of a blank white screen while stores hydrate. */
function BootSplash() {
  return (
    <View style={{ flex: 1, backgroundColor: '#C8175E', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 18 }}>aura</Text>
      <ActivityIndicator color="#fff" />
    </View>
  );
}

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
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Password-reset deep link: parse the recovery token, set the session, and
  // route to the reset screen so the user can choose a new password.
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      try {
        if (await handleRecoveryUrl(url)) router.replace('/reset-password');
      } catch { /* expired or malformed link — ignore */ }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Failsafe: never leave the user stuck on the boot screen. If any hydrate
    // hangs (slow network in a release build, etc.) we proceed anyway — the
    // stores fall back to cached/empty state and refresh in the background.
    const failsafe = setTimeout(() => setIsReady(true), 6000);
    (async () => {
      try {
        await hydrate();
        await Promise.all([
          hydrateProposals(),
          hydrateDates(),
          hydrateSettings(),
          hydrateUsers(),
          hydrateIntro(),
        ]);
      } catch {
        // boot must never fail hard — stores handle their own errors
      }
      setIsReady(true);
    })();
    return () => clearTimeout(failsafe);
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

  if (!isReady) return <BootSplash />;

  const isLoggedIn = !!token && !!user;
  const profileComplete = user?.profileComplete ?? false;

  // Routing logic precedence (top wins):
  //  1. Logged-in + profile complete  → tabs
  //  2. Logged-in + profile incomplete → onboarding
  //  3. Not logged in + intro not seen → intro
  //  4. Not logged in + intro seen     → auth
  return (
    <BootErrorBoundary>
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
        <Stack.Screen name="settings/emergency-contacts" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="sos" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
        <Stack.Screen name="settings/subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
    </BootErrorBoundary>
  );
}
