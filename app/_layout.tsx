import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { handleAuthCallbackUrl, ensureProfileForCurrentUser, refreshMyProfile } from '@/lib/auth-supabase';
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
  scheduleWindowOpenReminder,
} from '@/lib/notifications';
import { savePushTokenToServer } from '@/lib/profile-supabase';
import { getSupabase } from '@/lib/supabase';
import { fetchMySafetyState, termsCurrent, TERMS_VERSION, type SafetyState } from '@/lib/safety-supabase';
import { TermsGate, AccountSuspended } from '@/components/TermsGate';

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
    <View style={{ flex: 1, backgroundColor: '#8E0E40', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 18 }}>aura</Text>
      <ActivityIndicator color="#fff" />
    </View>
  );
}

export default function RootLayout() {
  const { token, user, hydrate, setToken, setUser, logout } = useAuthStore();
  /**
   * Terms accepted? Account suspended? undefined while we don't know yet.
   * Asked of the server on every launch and every return to the foreground,
   * so a removal takes effect without waiting for a restart.
   */
  const [safety, setSafety] = useState<SafetyState | null | undefined>(undefined);
  /** Latest-wins ticket for safety state writes. See the check below. */
  const safetySeq = React.useRef(0);
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

  // Auth deep links: password-recovery links go to the reset screen; OAuth
  // (Google) callbacks establish the session and land the user in the app.
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      try {
        const kind = await handleAuthCallbackUrl(url);
        if (kind === 'recovery') {
          router.replace('/reset-password');
        } else if (kind === 'signin') {
          const profile = await ensureProfileForCurrentUser();
          const { data } = await getSupabase().auth.getSession();
          if (data.session) await setToken(data.session.access_token);
          setUser(profile);
          router.replace('/');
        }
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

  const userId = user?.id;

  // Once per signed-in member, not once per change to their profile object.
  // This used to depend on `user` and end with setUser(fresh), which changed
  // `user` and ran it again, forever.
  useEffect(() => {
    if (!token || !userId) return;
    const current = useAuthStore.getState().user;
    if (current) upsertUser(current);
    (async () => {
      // Re-read our own profile from the server. A stale local copy of
      // gender / genderInterest silently filters the wrong people out of
      // Discover, which is very hard to diagnose from the UI.
      try {
        const fresh = await refreshMyProfile();
        if (fresh) setUser(fresh);
      } catch { /* offline — keep the cached profile */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);
  useEffect(() => {
    if (!token || !userId) { setSafety(undefined); return; }
    let active = true;
    const cacheKey = `aura.termsAccepted.${userId}`;

    const check = async () => {
      const ticket = ++safetySeq.current;
      const current = () => active && ticket === safetySeq.current;
      // A member who already agreed on this phone gets straight in; the
      // server's answer still arrives and wins, which is how a ban lands.
      try {
        if ((await AsyncStorage.getItem(cacheKey)) === TERMS_VERSION) {
          if (current()) setSafety((prev) => prev ?? { termsAcceptedAt: 'cached', termsVersion: TERMS_VERSION, bannedAt: null });
        }
      } catch { /* no cache */ }

      try {
        const state = await Promise.race([
          fetchMySafetyState(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
        if (!current()) return;
        setSafety(state ?? { termsAcceptedAt: null, termsVersion: null, bannedAt: null });
        if (termsCurrent(state) && !state?.bannedAt) AsyncStorage.setItem(cacheKey, TERMS_VERSION).catch(() => {});
        else AsyncStorage.removeItem(cacheKey).catch(() => {});
      } catch {
        // Offline with nothing cached: ask. Agreeing needs the network anyway,
        // and the gate says so if it fails.
        if (current()) setSafety((prev) => prev ?? { termsAcceptedAt: null, termsVersion: null, bannedAt: null });
      }
    };

    check();
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') check(); });
    return () => { active = false; sub.remove(); };
  }, [token, userId]);

  const cleared = !!safety && termsCurrent(safety) && !safety.bannedAt;
  useEffect(() => {
    if (!token || !userId || !cleared) return;
    (async () => {
      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        try { await savePushTokenToServer(pushToken); } catch { /* offline — retried next launch */ }
      }
      await scheduleWindowOpenReminder();
      await hydrateSubscription();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId, cleared]);

  const signOutFromGate = async () => {
    await logout();
    try {
      useProposalsStore.setState({ proposals: [], decisions: {} } as any);
      useDatesStore.setState({ dates: [] } as any);
    } catch {}
  };

  if (!isReady) return <BootSplash />;

  const isLoggedIn = !!token && !!user;
  const profileComplete = user?.profileComplete ?? false;

  // Before anything else a signed-in member sees, onboarding included: the
  // suspension notice, or the terms (with 18+) if they haven't agreed yet.
  if (isLoggedIn) {
    if (safety === undefined) return <BootSplash />;
    if (safety?.bannedAt) {
      return (
        <BootErrorBoundary>
          <SafeAreaProvider>
            <StatusBar style="dark" backgroundColor={COLORS.BG} />
            <AccountSuspended onSignOut={signOutFromGate} />
          </SafeAreaProvider>
        </BootErrorBoundary>
      );
    }
    if (!termsCurrent(safety)) {
      return (
        <BootErrorBoundary>
        <SafeAreaProvider>
          <StatusBar style="dark" backgroundColor={COLORS.BG} />
          <TermsGate
            onAccepted={(state) => {
              safetySeq.current += 1; // anything still in flight is now stale
              setSafety(state);
              if (userId && termsCurrent(state)) {
                AsyncStorage.setItem(`aura.termsAccepted.${userId}`, TERMS_VERSION).catch(() => {});
              }
            }}
            onSignOut={signOutFromGate}
          />
        </SafeAreaProvider>
        </BootErrorBoundary>
      );
    }
  }

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
        <Stack.Screen name="meet/browse" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="meet/blind" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="meet/call" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="meet/proposals" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="wallet" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ops/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ops/reports" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="sos" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
        <Stack.Screen name="thread/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
    </BootErrorBoundary>
  );
}
