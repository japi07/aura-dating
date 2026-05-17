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
import { COLORS } from '@/constants/colors';
import { useIntroStore } from '@/store/intro';

const { width: SW, height: SH } = Dimensions.get('window');

interface Slide {
  id: string;
  imageUrl: string;
  index: string;       // "01", "02", "03", "04"
  eyebrow: string;
  title: string;
  body: string;
  accent: 'rose' | 'gold';
  haptic: 'light' | 'medium' | 'success';
}

/** Cinematic editorial photography for maximum first impression */
const SLIDES: Slide[] = [
  {
    id: 's1',
    // Candle-lit couple, dramatic warm tones
    imageUrl: 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?auto=format&fit=crop&w=1400&q=85',
    index: '01',
    eyebrow: 'AURA · LONDON',
    title: 'A different\nkind of dating.',
    body: 'For people done with games. Designed in London for those who want connections that actually matter.',
    accent: 'gold',
    haptic: 'medium',
  },
  {
    id: 's2',
    // Intimate restaurant scene
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85',
    index: '02',
    eyebrow: 'NO INFINITE SWIPING',
    title: 'One proposal.\nEvery morning.',
    body: 'Hand-picked by our matchmakers. A single, beautifully curated date waits for you each day at 9 AM.',
    accent: 'rose',
    haptic: 'light',
  },
  {
    id: 's3',
    // Vintage camera / film moment
    imageUrl: 'https://images.unsplash.com/photo-1502980426475-b83966705988?auto=format&fit=crop&w=1400&q=85',
    index: '03',
    eyebrow: 'NO ENDLESS CHAT',
    title: 'See his face.\nHear his voice.',
    body: 'Every proposal arrives with a 30-second video introduction. You decide before a single message is exchanged.',
    accent: 'gold',
    haptic: 'light',
  },
  {
    id: 's4',
    // London at golden hour
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1400&q=85',
    index: '04',
    eyebrow: 'REAL LONDON DATES',
    title: 'Then say yes\nto a real plan.',
    body: 'A table at Padella. Drinks at Lyaness. A walk through Hampstead Heath. The plan is already perfect.',
    accent: 'rose',
    haptic: 'success',
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const markSeen = useIntroStore((s) => s.markSeen);
  const flatRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(30)).current;
  // Ken Burns zoom that resets per slide
  const zoom = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startKenBurns();
  }, []);

  const startKenBurns = () => {
    zoom.setValue(1);
    Animated.timing(zoom, {
      toValue: 1.12,
      duration: 8000,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index === null || first?.index === undefined) return;
    const newIdx = first.index;
    setIndex((prev) => {
      if (prev !== newIdx) {
        const slide = SLIDES[newIdx];
        if (slide?.haptic === 'light')   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (slide?.haptic === 'medium')  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        if (slide?.haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        // Re-trigger Ken Burns zoom on the new slide
        startKenBurns();
      }
      return newIdx;
    });
  }).current;

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await markSeen();
    router.replace('/auth/register');
  };

  const skip = async () => {
    Haptics.selectionAsync().catch(() => {});
    await markSeen();
    router.replace('/auth/login');
  };

  const goNext = () => {
    Haptics.selectionAsync().catch(() => {});
    if (index < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const isLast = index === SLIDES.length - 1;
  const current = SLIDES[index];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index: i }) => {
          // Subtle parallax — image shifts slightly slower than the scroll
          const inputRange = [(i - 1) * SW, i * SW, (i + 1) * SW];
          const translateX = scrollX.interpolate({
            inputRange,
            outputRange: [SW * 0.3, 0, -SW * 0.3],
            extrapolate: 'clamp',
          });

          return (
            <View style={styles.slide}>
              <Animated.View style={[
                StyleSheet.absoluteFillObject,
                { transform: [{ translateX }, { scale: zoom }] },
              ]}>
                <Image source={{ uri: item.imageUrl }} style={styles.bgImage} />
              </Animated.View>

              {/* Layered gradients for cinematic depth */}
              <LinearGradient
                colors={['rgba(60,25,40,0.10)', 'rgba(25,12,30,0.55)', 'rgba(12,8,20,0.95)']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <LinearGradient
                colors={['rgba(201,154,78,0.22)', 'transparent']}
                style={[StyleSheet.absoluteFillObject, { height: '35%' }]}
              />
              {/* Subtle vignette */}
              <LinearGradient
                colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.45)']}
                locations={[0, 0.25, 0.75, 1]}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          );
        }}
      />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="flame" size={14} color="#fff" />
            </View>
            <Text style={styles.brandText}>aura</Text>
          </View>
          <TouchableOpacity onPress={skip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Animated progress bars (instead of dots) */}
      <SafeAreaView style={styles.progressWrap} edges={['top']} pointerEvents="none">
        <View style={styles.progressBars}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * SW, i * SW, (i + 1) * SW];
            const fillWidth = scrollX.interpolate({
              inputRange,
              outputRange: ['0%', '100%', '100%'],
              extrapolate: 'clamp',
            });
            return (
              <View key={i} style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: fillWidth as any }]} />
              </View>
            );
          })}
        </View>
      </SafeAreaView>

      {/* Foreground content */}
      <SafeAreaView style={styles.foreground} edges={['bottom']} pointerEvents="box-none">
        <Animated.View
          style={{ opacity: fade, transform: [{ translateY: lift }] }}
          pointerEvents="box-none"
        >
          <View style={styles.copyBlock} pointerEvents="none">
            {/* Big slide-number */}
            <View style={styles.slideNumberRow}>
              <Text style={[
                styles.slideNumber,
                { color: current.accent === 'gold' ? COLORS.GOLD_LIGHT : COLORS.BRAND_LIGHT },
              ]}>
                {current.index}
              </Text>
              <View style={[
                styles.numberLine,
                { backgroundColor: current.accent === 'gold' ? COLORS.GOLD_LIGHT + '70' : COLORS.BRAND_LIGHT + '70' },
              ]} />
              <Text style={[
                styles.eyebrowText,
                { color: current.accent === 'gold' ? COLORS.GOLD_LIGHT : COLORS.BRAND_LIGHT },
              ]}>
                {current.eyebrow}
              </Text>
            </View>

            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>
          </View>

          {/* CTA button */}
          <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.92}>
            <LinearGradient
              colors={[COLORS.BRAND_DARK, COLORS.BRAND, COLORS.BRAND_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.ctaText}>
              {isLast ? 'Create my account' : 'Continue'}
            </Text>
            <View style={styles.ctaArrow}>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={skip} style={styles.signInLink}>
            <Text style={styles.signInText}>
              Already a member?  <Text style={styles.signInTextBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0814' },
  slide: { width: SW, height: SH },
  bgImage: { width: SW * 1.3, height: SH, resizeMode: 'cover' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 6,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center', alignItems: 'center',
  },
  brandText: {
    fontSize: 22, fontWeight: '300', color: '#fff', letterSpacing: 6,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6,
    textTransform: 'lowercase',
  },
  skipBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
  },
  skipText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  /* Progress bars */
  progressWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  progressBars: {
    flexDirection: 'row', gap: 5, marginTop: 56, paddingHorizontal: 22,
  },
  progressTrack: {
    flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#fff', borderRadius: 2,
  },

  foreground: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 28, paddingBottom: 14,
  },
  copyBlock: { marginBottom: 28 },
  slideNumberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22,
  },
  slideNumber: {
    fontSize: 48, fontWeight: '200', letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 10,
  },
  numberLine: { width: 40, height: 1.5, borderRadius: 1 },
  eyebrowText: {
    fontSize: 11, fontWeight: '900', letterSpacing: 2.4,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4,
  },

  title: {
    fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1.5,
    lineHeight: 48, marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 14,
  },
  body: {
    fontSize: 16, color: 'rgba(255,255,255,0.88)', lineHeight: 24, fontWeight: '400',
    maxWidth: 380, letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6,
  },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
    height: 62, borderRadius: 34, overflow: 'hidden',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 12,
    marginBottom: 18,
  },
  ctaText: {
    fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.2)', textShadowRadius: 2,
  },
  ctaArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },

  signInLink: { alignItems: 'center', paddingVertical: 6 },
  signInText: { fontSize: 14, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.2 },
  signInTextBold: { color: '#fff', fontWeight: '800' },
});
