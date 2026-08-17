import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import {
  getWindowState, formatClock, formatShort,
  WINDOW_LABEL, WINDOW_RANGE_LABEL, type WindowState,
} from '@/lib/daily-window';

/**
 * Ticks once a second and re-reads the window from the clock rather than
 * decrementing a counter, so a phone that slept through 19:00 wakes up with
 * the right answer instead of a stale one.
 */
export function useDailyWindow(): WindowState {
  const [state, setState] = useState<WindowState>(() => getWindowState());

  useEffect(() => {
    const t = setInterval(() => setState(getWindowState()), 1000);
    return () => clearInterval(t);
  }, []);

  return state;
}

/**
 * The nightly window, as a thing you watch.
 *
 * Two sizes for two jobs: 'hero' anchors the Meet tab, where the countdown is
 * the reason to be on the screen at all; 'banner' sits above the Today feed,
 * where it is context rather than the main event.
 */
export function WindowCountdown({ variant = 'hero' }: { variant?: 'hero' | 'banner' }) {
  const w = useDailyWindow();
  return variant === 'hero' ? <Hero w={w} /> : <Banner w={w} />;
}

function Hero({ w }: { w: WindowState }) {
  // A slow breath while open, so the live state reads as live without a
  // blinking dot demanding attention for two hours.
  const pulse = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w.open) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [w.open, pulse]);

  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] });

  return (
    <LinearGradient
      colors={w.open ? [COLORS.BRAND, COLORS.BRAND_LIGHT] : [COLORS.PLUM, '#2A1C38']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.hero}
    >
      <View style={s.heroTopRow}>
        {w.open ? (
          <>
            <Animated.View style={[s.liveDot, { opacity: dotOpacity }]} />
            <Text style={s.heroLabel}>Tonight's window is open</Text>
          </>
        ) : (
          <>
            <Ionicons name="moon-outline" size={13} color="rgba(255,255,255,0.75)" />
            <Text style={s.heroLabel}>Opens at {WINDOW_LABEL}</Text>
          </>
        )}
      </View>

      <Text style={s.heroClock}>
        {formatClock(w.open ? w.secondsUntilClose : w.secondsUntilOpen)}
      </Text>

      <Text style={s.heroSub}>
        {w.open
          ? 'left to start something tonight'
          : `Everything opens together, ${WINDOW_RANGE_LABEL}`}
      </Text>
    </LinearGradient>
  );
}

function Banner({ w }: { w: WindowState }) {
  return (
    <View style={[s.banner, w.open ? s.bannerOpen : s.bannerClosed]}>
      <View style={[s.bannerIcon, w.open ? s.bannerIconOpen : s.bannerIconClosed]}>
        <Ionicons
          name={w.open ? 'flame' : 'moon'}
          size={14}
          color={w.open ? COLORS.BRAND : COLORS.PLUM}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.bannerTitle}>
          {w.open ? 'The window is open' : `Tonight at ${WINDOW_LABEL}`}
        </Text>
        <Text style={s.bannerSub}>
          {w.open
            ? `${formatShort(w.secondsUntilClose)} left to start something`
            : `Opens in ${formatShort(w.secondsUntilOpen)}`}
        </Text>
      </View>
      <Text style={[s.bannerClock, w.open && { color: COLORS.BRAND }]}>
        {formatClock(w.open ? w.secondsUntilClose : w.secondsUntilOpen)}
      </Text>
    </View>
  );
}

/** Shown in place of an action that the window currently forbids. */
export function WindowClosedNotice({ secondsUntilOpen }: { secondsUntilOpen: number }) {
  return (
    <View style={s.notice}>
      <Ionicons name="lock-closed-outline" size={15} color={COLORS.PLUM} />
      <Text style={s.noticeText}>
        Opens at {WINDOW_LABEL} — {formatShort(secondsUntilOpen)} to go
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    borderRadius: 22, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center',
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16,
    shadowRadius: 16, elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  heroLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  heroClock: {
    fontSize: 46, fontWeight: '200', color: '#fff', marginTop: 8,
    fontVariant: ['tabular-nums'], letterSpacing: 1.5,
  },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4, fontWeight: '600' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1,
  },
  bannerOpen: { backgroundColor: COLORS.BRAND_MUTED, borderColor: COLORS.BRAND_GLOW },
  bannerClosed: { backgroundColor: COLORS.PLUM_MUTED, borderColor: COLORS.BORDER },
  bannerIcon: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  bannerIconOpen: { backgroundColor: '#fff' },
  bannerIconClosed: { backgroundColor: '#fff' },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT },
  bannerSub: { fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '600', marginTop: 1 },
  bannerClock: {
    fontSize: 15, fontWeight: '700', color: COLORS.PLUM, fontVariant: ['tabular-nums'],
  },

  notice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.PLUM_MUTED, borderRadius: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  noticeText: { fontSize: 13, fontWeight: '800', color: COLORS.PLUM },
});
