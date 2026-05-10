import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Image,
  Dimensions, FlatList, ViewToken, StatusBar, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '@/constants/colors';

const { width: SW, height: SH } = Dimensions.get('window');
const HAS_SEEN_KEY = 'aura.hasSeenIntro.v1';

interface Slide {
  id: string;
  imageUrl: string;
  imageCredit: string;
  eyebrow: string;
  title: string;
  body: string;
  accent: 'rose' | 'gold';
  /** What kind of haptic fires when this slide is reached */
  haptic: 'light' | 'medium' | 'heavy' | 'success';
}

/** Retro / vintage-feeling photographs — black & white couples and crowded cafés */
const SLIDES: Slide[] = [
  {
    id: 's1',
    // Couple by candlelight, vintage sepia tones
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    imageCredit: '',
    eyebrow: 'WELCOME TO AURA',
    title: 'Where real\nintentions meet',
    body: 'A London dating app for people done with games. Real proposals, real plans, real chemistry — face to face.',
    accent: 'rose',
    haptic: 'medium',
  },
  {
    id: 's2',
    // Vintage couple at a coffee shop
    imageUrl: 'https://images.unsplash.com/photo-1525695230005-efd074980869?auto=format&fit=crop&w=1200&q=80',
    imageCredit: '',
    eyebrow: 'NO INFINITE SWIPING',
    title: 'One curated proposal\nper day. That\'s it.',
    body: 'Hand-picked by our matchmakers. Quality over quantity. We respect your time and your heart.',
    accent: 'gold',
    haptic: 'light',
  },
  {
    id: 's3',
    // Vintage record player / letters / postcards — meaningful intentional vibe
    imageUrl: 'https://images.unsplash.com/photo-1488376739360-12821b5e0c20?auto=format&fit=crop&w=1200&q=80',
    imageCredit: '',
    eyebrow: 'NO ENDLESS CHAT',
    title: 'A short video.\nThen a real date.',
    body: 'Every man records a 30-second video introduction. You see his face, hear his voice, and decide if you want to meet him.',
    accent: 'rose',
    haptic: 'light',
  },
  {
    id: 's4',
    // Couple by candlelight, intimate
    imageUrl: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
    imageCredit: '',
    eyebrow: 'REAL CONNECTIONS',
    title: 'The kind of dates\nyou\'ll remember.',
    body: 'A handpicked London restaurant. A wine bar in Soho. A walk through Hampstead Heath. Just say yes.',
    accent: 'gold',
    haptic: 'success',
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const flatRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // Welcome haptic on first paint
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (!first || first.index === null || first.index === undefined) return;
    const newIdx = first.index;
    setIndex((prev) => {
      if (prev !== newIdx) {
        const slide = SLIDES[newIdx];
        // Per-slide haptic — gives the carousel a tactile rhythm
        if (slide?.haptic === 'light')   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (slide?.haptic === 'medium')  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        if (slide?.haptic === 'heavy')   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        if (slide?.haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      return newIdx;
    });
  }).current;

  const goNext = () => {
    Haptics.selectionAsync().catch(() => {});
    if (index < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { await AsyncStorage.setItem(HAS_SEEN_KEY, '1'); } catch {}
    router.replace('/auth/register');
  };

  const skip = async () => {
    Haptics.selectionAsync().catch(() => {});
    try { await AsyncStorage.setItem(HAS_SEEN_KEY, '1'); } catch {}
    router.replace('/auth/login');
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        bounces={false}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Background image */}
            <Image source={{ uri: item.imageUrl }} style={styles.bgImage} />
            {/* Sepia / warm overlay so photos always feel retro */}
            <LinearGradient
              colors={['rgba(45,20,30,0.45)', 'rgba(20,12,30,0.85)', 'rgba(15,8,25,0.96)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Champagne wash on top to give the warm-paper feel */}
            <LinearGradient
              colors={['rgba(201,154,78,0.18)', 'transparent']}
              style={[StyleSheet.absoluteFillObject, { height: '40%' }]}
            />
          </View>
        )}
      />

      {/* Top bar (skip + brand) */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Ionicons name="flame" size={20} color="#fff" />
            <Text style={styles.brandText}>aura</Text>
          </View>
          <TouchableOpacity onPress={skip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Foreground content (text + CTA) — sits on top of the swipeable images */}
      <SafeAreaView style={styles.foreground} edges={['bottom']} pointerEvents="box-none">
        <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }] }} pointerEvents="box-none">
          {/* Eyebrow + title + body, picked from the current slide */}
          <View style={styles.copyBlock} pointerEvents="none">
            <View style={[
              styles.eyebrowPill,
              SLIDES[index].accent === 'gold'
                ? { backgroundColor: 'rgba(201,154,78,0.25)', borderColor: 'rgba(230,203,149,0.5)' }
                : { backgroundColor: 'rgba(253,58,92,0.22)', borderColor: 'rgba(253,58,92,0.45)' },
            ]}>
              <View style={[
                styles.eyebrowDot,
                { backgroundColor: SLIDES[index].accent === 'gold' ? COLORS.GOLD_LIGHT : COLORS.BRAND_LIGHT },
              ]} />
              <Text style={[
                styles.eyebrowText,
                { color: SLIDES[index].accent === 'gold' ? COLORS.GOLD_LIGHT : COLORS.BRAND_LIGHT },
              ]}>
                {SLIDES[index].eyebrow}
              </Text>
            </View>

            <Text style={styles.title}>{SLIDES[index].title}</Text>
            <Text style={styles.body}>{SLIDES[index].body}</Text>
          </View>

          {/* Page dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index && styles.dotActive,
                ]}
              />
            ))}
          </View>

          {/* CTA + sign-in link */}
          <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.9}>
            <LinearGradient
              colors={[COLORS.BRAND_DARK, COLORS.BRAND, COLORS.BRAND_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.ctaText}>{isLast ? 'Create my account' : 'Continue'}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={skip} style={styles.signInLink}>
            <Text style={styles.signInText}>Already have an account? <Text style={styles.signInTextBold}>Sign in</Text></Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#100819' },
  slide: { width: SW, height: SH },
  bgImage: { ...StyleSheet.absoluteFillObject, width: SW, height: SH, resizeMode: 'cover' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: {
    fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6,
  },
  skipBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  skipText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  foreground: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24, paddingBottom: 12,
  },
  copyBlock: { marginBottom: 24 },
  eyebrowPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, marginBottom: 16,
  },
  eyebrowDot: { width: 5, height: 5, borderRadius: 2.5 },
  eyebrowText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },

  title: {
    fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1.2,
    lineHeight: 42, marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 12,
  },
  body: {
    fontSize: 15, color: 'rgba(255,255,255,0.86)', lineHeight: 23, fontWeight: '500',
    maxWidth: 380,
  },

  dots: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  dotActive: {
    width: 28, backgroundColor: '#fff',
  },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 58, borderRadius: 32, overflow: 'hidden',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 10,
    marginBottom: 16,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },

  signInLink: { alignItems: 'center', paddingVertical: 6 },
  signInText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  signInTextBold: { color: '#fff', fontWeight: '800' },
});
