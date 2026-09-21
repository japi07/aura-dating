import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import {
  acceptTerms, SUPPORT_EMAIL, TERMS_URL, type SafetyState,
} from '@/lib/safety-supabase';

const PRIVACY_URL = 'https://japi07.github.io/aura-dating/legal/privacy.html';

const RULES: { icon: any; title: string; body: string }[] = [
  {
    icon: 'shield-checkmark',
    title: 'Zero tolerance for abuse',
    body: 'Harassment, hate, threats, sexual content nobody asked for, and anything involving minors are not allowed anywhere on Aura: profiles, messages, videos or calls.',
  },
  {
    icon: 'flag',
    title: 'Report and block, any time',
    body: 'From any profile, conversation, date or call. A person reviews every report within 24 hours, and anyone who breaks these rules is removed from Aura.',
  },
  {
    icon: 'people',
    title: 'Meet safely',
    body: 'First dates in public places, your own way there and back, and SOS in the app if you ever need it.',
  },
];

/**
 * Shown to every signed-in member who hasn't agreed to the current terms:
 * a new sign-up, someone who arrived through Sign in with Apple and never saw
 * a form, and existing members when the terms change. The agreement is
 * recorded by the server, not remembered by the phone.
 */
export function TermsGate({ onAccepted, onSignOut }: {
  onAccepted: (state: SafetyState | null) => void;
  onSignOut: () => void;
}) {
  const [adult, setAdult] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      onAccepted(await acceptTerms());
    } catch (e: any) {
      Alert.alert('Could not continue', e?.message || 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Could not open', url));

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.brand}>aura</Text>
        <Text style={s.title}>Before you start</Text>
        <Text style={s.sub}>
          Aura only works if everyone on it feels safe. These are the rules every member agrees to.
        </Text>

        <View style={s.rules}>
          {RULES.map((r) => (
            <View key={r.title} style={s.rule}>
              <View style={s.ruleIcon}>
                <Ionicons name={r.icon} size={18} color={COLORS.BRAND} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.ruleTitle}>{r.title}</Text>
                <Text style={s.ruleBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Check on={adult} onPress={() => setAdult((v) => !v)}>
          I'm 18 or older.
        </Check>
        <Check on={agreed} onPress={() => setAgreed((v) => !v)}>
          I agree to the{' '}
          <Text style={s.link} onPress={() => open(TERMS_URL)}>Terms of Service (EULA)</Text>
          , including zero tolerance for objectionable content and abusive members, and I've read the{' '}
          <Text style={s.link} onPress={() => open(PRIVACY_URL)}>Privacy Policy</Text>.
        </Check>

        <TouchableOpacity
          style={[s.primary, (!adult || !agreed || busy) && { opacity: 0.45 }]}
          onPress={accept}
          disabled={!adult || !agreed || busy}
          activeOpacity={0.88}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Agree and continue</Text>}
        </TouchableOpacity>

        <Text style={s.contact}>
          Questions or a safety concern? Email{' '}
          <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}>
            {SUPPORT_EMAIL}
          </Text>
          .
        </Text>

        <TouchableOpacity style={s.secondary} onPress={onSignOut} disabled={busy}>
          <Text style={s.secondaryText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
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

function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      style={s.check}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? COLORS.BRAND : COLORS.TEXT_MUTED} />
      <Text style={s.checkText}>{children}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.BG },
  body: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  brand: { fontSize: 22, fontWeight: '800', color: COLORS.BRAND, letterSpacing: -0.5, marginBottom: 18 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.6 },
  sub: { fontSize: 15, color: COLORS.TEXT_SECONDARY, lineHeight: 22, marginTop: 8 },

  rules: { marginTop: 22, gap: 12 },
  rule: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  ruleIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED,
    alignItems: 'center', justifyContent: 'center',
  },
  ruleTitle: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT },
  ruleBody: { fontSize: 13.5, color: COLORS.TEXT_SECONDARY, lineHeight: 19, marginTop: 3 },

  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 18, minHeight: 44 },
  checkText: { flex: 1, fontSize: 14.5, color: COLORS.TEXT, lineHeight: 21 },
  link: { color: COLORS.BRAND, fontWeight: '700' },

  primary: {
    marginTop: 26, backgroundColor: COLORS.BRAND, borderRadius: 26, minHeight: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  secondaryText: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  contact: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 19, marginTop: 18 },
  suspendedIcon: {
    alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.BRAND_MUTED,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
});
