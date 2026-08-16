import React from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { callTransportAvailable } from '@/lib/call-transport';

/**
 * Call dates.
 *
 * The queue, matching, private post-call outcome and date creation are all
 * built and shipped. The only missing piece is the live audio itself, which
 * needs a native SDK and therefore the next binary — so on the current build
 * this screen says so honestly rather than queueing someone for a call that
 * cannot connect.
 */
export default function CallScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/discover'))}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={s.title}>Call first</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.hero}>
          <Text style={s.emoji}>🎙️</Text>
          <Text style={s.heroTitle}>
            {callTransportAvailable ? 'Ready when you are' : 'Almost here'}
          </Text>
          <Text style={s.heroSub}>
            {callTransportAvailable
              ? 'We\'ll match you with someone compatible for a short call. If you both want to meet afterwards, we\'ll plan the date.'
              : 'Live calls need a new version of the app — they can\'t be switched on remotely. Everything else is already built and waiting.'}
          </Text>
        </View>

        <View style={s.steps}>
          <Step n={1} text="We match you with someone compatible" />
          <Step n={2} text="A short call — no profiles, no pressure" />
          <Step n={3} text="You each privately say if you'd like to meet" />
          <Step n={4} text="If you both say yes, we plan the date" />
        </View>

        <View style={s.privacyCard}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.BRAND} />
          <Text style={s.privacyText}>
            Your answer stays private. If they don't feel the same, they never
            find out you said yes.
          </Text>
        </View>

        {callTransportAvailable ? (
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.88}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={s.primaryText}>Join the queue</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.soonCard}>
            <Text style={s.soonText}>Coming in the next app update</Text>
          </View>
        )}

        <TouchableOpacity style={s.altBtn} onPress={() => router.replace('/meet/blind')}>
          <Text style={s.altText}>Try a blind date instead</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },

  body: { padding: 24, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 10, marginBottom: 28 },
  emoji: { fontSize: 52 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.5 },
  heroSub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 21 },

  steps: { gap: 14, marginBottom: 22 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  stepText: { flex: 1, fontSize: 14, color: COLORS.TEXT, lineHeight: 19 },

  privacyCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 16, padding: 14, marginBottom: 24,
  },
  privacyText: { flex: 1, fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 17 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  soonCard: {
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.GOLD_LIGHT,
  },
  soonText: { fontSize: 14, fontWeight: '800', color: COLORS.GOLD_DEEP },

  altBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  altText: { fontSize: 14, fontWeight: '700', color: COLORS.BRAND },
});
