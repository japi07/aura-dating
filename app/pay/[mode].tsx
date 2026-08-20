import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, StatusBar, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { useTokensStore, NotEnoughTokens, type DateMode } from '@/store/tokens';
import { useDailyWindow } from '@/components/WindowCountdown';
import { formatShort, WINDOW_LABEL, WINDOW_RANGE_LABEL } from '@/lib/daily-window';
import { MODE_LABEL, MODE_BLURB, MODE_EMOJI } from '@/lib/tokens-supabase';

const MODES: DateMode[] = ['call', 'blind', 'proposal'];

/**
 * The confirmation step between choosing a mode and being in the queue.
 *
 * This is where the window stops being a lock and becomes a promise. You can
 * reach this screen at any hour: paying now buys your place for tonight, and
 * the countdown below the button tells you when it starts rather than turning
 * you away. Deciding at three in the afternoon that you want a blind date is
 * exactly the commitment the product wants, and the old behaviour — a dead
 * button until seven — threw that intent away.
 */
export default function PayScreen() {
  const { mode: raw } = useLocalSearchParams<{ mode: string }>();
  const router = useRouter();
  const w = useDailyWindow();

  const mode = (MODES.includes(raw as DateMode) ? raw : 'blind') as DateMode;

  const {
    balance, prices, entries, isHydrated, busy,
    hydrate, buy, hasEntry,
  } = useTokensStore();

  const [paying, setPaying] = useState(false);
  const price = prices[mode] ?? 1;
  const already = hasEntry(mode);
  const short = balance < price;
  // Selling a place in a window that is nearly over is taking money for
  // something the member cannot use, and a ticket does not roll over to
  // tomorrow.
  const CLOSING_SOON_SECONDS = 5 * 60;
  const tooLate = w.open && w.secondsUntilClose < CLOSING_SOON_SECONDS;

  useEffect(() => { if (!isHydrated) hydrate(); }, [isHydrated, hydrate]);

  /** Where this mode actually lives, once it is paid for. */
  const destination =
    mode === 'call' ? '/meet/call'
    : mode === 'blind' ? '/meet/blind'
    : '/meet/browse';

  const onPay = async () => {
    setPaying(true);
    try {
      await buy(mode);
      router.replace(destination as any);
    } catch (e: any) {
      if (e instanceof NotEnoughTokens || e?.name === 'NotEnoughTokens') {
        Alert.alert(
          'Not enough tokens',
          'You have run out for now. Tokens come with a subscription, or you can buy more.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'See plans', onPress: () => router.push('/settings/subscription') },
          ],
        );
      } else {
        Alert.alert('Could not confirm', e?.message || 'Please try again.');
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={s.backBtn}
        >
          <Ionicons name="close" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <View style={s.walletPill}>
          <Ionicons name="diamond" size={13} color={COLORS.GOLD_DEEP} />
          <Text style={s.walletText}>{balance}</Text>
        </View>
      </View>

      {!isHydrated ? (
        <View style={s.centered}><ActivityIndicator color={COLORS.BRAND} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <Text style={s.emoji}>{MODE_EMOJI[mode]}</Text>
            <Text style={s.heroTitle}>{MODE_LABEL[mode]}</Text>
            <Text style={s.heroSub}>{MODE_BLURB[mode]}</Text>
          </View>

          {/* The price */}
          <LinearGradient
            colors={[COLORS.BRAND, COLORS.BRAND_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.priceCard}
          >
            <Text style={s.priceLabel}>Tonight costs</Text>
            <View style={s.priceRow}>
              <Ionicons name="diamond" size={26} color="#fff" />
              <Text style={s.priceValue}>{price}</Text>
            </View>
            <Text style={s.priceSub}>
              {price === 1 ? 'token' : 'tokens'} · leaves you {Math.max(0, balance - price)}
            </Text>
          </LinearGradient>

          {/* What paying actually gets you */}
          <View style={s.stepsCard}>
            <Step
              icon="checkmark-circle"
              title="You are queued"
              detail={`Your place is held for tonight's ${WINDOW_RANGE_LABEL} window.`}
            />
            <Step
              icon={w.open ? 'hourglass-outline' : 'notifications-outline'}
              title={w.open ? 'Tonight is already running' : 'We tell you when it opens'}
              detail={
                w.open
                  ? `${formatShort(w.secondsUntilClose)} left before tonight closes.`
                  : `Opens at ${WINDOW_LABEL}, in ${formatShort(w.secondsUntilOpen)}.`
              }
            />
            <Step
              icon="refresh-outline"
              title="Changed your mind?"
              detail="Leave before it starts and the token comes back."
              last
            />
          </View>

          {already ? (
            <>
              <View style={s.paidNotice}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.LIKE} />
                <Text style={s.paidText}>You are already queued for tonight</Text>
              </View>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => router.replace(destination as any)}
                activeOpacity={0.88}
              >
                <Text style={s.primaryText}>Continue</Text>
              </TouchableOpacity>
            </>
          ) : short ? (
            <>
              <View style={s.shortNotice}>
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.GOLD_DEEP} />
                <Text style={s.shortText}>
                  You need {price - balance} more {price - balance === 1 ? 'token' : 'tokens'}
                </Text>
              </View>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => router.push('/settings/subscription')}
                activeOpacity={0.88}
              >
                <Ionicons name="diamond-outline" size={17} color="#fff" />
                <Text style={s.primaryText}>Get more tokens</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[s.primaryBtn, (paying || busy || tooLate) && { opacity: 0.7 }]}
              onPress={onPay}
              disabled={paying || busy || tooLate}
              activeOpacity={0.88}
            >
              {paying ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="lock-closed" size={16} color="#fff" />
                  <Text style={s.primaryText}>
                    Confirm · {price} {price === 1 ? 'token' : 'tokens'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {tooLate && (
            <View style={s.shortNotice}>
              <Ionicons name="time-outline" size={17} color={COLORS.GOLD_DEEP} />
              <Text style={s.shortText}>Tonight is nearly over — come back tomorrow</Text>
            </View>
          )}

          <Text style={s.smallPrint}>
            One place per night, per way of meeting. Tokens are only spent when
            you confirm.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Step({ icon, title, detail, last }: {
  icon: any; title: string; detail: string; last?: boolean;
}) {
  return (
    <View style={[s.step, last && { marginBottom: 0 }]}>
      <View style={s.stepIcon}>
        <Ionicons name={icon} size={15} color={COLORS.BRAND} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 13,
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 8,
  },
  walletText: { fontSize: 13.5, fontWeight: '800', color: COLORS.GOLD_DEEP },

  body: { padding: 24, paddingBottom: 44 },

  hero: { alignItems: 'center', gap: 8, marginBottom: 22 },
  emoji: { fontSize: 50 },
  heroTitle: { fontSize: 25, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.6 },
  heroSub: {
    fontSize: 13.5, color: COLORS.TEXT_SECONDARY, textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 10,
  },

  priceCard: {
    borderRadius: 22, paddingVertical: 22, alignItems: 'center', marginBottom: 18,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16,
    shadowRadius: 16, elevation: 6,
  },
  priceLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  priceValue: { fontSize: 44, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  priceSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '600' },

  stepsCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 18, marginBottom: 20,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06,
    shadowRadius: 12, elevation: 3,
  },
  step: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  stepIcon: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  stepTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.TEXT },
  stepDetail: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2, lineHeight: 17 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 17,
  },
  primaryText: { fontSize: 15.5, fontWeight: '800', color: '#fff' },

  paidNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.LIKE_BG, borderRadius: 16, paddingVertical: 14, marginBottom: 12,
  },
  paidText: { fontSize: 13.5, fontWeight: '800', color: COLORS.LIKE },

  shortNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 16, paddingVertical: 14, marginBottom: 12,
  },
  shortText: { fontSize: 13.5, fontWeight: '800', color: COLORS.GOLD_DEEP },

  smallPrint: {
    fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'center',
    lineHeight: 18, marginTop: 18, paddingHorizontal: 12,
  },
});
