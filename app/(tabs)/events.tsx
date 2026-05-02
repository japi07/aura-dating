import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  RefreshControl, ScrollView, StatusBar, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { openInMaps } from '@/lib/maps';
import { addDateToCalendar } from '@/lib/calendar';

interface LondonEvent {
  id: string;
  title: string;
  date: string; // ISO
  venue: string;
  area: string;
  address: string;
  postcode: string;
  tube: string;
  type: 'Social' | 'Activity' | 'Culture' | 'Dinner' | 'Workshop';
  spotsAvailable: number;
  totalSpots: number;
  emoji: string;
  price: string;
  description: string;
  featured?: boolean;
  lat: number;
  lng: number;
}

// Real London-flavoured group events curated by Aura
const LONDON_EVENTS: LondonEvent[] = [
  {
    id: 'e1',
    title: 'Natural Wine Tasting',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'P. Franco', area: 'Clapton', address: '107 Lower Clapton Rd', postcode: 'E5 0NP', tube: 'Hackney Downs',
    type: 'Social', spotsAvailable: 3, totalSpots: 12, emoji: '🍷', price: '£35',
    description: 'Six low-intervention wines, small plates, hosted by the in-house sommelier.',
    featured: true, lat: 51.5586, lng: -0.0518,
  },
  {
    id: 'e2',
    title: 'Sunset Walk: Hampstead Heath',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Parliament Hill', area: 'Hampstead', address: 'Hampstead Heath', postcode: 'NW3 1TH', tube: 'Hampstead',
    type: 'Activity', spotsAvailable: 5, totalSpots: 15, emoji: '🌅', price: 'Free',
    description: 'Group walk to Parliament Hill for golden hour. Bring a flask of something warm.',
    lat: 51.5608, lng: -0.1640,
  },
  {
    id: 'e3',
    title: 'Late at Tate Modern',
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Tate Modern', area: 'Bankside', address: 'Bankside', postcode: 'SE1 9TG', tube: 'Blackfriars',
    type: 'Culture', spotsAvailable: 8, totalSpots: 20, emoji: '🎨', price: '£18',
    description: 'After-hours private tour of the Yoko Ono retrospective + drinks at the members\' bar.',
    lat: 51.5076, lng: -0.0994,
  },
  {
    id: 'e4',
    title: 'Pasta-making at Padella',
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Padella', area: 'Borough', address: '6 Southwark St', postcode: 'SE1 1TQ', tube: 'London Bridge',
    type: 'Workshop', spotsAvailable: 2, totalSpots: 10, emoji: '🍝', price: '£75',
    description: 'Hands-on pappardelle workshop with the head chef. Apron + glass of wine included.',
    lat: 51.5051, lng: -0.0895,
  },
  {
    id: 'e5',
    title: 'Sunday Brunch · Granger',
    date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Granger & Co', area: 'Notting Hill', address: '175 Westbourne Grove', postcode: 'W11 2SB', tube: 'Notting Hill Gate',
    type: 'Social', spotsAvailable: 4, totalSpots: 8, emoji: '🥑', price: '£28',
    description: 'Aussie-style brunch + a wander through Portobello Road market afterwards.',
    lat: 51.5151, lng: -0.1989,
  },
  {
    id: 'e6',
    title: 'Pottery Wheel Workshop',
    date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Turning Earth', area: 'Hoxton', address: '11-15 Argall Way', postcode: 'E10 7QF', tube: 'Leyton',
    type: 'Workshop', spotsAvailable: 6, totalSpots: 14, emoji: '🏺', price: '£60',
    description: 'Two-hour beginners\' wheel session. Take home what you make.',
    lat: 51.5654, lng: -0.0091,
  },
  {
    id: 'e7',
    title: 'Supper Club · Persian Feast',
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Berber & Q', area: 'Haggerston', address: '338 Acton Mews', postcode: 'E8 4EA', tube: 'Haggerston',
    type: 'Dinner', spotsAvailable: 3, totalSpots: 8, emoji: '🥘', price: '£55',
    description: 'Eight-person communal table, four-course Persian menu, natural wine pairings.',
    lat: 51.5396, lng: -0.0747,
  },
];

const TYPE_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  Social:   { bg: COLORS.INFO_LIGHT,    text: COLORS.INFO,    icon: 'people-outline' },
  Activity: { bg: COLORS.SUCCESS_LIGHT, text: COLORS.SUCCESS, icon: 'bicycle-outline' },
  Culture:  { bg: '#F3EFFE',            text: '#7C3AED',      icon: 'color-palette-outline' },
  Dinner:   { bg: COLORS.BRAND_MUTED,   text: COLORS.BRAND,   icon: 'restaurant-outline' },
  Workshop: { bg: COLORS.WARNING_LIGHT, text: COLORS.WARNING, icon: 'construct-outline' },
};

const CATEGORIES: ('All' | LondonEvent['type'])[] = ['All', 'Social', 'Activity', 'Culture', 'Dinner', 'Workshop'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: false });
}

export default function EventsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<'All' | LondonEvent['type']>('All');
  const [reserved, setReserved] = useState<string[]>([]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const filtered = category === 'All' ? LONDON_EVENTS : LONDON_EVENTS.filter((e) => e.type === category);
  const featured = LONDON_EVENTS.find((e) => e.featured);
  const rest = filtered.filter((e) => !e.featured || category !== 'All');

  const reserve = (e: LondonEvent) => {
    Alert.alert(
      `Reserve a spot at ${e.title}?`,
      `${e.venue}, ${e.area}\n${fmtDate(e.date)} · ${fmtTime(e.date)}\n${e.price}\n\nWe'll add it to your calendar and send reminders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reserve',
          onPress: async () => {
            setReserved((r) => [...r, e.id]);
            await addDateToCalendar({
              title: `${e.title} (Aura event)`,
              notes: `${e.description}\n\n${e.price}`,
              location: `${e.venue}, ${e.address}, ${e.postcode}, London`,
              startsAt: new Date(e.date),
              durationMinutes: 120,
            });
            Alert.alert('🎉 Reserved!', `See you at ${e.venue}.`);
          },
        },
      ]
    );
  };

  const directions = (e: LondonEvent) => {
    openInMaps({ name: e.venue, address: e.address, postcode: e.postcode, lat: e.lat, lng: e.lng });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.sub}>Curated London experiences · meet other members in person</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {CATEGORIES.map((c) => {
          const cfg = TYPE_CONFIG[c];
          return (
            <TouchableOpacity
              key={c}
              style={[styles.catChip, category === c && styles.catChipActive, category === c && cfg && { backgroundColor: cfg.bg, borderColor: cfg.text + '40' }]}
              onPress={() => setCategory(c)}
            >
              {cfg && <Ionicons name={cfg.icon as any} size={14} color={category === c ? cfg.text : COLORS.TEXT_MUTED} />}
              <Text style={[styles.catText, category === c && { color: cfg ? cfg.text : COLORS.BRAND }]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={rest}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />}
        ListHeaderComponent={
          category === 'All' && featured ? (
            <View style={styles.featuredCard}>
              <View style={styles.featuredTop}>
                <View style={styles.featuredEmoji}>
                  <Text style={styles.featuredEmojiText}>{featured.emoji}</Text>
                </View>
                <View style={styles.featuredBadge}>
                  <Ionicons name="star" size={10} color={COLORS.GOLD} />
                  <Text style={styles.featuredBadgeText}>Featured</Text>
                </View>
              </View>
              <Text style={styles.featuredTitle}>{featured.title}</Text>
              <Text style={styles.featuredDesc}>{featured.description}</Text>
              <View style={styles.featuredMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.metaText}>{fmtDate(featured.date)} · {fmtTime(featured.date)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.metaText}>{featured.venue} · {featured.area}</Text>
                </View>
              </View>
              <View style={styles.featuredFooter}>
                <View style={styles.spotsBar}>
                  <View style={[styles.spotsBarFill, { width: `${((featured.totalSpots - featured.spotsAvailable) / featured.totalSpots) * 100}%` }]} />
                </View>
                <Text style={styles.spotsText}>
                  {featured.spotsAvailable <= 3 ? '🔥 ' : ''}{featured.spotsAvailable} spots · {featured.price}
                </Text>
              </View>
              <View style={styles.featuredActionsRow}>
                <TouchableOpacity style={styles.featuredDirBtn} onPress={() => directions(featured)}>
                  <Ionicons name="navigate-outline" size={14} color="#fff" />
                  <Text style={styles.featuredDirText}>Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.featuredCtaBtn, reserved.includes(featured.id) && styles.featuredCtaBtnDone]}
                  onPress={() => reserve(featured)}
                  disabled={reserved.includes(featured.id)}
                >
                  <Text style={styles.featuredCtaText}>
                    {reserved.includes(featured.id) ? '✓ Reserved' : 'Reserve a spot'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const tc = TYPE_CONFIG[item.type];
          const fill = ((item.totalSpots - item.spotsAvailable) / item.totalSpots) * 100;
          const almostFull = item.spotsAvailable <= 3;
          const isReserved = reserved.includes(item.id);

          return (
            <TouchableOpacity style={styles.card} onPress={() => reserve(item)} activeOpacity={0.85}>
              <View style={[styles.emojiBox, { backgroundColor: tc.bg }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.typePill, { backgroundColor: tc.bg }]}>
                    <Ionicons name={tc.icon as any} size={10} color={tc.text} />
                    <Text style={[styles.typeText, { color: tc.text }]}>{item.type}</Text>
                  </View>
                  {almostFull && (
                    <View style={styles.hotPill}>
                      <Text style={styles.hotText}>🔥 Almost full</Text>
                    </View>
                  )}
                  {isReserved && (
                    <View style={styles.reservedPill}>
                      <Text style={styles.reservedText}>✓ Reserved</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.cardMetaRow}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.TEXT_MUTED} />
                  <Text style={styles.cardMeta}>{fmtDate(item.date)}</Text>
                  <View style={styles.dot} />
                  <Ionicons name="location-outline" size={12} color={COLORS.TEXT_MUTED} />
                  <Text style={styles.cardMeta} numberOfLines={1}>{item.area}</Text>
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${fill}%`, backgroundColor: almostFull ? COLORS.WARNING : COLORS.LIKE }]} />
                  </View>
                  <Text style={styles.progressLabel}>{item.spotsAvailable}/{item.totalSpots} · {item.price}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 2, lineHeight: 18 },

  catRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER,
  },
  catChipActive: { borderColor: 'transparent' },
  catText: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_MUTED },

  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },

  featuredCard: {
    backgroundColor: COLORS.BRAND, borderRadius: 24, padding: 20, marginBottom: 16,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
  },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  featuredEmoji: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' },
  featuredEmojiText: { fontSize: 30 },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  featuredBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  featuredTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  featuredDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 19, marginBottom: 12 },
  featuredMeta: { gap: 6, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  spotsBar: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  spotsBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  spotsText: { fontSize: 12, fontWeight: '700', color: '#fff', minWidth: 110, textAlign: 'right' },
  featuredActionsRow: { flexDirection: 'row', gap: 8 },
  featuredDirBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  featuredDirText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  featuredCtaBtn: {
    flex: 1, alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12,
  },
  featuredCtaBtnDone: { backgroundColor: 'rgba(255,255,255,0.4)' },
  featuredCtaText: { fontSize: 13, fontWeight: '800', color: COLORS.BRAND },

  card: {
    flexDirection: 'row', gap: 12, backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    alignItems: 'flex-start',
  },
  emojiBox: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 26 },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '800' },
  hotPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: COLORS.WARNING_LIGHT },
  hotText: { fontSize: 11, fontWeight: '700', color: COLORS.WARNING },
  reservedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: COLORS.LIKE_BG },
  reservedText: { fontSize: 11, fontWeight: '800', color: COLORS.LIKE },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 5 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardMeta: { fontSize: 12, color: COLORS.TEXT_MUTED },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.BORDER },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 4, backgroundColor: COLORS.BORDER_LIGHT, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED, textAlign: 'right' },
});
