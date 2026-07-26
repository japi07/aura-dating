import React, { useState } from 'react';
import {
  StyleSheet, View, Text, Image, TouchableOpacity,
  ScrollView, NativeSyntheticEvent, NativeScrollEvent, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

export interface MemberCardPerson {
  name: string;
  age?: number;
  city?: string;
  bio?: string;
  interests?: string[];
  photoUrl?: string;
  photos?: string[];
  verified?: boolean;
}

interface MemberCardProps {
  person: MemberCardPerson;
  /** Rendered under the card — e.g. a "Choose" button */
  footer?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  /** Card width; defaults to screen width minus page padding */
  width?: number;
}

/**
 * A rich, swipeable profile card: full-bleed photo carousel with paging dots,
 * name/age overlay, verified badge, and interest chips — so members can
 * actually see who they're proposing to instead of a cramped list row.
 */
export function MemberCard({ person, footer, selected, onPress, width }: MemberCardProps) {
  const cardW = width ?? Dimensions.get('window').width - 32;
  const photos = (person.photos?.length ? person.photos : (person.photoUrl ? [person.photoUrl] : []))
    .filter(Boolean);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / cardW);
    if (p !== page) setPage(p);
  };

  const tags = (person.interests ?? []).slice(0, 6);

  return (
    <View style={[styles.card, { width: cardW }, selected && styles.cardSelected]}>
      <TouchableOpacity activeOpacity={onPress ? 0.95 : 1} onPress={onPress} style={styles.photoWrap}>
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            scrollEventThrottle={16}
          >
            {photos.map((uri, i) => (
              <Image key={`${uri}-${i}`} source={{ uri }} style={{ width: cardW, height: '100%' }} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="person" size={72} color={COLORS.BRAND} />
          </View>
        )}

        {/* Legibility scrims */}
        <LinearGradient
          colors={['rgba(20,16,40,0.65)', 'transparent']}
          style={styles.topScrim}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(20,16,40,0.15)', 'rgba(20,16,40,0.88)']}
          locations={[0, 0.5, 1]}
          style={styles.bottomScrim}
          pointerEvents="none"
        />

        {/* Name + meta */}
        <View style={styles.topInfo} pointerEvents="none">
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
            {person.verified && (
              <View style={styles.verifiedDot}>
                <Ionicons name="checkmark" size={13} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.meta}>
            {[person.age ? String(person.age) : null, person.city].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Paging dots */}
        {photos.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
        )}

        {/* Bio + interests */}
        <View style={styles.bottomInfo} pointerEvents="none">
          {!!person.bio && (
            <Text style={styles.bio} numberOfLines={2}>{person.bio}</Text>
          )}
          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26, backgroundColor: COLORS.SURFACE, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14,
    shadowRadius: 22, elevation: 10,
  },
  cardSelected: { borderColor: COLORS.BRAND },
  photoWrap: { height: 430, backgroundColor: COLORS.BRAND_MUTED, position: 'relative' },
  noPhoto: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BRAND_MUTED },

  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },

  topInfo: { position: 'absolute', top: 18, left: 18, right: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8, flexShrink: 1,
  },
  verifiedDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.LIKE,
    justifyContent: 'center', alignItems: 'center',
  },
  meta: { fontSize: 14, color: 'rgba(255,255,255,0.92)', fontWeight: '600', marginTop: 2 },

  dots: {
    position: 'absolute', top: 14, right: 16, flexDirection: 'row', gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: '#fff', width: 18 },

  bottomInfo: { position: 'absolute', bottom: 16, left: 16, right: 16, gap: 10 },
  bio: {
    fontSize: 14, color: 'rgba(255,255,255,0.95)', lineHeight: 20, fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 6,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(31,20,40,0.72)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  tagText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  footer: { padding: 12 },
});
