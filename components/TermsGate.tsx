import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Linking, Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import {
  acceptTerms, SUPPORT_EMAIL, TERMS_URL, type SafetyState,
} from '@/lib/safety-supabase';

const PRIVACY_URL = 'https://japi07.github.io/aura-dating/legal/privacy.html';

// Lazy, as elsewhere in the app: a missing native module must not crash the gate.
let WebBrowser: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebBrowser = require('expo-web-browser');
} catch {
  WebBrowser = null;
}

/** Read the terms without leaving the app, so nobody loses their place on this screen. */
async function openDoc(url: string) {
  if (WebBrowser?.openBrowserAsync) {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle?.PAGE_SHEET,
        dismissButtonStyle: 'done',
      });
      return;
    } catch { /* fall through to the system browser */ }
  }
  Linking.openURL(url).catch(() => Alert.alert('Could not open', url));
}

/**
 * Footer text may grow with the member's text size, but only so far: the
 * footer is pinned, and past this the button would leave the screen.
 */
const FOOTER_FONT_CAP = 1.3;

const RULES: { icon: any; title: string; body: string }[] = [
  {
    icon: 'shield-checkmark',
    title: 'Zero tolerance for abuse',
    body: 'Harassment, hate, threats, unwanted sexual content and anything involving minors are banned everywhere on Aura: profiles, messages, videos and calls, including anonymous ones.',
  },
  {
    icon: 'funnel',
    title: 'Content is screened',
    body: 'Names, bios, messages, photos and videos are checked automatically, and anything objectionable is refused before anyone sees it.',
  },
  {
    icon: 'flag',
    title: 'Report and block, any time',
    body: 'On any profile, invitation, conversation, date or call, and from Profile › Safety. Blocking hides the person from you at once. A person reviews every report within 24 hours and removes anyone who breaks these rules.',
  },
];

/**
 * Shown to every signed-in member who hasn't agreed to the current terms:
 * a new sign-up, someone who arrived through Sign in with Apple and never saw
 * a form, and existing members when the terms change. The agreement is
 * recorded by the server, not remembered by the phone.
 *
 * Built so it can't be misread as stuck. App Review signed in to build 8,
 * met this screen and never agreed: the button looked disabled and said
 * nothing when tapped, and on a small screen the boxes sat below the fold.
 * The boxes and the button now stay pinned in view, and the button always
 * answers.
 */
export function TermsGate({ onAccepted, onSignOut }: {
  onAccepted: (state: SafetyState | null) => void;
  onSignOut: () => void;
}) {
  const [adult, setAdult] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState(false);
  // The two boxes scroll inside the footer if they ever outgrow this, so the
  // button below them can't be pushed off a small screen.
  const { height } = useWindowDimensions();
  const checksMaxHeight = Math.max(120, Math.round(height * 0.3));

  const accept = async () => {
    if (!adult || !agreed) {
      setNudge(true);
      return;
    }
    setBusy(true);
    try {
      onAccepted(await acceptTerms());
    } catch (e: any) {
      Alert.alert(
        'Could not continue',
        `${e?.message || 'Check your connection and try again.'}\n\nIf this keeps happening, sign out and back in, or email ${SUPPORT_EMAIL}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        <Text style={s.brand}>aura</Text>
        <Text style={s.title}>Before you start</Text>
        <Text style={s.sub}>
          Aura only works if everyone on it feels safe. Every member agrees to these rules.
        </Text>

        <View style={s.rules}>
          {RULES.map((r) => (
            <View key={r.title} style={s.rule}>
              <View style={s.ruleIcon}>
                <Ionicons name={r.icon} size={17} color={COLORS.BRAND} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.ruleTitle}>{r.title}</Text>
                <Text style={s.ruleBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.docRow} onPress={() => openDoc(TERMS_URL)} activeOpacity={0.8}>
          <Ionicons name="document-text-outline" size={18} color={COLORS.BRAND} />
          <Text style={s.docText}>Read the Terms of Service (EULA)</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.BRAND} />
        </TouchableOpacity>
        <TouchableOpacity style={s.docRow} onPress={() => openDoc(PRIVACY_URL)} activeOpacity={0.8}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.BRAND} />
          <Text style={s.docText}>Read the Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.BRAND} />
        </TouchableOpacity>

        <Text style={s.contact}>
          Questions, or something to report? Email{' '}
          <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}>
            {SUPPORT_EMAIL}
          </Text>
          .
        </Text>
      </ScrollView>

      {/* Pinned: always on screen, whatever the device height or text size. */}
      <View style={s.footer}>
        <ScrollView style={{ maxHeight: checksMaxHeight }} bounces={false} showsVerticalScrollIndicator>
          <Check on={adult} missing={nudge && !adult} onPress={() => setAdult((v) => !v)}>
            I'm 18 or older.
          </Check>
          <Check on={agreed} missing={nudge && !agreed} onPress={() => setAgreed((v) => !v)}>
            I agree to the{' '}
            <Text style={s.link} onPress={() => openDoc(TERMS_URL)} maxFontSizeMultiplier={FOOTER_FONT_CAP}>
              Terms of Service (EULA)
            </Text>
            , including zero tolerance for objectionable content and abusive members.
          </Check>
        </ScrollView>

        {nudge && (!adult || !agreed) && (
          <Text style={s.nudge} maxFontSizeMultiplier={FOOTER_FONT_CAP}>Tick both boxes to continue.</Text>
        )}

        <TouchableOpacity
          style={[s.primary, (!adult || !agreed) && s.primaryWaiting]}
          onPress={accept}
          disabled={busy}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryText} maxFontSizeMultiplier={FOOTER_FONT_CAP}>Agree and continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.secondary} onPress={onSignOut} disabled={busy}>
          <Text style={s.secondaryText} maxFontSizeMultiplier={FOOTER_FONT_CAP}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/** A removed member sees this and nothing else. */
export function AccountSuspended({ onSignOut }: { onSignOut: () => void }) {
  return (
    <SafeAreaView style={s.root}>
      <View style={[s.body, { flex: 1, justifyContent: 'center' }]}>
        <View style={s.suspendedIcon}>
          <Ionicons name="lock-closed" size={30} color={COLORS.BRAND} />
        </View>
        <Text style={[s.title, { textAlign: 'center' }]}>Your account has been suspended</Text>
        <Text style={[s.sub, { textAlign: 'center' }]}>
          After a review, this account was removed for breaking Aura's community rules. Your profile is no
          longer visible to anyone.
        </Text>
        <Text style={[s.contact, { textAlign: 'center' }]}>
          If you think this is a mistake, email{' '}
          <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Account%20review`).catch(() => {})}>
            {SUPPORT_EMAIL}
          </Text>
          .
        </Text>
        <TouchableOpacity style={s.primary} onPress={onSignOut} activeOpacity={0.88}>
          <Text style={s.primaryText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Check({ on, missing, onPress, children }: {
  on: boolean; missing: boolean; onPress: () => void; children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[s.check, missing && s.checkMissing]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <Ionicons
        name={on ? 'checkbox' : 'square-outline'}
        size={24}
        color={on ? COLORS.BRAND : missing ? COLORS.ERROR : COLORS.TEXT_SECONDARY}
      />
      <Text style={s.checkText} maxFontSizeMultiplier={FOOTER_FONT_CAP}>{children}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.BG },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  brand: { fontSize: 22, fontWeight: '800', color: COLORS.BRAND, letterSpacing: -0.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.6 },
  sub: { fontSize: 14.5, color: COLORS.TEXT_SECONDARY, lineHeight: 21, marginTop: 6 },

  rules: { marginTop: 16, gap: 10 },
  rule: {
    flexDirection: 'row', gap: 12, padding: 13, borderRadius: 16,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  ruleIcon: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.BRAND_MUTED,
    alignItems: 'center', justifyContent: 'center',
  },
  ruleTitle: { fontSize: 14.5, fontWeight: '800', color: COLORS.TEXT },
  ruleBody: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 18.5, marginTop: 2 },

  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginTop: 10,
    paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.BRAND_MUTED,
  },
  docText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.BRAND },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6,
    borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE,
  },
  check: {
    flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44,
    paddingHorizontal: 8, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  checkMissing: { borderColor: COLORS.ERROR, backgroundColor: COLORS.ERROR_LIGHT },
  checkText: { flex: 1, fontSize: 13.5, color: COLORS.TEXT, lineHeight: 19, paddingVertical: 6 },
  nudge: { fontSize: 13, fontWeight: '700', color: COLORS.ERROR, textAlign: 'center', marginTop: 6 },
  link: { color: COLORS.BRAND, fontWeight: '700' },

  primary: {
    marginTop: 10, backgroundColor: COLORS.BRAND, borderRadius: 26, minHeight: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  // Still clearly a button, and still tappable: it answers with what's missing.
  primaryWaiting: { opacity: 0.75 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  secondaryText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  contact: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 19, marginTop: 16 },
  suspendedIcon: {
    alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.BRAND_MUTED,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
});
