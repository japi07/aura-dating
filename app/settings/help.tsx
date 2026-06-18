import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar, Alert, TextInput, Linking, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { submitSupportTicket } from '@/lib/profile-supabase';
import { getSessionUserId } from '@/lib/proposals-supabase';

const SUPPORT_EMAIL = 'support@auradating.app';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How does Aura work?',
    a: 'Aura is invitation-first. Instead of swiping, someone sends you a real date proposal — a specific London venue, a date and time, and a short video introduction. You accept or pass. Accepting instantly confirms the date and adds it to your calendar.',
  },
  {
    q: 'Why do I only get one proposal at a time?',
    a: 'Quality over quantity. We show one curated proposal so you can give it real attention, rather than endlessly scrolling. Aura Gold members can receive more per day.',
  },
  {
    q: 'How do I get verified?',
    a: 'Go to your Profile and tap “Get the verified badge.” You’ll do a quick Face ID check, take a selfie, and record a short liveness video. Our team reviews it, usually within an hour. Verified profiles get far more proposals.',
  },
  {
    q: 'What is Aura Gold?',
    a: 'Aura Gold is our premium membership: more proposals per day, incognito browsing, priority in the matching queue, and members-only events. You can subscribe from Profile → Aura Gold, and cancel anytime in your Apple ID settings.',
  },
  {
    q: 'How do I stay safe on a date?',
    a: 'Always meet in public, get there on your own transport, tell a friend where you’ll be, and trust your gut. Open Profile → Safety for our full safety centre, emergency contacts, and the SOS button.',
  },
  {
    q: 'How do I block or report someone?',
    a: 'On any proposal, tap the “⋯” menu in the top corner to block or report the sender. Blocked people can no longer reach you, and reports go straight to our trust & safety team.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Subscriptions are billed by Apple. Refund requests are handled by Apple directly through reportaproblem.apple.com — we’re unable to issue refunds on their behalf.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Profile → Privacy → Delete my account. This permanently removes your profile, proposals and dates. It cannot be undone.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const emailUs = () => {
    const subject = encodeURIComponent('Aura support request');
    const body = encodeURIComponent('\n\n— Sent from the Aura app');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('No mail app', `You can email us at ${SUPPORT_EMAIL}`);
    });
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (text.length < 10) {
      Alert.alert('A bit more detail', 'Please describe your question in at least a sentence so we can help.');
      return;
    }
    const signedIn = await getSessionUserId();
    if (!signedIn) {
      // Not signed in — fall back to email
      emailUs();
      return;
    }
    setSending(true);
    try {
      await submitSupportTicket({ message: text });
      setMessage('');
      Alert.alert('Message sent ✨', 'Thanks — our team will get back to you by email soon.');
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Please try again, or email us directly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Quick contact */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} onPress={emailUs} activeOpacity={0.85}>
            <View style={styles.quickIcon}>
              <Ionicons name="mail" size={20} color={COLORS.BRAND} />
            </View>
            <Text style={styles.quickTitle}>Email us</Text>
            <Text style={styles.quickSub}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/settings/safety')} activeOpacity={0.85}>
            <View style={styles.quickIcon}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.LIKE} />
            </View>
            <Text style={styles.quickTitle}>Safety centre</Text>
            <Text style={styles.quickSub}>SOS, blocking, tips</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Frequently asked</Text>
        <View style={styles.card}>
          {FAQS.map((f, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.faqRow, i < FAQS.length - 1 && styles.rowBorder]}
              onPress={() => setOpen(open === i ? null : i)}
              activeOpacity={0.7}
            >
              <View style={styles.faqQRow}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.TEXT_MUTED} />
              </View>
              {open === i && <Text style={styles.faqA}>{f.a}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact form */}
        <Text style={styles.sectionTitle}>Still need help?</Text>
        <View style={styles.card}>
          <Text style={styles.formLabel}>Send us a message</Text>
          <TextInput
            style={styles.input}
            placeholder="Tell us what's going on and we'll get back to you by email…"
            placeholderTextColor={COLORS.TEXT_MUTED}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (sending || message.trim().length < 10) && { opacity: 0.6 }]}
            onPress={sendMessage}
            disabled={sending || message.trim().length < 10}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>Send message</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.formHint}>
            Prefer email? Reach us anytime at {SUPPORT_EMAIL}.
          </Text>
        </View>

        {/* Legal */}
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <LinkRow icon="document-text-outline" label="Terms of Service" onPress={() => openLegal('TERMS_OF_SERVICE.md')} border />
          <LinkRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => openLegal('PRIVACY_POLICY.md')} />
        </View>

        <Text style={styles.version}>Aura · v1.0.0{Platform.OS === 'ios' ? ' · iOS' : ''}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function openLegal(file: string) {
  // Until the legal docs are hosted on a public site, open the source in the repo.
  const url = `https://github.com/japi07/aura-dating/blob/main/legal/${file}`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open', url));
}

function LinkRow({ icon, label, onPress, border }: { icon: any; label: string; onPress: () => void; border?: boolean }) {
  return (
    <TouchableOpacity style={[styles.linkRow, border && styles.rowBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={18} color={COLORS.BRAND} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={COLORS.BORDER} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },

  quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 8 },
  quickCard: {
    flex: 1, backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  quickIcon: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  quickTitle: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT },
  quickSub: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2 },

  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1,
    textTransform: 'uppercase', paddingHorizontal: 24, marginTop: 24, marginBottom: 8,
  },
  card: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },

  faqRow: { paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  faqQRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  faqA: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 20, marginTop: 10 },

  formLabel: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT, padding: 16, paddingBottom: 8 },
  input: {
    marginHorizontal: 16, minHeight: 110, borderRadius: 14, padding: 14,
    backgroundColor: COLORS.BG, borderWidth: 1, borderColor: COLORS.BORDER,
    fontSize: 14, color: COLORS.TEXT, lineHeight: 20,
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 14, paddingVertical: 14,
    marginHorizontal: 16, marginTop: 12,
  },
  sendBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  formHint: { fontSize: 11, color: COLORS.TEXT_MUTED, textAlign: 'center', padding: 16, paddingTop: 12 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  linkIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.TEXT },

  version: { textAlign: 'center', fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 24, fontWeight: '500' },
});
