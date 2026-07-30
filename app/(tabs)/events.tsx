import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  RefreshControl, ScrollView, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { openInMaps } from '@/lib/maps';
import { addDateToCalendar } from '@/lib/calendar';
import { fetchEvents, fetchMyEventRsvps, rsvpToEvent, type AppEvent } from '@/lib/events-supabase';
import {
  openTicketCheckout, fetchMyTicketedEventIds,
  fetchTicketAvailability, formatTicketPrice, type TicketAvailability,
} from '@/lib/tickets-supabase';
import { useAuthStore } from '@/store/auth';
import { openBooking } from '@/lib/affiliate';

type LondonEvent = AppEvent;

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
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<'All' | LondonEvent['type']>('All');
  const [events, setEvents] = useState<LondonEvent[]>([]);
  const [reserved, setReserved] = useState<string[]>([]);
  const [ticketed, setTicketed] = useState<string[]>([]);
  /** Live Ticket Tailor availability, keyed by our event id */
  const [availability, setAvailability] = useState<Record<string, TicketAvailability>>({});
  const { user } = useAuthStore();

  const load = useCallback(async () => {
    try {
      const [list, mine, bought] = await Promise.all([
        fetchEvents(), fetchMyEventRsvps(), fetchMyTicketedEventIds(),
      ]);
      setEvents(list);
      setReserved(mine);
      setTicketed(bought);

      // Pull live prices / remaining tickets for events sold via Ticket Tailor
      const ticketedEvents = list.filter((e) => e.ticketTailorEventId);
      if (ticketedEvents.length) {
        const results = await Promise.all(
          ticketedEvents.map(async (e) => [
            e.id,
            await fetchTicketAvailability(e.ticketTailorEventId!),
          ] as const),
        );
        setAvailability(Object.fromEntries(results.filter(([, a]) => a.available)));
      }
    } catch {
      // offline / not configured — keep whatever we have, empty state shows
    }
  }, []);

  /** Live price + remaining if Ticket Tailor is wired up, else our stored values */
  const displayPrice = (e: LondonEvent) => {
    const a = availability[e.id];
    if (a?.fromPriceMinor != null) {
      const cur = a.ticketTypes[0]?.currency ?? 'GBP';
      return formatTicketPrice(a.fromPriceMinor, cur);
    }
    return e.price;
  };
  const displayRemaining = (e: LondonEvent) => {
    const a = availability[e.id];
    return a?.totalRemaining != null ? a.totalRemaining : e.spotsAvailable;
  };

  /**
   * Three kinds of event:
   *  - partner experience (booking_url) -> book on the partner's site
   *  - our own ticketed event           -> Ticket Tailor checkout
   *  - free Aura event                  -> simple RSVP
   */
  const ctaDone = (e: LondonEvent) => {
    if (e.bookingUrl) return false; // partner bookings are never "done" our side
    return e.ticketCheckoutUrl ? ticketed.includes(e.id) : reserved.includes(e.id);
  };
  const ctaLabel = (e: LondonEvent) => {
    if (e.bookingUrl) {
      const price = displayPrice(e);
      return price && price !== 'Free' ? `Book · ${price}` : 'Book this experience';
    }
    if (e.ticketCheckoutUrl) {
      return ticketed.includes(e.id) ? '✓ Ticket booked' : `Get tickets · ${displayPrice(e)}`;
    }
    return reserved.includes(e.id) ? '✓ Reserved' : 'Reserve a spot';
  };

  const buyTickets = async (e: LondonEvent) => {
    try {
      await openTicketCheckout({ checkoutUrl: e.ticketCheckoutUrl!, email: user?.email });
      // The webhook confirms the purchase; refresh so it shows once paid
      await load();
    } catch (err: any) {
      Alert.alert('Could not open checkout', err?.message || 'Please try again.');
    }
  };

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = category === 'All' ? events : events.filter((e) => e.type === category);
  const featured = events.find((e) => e.featured);
  const rest = filtered.filter((e) => !e.featured || category !== 'All');

  const reserve = (e: LondonEvent) => {
    // Partner experiences book on the partner's own site (affiliate-tracked)
    if (e.bookingUrl) {
      openBooking(e.bookingUrl, e.bookingPartner).catch((err: any) =>
        Alert.alert('Could not open', err?.message || 'Please try again.'));
      return;
    }
    // Our own ticketed events go through Ticket Tailor's checkout
    if (e.ticketCheckoutUrl) { buyTickets(e); return; }
    if (reserved.includes(e.id)) return;
    Alert.alert(
      `Reserve a spot at ${e.title}?`,
      `${e.venue}, ${e.area}\n${fmtDate(e.date)} · ${fmtTime(e.date)}\n${e.price}\n\nWe'll add it to your calendar.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reserve',
          onPress: async () => {
            // Optimistic, then persist the RSVP to the server
            setReserved((r) => [...r, e.id]);
            try {
              await rsvpToEvent(e.id);
            } catch (err: any) {
              setReserved((r) => r.filter((id) => id !== e.id));
              Alert.alert('Could not reserve', err?.message || 'Please try again.');
              return;
            }
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
          <Text style={styles.sub}>
            Group nights out you can join — reserve a spot and meet other members.
            Your one-to-one dates live in the Dates tab.
          </Text>
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
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={COLORS.BRAND} />
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={42} color={COLORS.BRAND} />
              </View>
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptySub}>
                We're curating new London experiences right now. You'll be the first to know when one opens up near you.
              </Text>
            </View>
          )
        }
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
                  {displayRemaining(featured) <= 3 ? '🔥 ' : ''}
                  {displayRemaining(featured)} spots · {displayPrice(featured)}
                </Text>
              </View>
              <View style={styles.featuredActionsRow}>
                <TouchableOpacity style={styles.featuredDirBtn} onPress={() => directions(featured)}>
                  <Ionicons name="navigate-outline" size={14} color="#fff" />
                  <Text style={styles.featuredDirText}>Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.featuredCtaBtn, ctaDone(featured) && styles.featuredCtaBtnDone]}
                  onPress={() => reserve(featured)}
                  disabled={ctaDone(featured)}
                >
                  <Text style={styles.featuredCtaText}>{ctaLabel(featured)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          // Fall back if an event carries a type we don't have styling for,
          // rather than crashing the whole list on an undefined lookup.
          const tc = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.Social;
          const remaining = displayRemaining(item);
          const fill = ((item.totalSpots - remaining) / item.totalSpots) * 100;
          const almostFull = remaining <= 3;
          const isReserved = ctaDone(item);
          const ticketedEvent = !!item.ticketCheckoutUrl;

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
                      <Text style={styles.reservedText}>
                        {ticketedEvent ? '✓ Ticket booked' : '✓ Reserved'}
                      </Text>
                    </View>
                  )}
                  {ticketedEvent && !isReserved && (
                    <View style={styles.ticketPill}>
                      <Ionicons name="ticket-outline" size={10} color={COLORS.BRAND} />
                      <Text style={styles.ticketPillText}>Ticketed</Text>
                    </View>
                  )}
                  {!!item.bookingUrl && (
                    <View style={styles.partnerPill}>
                      <Ionicons name="sparkles" size={10} color={COLORS.GOLD_DEEP} />
                      <Text style={styles.partnerPillText}>
                        {item.bookingPartner ? `via ${item.bookingPartner}` : 'Bookable'}
                      </Text>
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
                  <Text style={styles.progressLabel}>{remaining}/{item.totalSpots} · {displayPrice(item)}</Text>
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
  ticketPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: COLORS.BRAND_MUTED,
  },
  ticketPillText: { fontSize: 11, fontWeight: '800', color: COLORS.BRAND },
  partnerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: COLORS.GOLD_MUTED,
  },
  partnerPillText: { fontSize: 11, fontWeight: '800', color: COLORS.GOLD_DEEP },
  reservedText: { fontSize: 11, fontWeight: '800', color: COLORS.LIKE },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 5 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardMeta: { fontSize: 12, color: COLORS.TEXT_MUTED },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.BORDER },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 4, backgroundColor: COLORS.BORDER_LIGHT, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED, textAlign: 'right' },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 26, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: COLORS.TEXT_MUTED, textAlign: 'center', lineHeight: 21 },
});
