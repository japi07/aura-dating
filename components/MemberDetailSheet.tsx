import React, { useState } from 'react';
import {
  StyleSheet, View, Text, Image, TouchableOpacity, Modal,
  ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import type { MemberCardPerson } from './MemberCard';

const { width: SW } = Dimensions.get('window');

interface MemberDetailSheetProps {
  person: MemberCardPerson | null;
  visible: boolean;
  onClose: () => void;
  /** Primary CTA — e.g. "Propose to Anna" */
  ctaLabel?: string;
  onCta?: () => void;
}

/**
 * Full-screen profile view: every photo, the full bio, all interests and
 * verification status — so you know who you're inviting before you spend the
 * effort recording a video and planning a date.
 */
export function MemberDetailSheet({ person, visible, onClose, ctaLabel, onCta }: MemberDetailSheetProps) {
  const [page, setPage] = useState(0);
  if (!person) return null;

  const photos = (person.photos?.length ? person.photos : (person.photoUrl ? [person.photoUrl] : []))
    .filter(Boolean);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (p !== page) setPage(p);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Photo carousel */}
          <View style={styles.photoWrap}>
            {photos.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScroll}
              >
                {photos.map((uri, i) => (
                  <Image key={`${uri}-${i}`} source={{ uri }} style={{ width: SW, height: '100%' }} />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noPhoto}>
                <Ionicons name="person" size={90} color={COLORS.BRAND} />
              </View>
            )}

            <LinearGradient
              colors={['rgba(20,16,40,0.55)', 'transparent']}
              style={styles.topScrim}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', 'rgba(20,16,40,0.9)']}
              style={styles.bottomScrim}
              pointerEvents="none"
            />

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="chevron-down" size={24} color="#fff" />
            </TouchableOpacity>

            {photos.length > 1 && (
              <View style={styles.dots} pointerEvents="none">
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
                ))}
              </View>
            )}

            <View style={styles.nameBlock} pointerEvents="none">
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
                {person.verified && (
                  <View style={styles.verifiedDot}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.meta}>
                {[person.age ? `${person.age}` : null, person.city].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          </View>

          {/* Verified pill */}
          <View style={styles.body}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, person.verified ? styles.badgeOk : styles.badgeMuted]}>
                <Ionicons
                  name={person.verified ? 'shield-checkmark' : 'shield-outline'}
                  size={13}
                  color={person.verified ? COLORS.LIKE : COLORS.TEXT_MUTED}
                />
                <Text style={[styles.badgeText, person.verified && { color: COLORS.LIKE }]}>
                  {person.verified ? 'Verified member' : 'Not yet verified'}
                </Text>
              </View>
              {photos.length > 0 && (
                <View style={[styles.badge, styles.badgeMuted]}>
                  <Ionicons name="images-outline" size={13} color={COLORS.TEXT_MUTED} />
                  <Text style={styles.badgeText}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>

            {/* Bio */}
            {!!person.bio && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bio}>{person.bio}</Text>
              </View>
            )}

            {/* Interests */}
            {(person.interests?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Interests</Text>
                <View style={styles.tagRow}>
                  {person.interests!.map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!person.bio && (person.interests?.length ?? 0) === 0 && (
              <Text style={styles.emptyNote}>
                {person.name.split(' ')[0]} hasn't filled in their profile yet.
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        {!!onCta && (
          <View style={styles.ctaBar}>
            <TouchableOpacity style={styles.ctaBtn} onPress={onCta} activeOpacity={0.9}>
              <Ionicons name="heart" size={18} color="#fff" />
              <Text style={styles.ctaText}>{ctaLabel || 'Choose'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.BG },
  photoWrap: { height: 520, backgroundColor: COLORS.BRAND_MUTED, position: 'relative' },
  noPhoto: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 },

  closeBtn: {
    position: 'absolute', top: 52, left: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(20,16,40,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  dots: { position: 'absolute', top: 62, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: '#fff', width: 20 },

  nameBlock: { position: 'absolute', bottom: 22, left: 20, right: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  name: {
    fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8,
  },
  verifiedDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.LIKE,
    justifyContent: 'center', alignItems: 'center',
  },
  meta: { fontSize: 15, color: 'rgba(255,255,255,0.92)', fontWeight: '600', marginTop: 4 },

  body: { padding: 20, gap: 18 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
  },
  badgeOk: { backgroundColor: COLORS.LIKE_BG },
  badgeMuted: { backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER_LIGHT },
  badgeText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED },

  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  bio: { fontSize: 15, color: COLORS.TEXT, lineHeight: 23 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: COLORS.BRAND_MUTED, borderWidth: 1, borderColor: COLORS.BRAND + '35',
  },
  tagText: { fontSize: 13, fontWeight: '700', color: COLORS.BRAND },
  emptyNote: { fontSize: 14, color: COLORS.TEXT_MUTED, fontStyle: 'italic' },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 18, paddingBottom: 32, backgroundColor: COLORS.SURFACE,
    borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: COLORS.BRAND, borderRadius: 18, paddingVertical: 16,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4,
    shadowRadius: 14, elevation: 8,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
