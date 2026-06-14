import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Image, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useDatesStore, type ConfirmedDate } from '@/store/dates';
import { openInMaps } from '@/lib/maps';
import { addDateToCalendar } from '@/lib/calendar';
import { cancelReminders } from '@/lib/notifications';
import { formatDate, formatTime, formatCountdown, paymentLabel } from '@/lib/format';

const TABS = ['Upcoming', 'Past'] as const;
type Tab = typeof TABS[number];

export default function DatesScreen() {
  const { dates, hydrate, upcoming, past, cancelDate, rateDate } = useDatesStore();
  const [tab, setTab] = useState<Tab>('Upcoming');

  useEffect(() => { hydrate(); }, []);

  const upcomingList = upcoming();
  const pastList = past();

  const handleDirections = async (d: ConfirmedDate) => {
    const ok = await openInMaps({
      name: d.venue.name,
      address: d.venue.address,
      postcode: d.venue.postcode,
      lat: d.venue.lat,
      lng: d.venue.lng,
    });
    if (!ok) Alert.alert('Could not open Maps', 'Make sure you have a maps app installed.');
  };

  const handleAddCalendar = async (d: ConfirmedDate) => {
    const ok = await addDateToCalendar({
      title: `Date with ${d.with.name} — ${d.venue.name}`,
      notes: `${d.category} · ${paymentLabel(d.payment)}`,
      location: `${d.venue.name}, ${d.venue.address}, ${d.venue.postcode}, London`,
      startsAt: new Date(d.startsAt),
      durationMinutes: 90,
    });
    if (ok) Alert.alert('✓ Added to calendar', 'You\'ll get reminders 2 hours and 30 minutes before.');
  };

  const handleCancel = (d: ConfirmedDate) => {
    Alert.alert(
      `Cancel date with ${d.with.name}?`,
      `${d.venue.name}\n${formatDate(d.startsAt)} · ${formatTime(d.startsAt)}\n\nThey'll be notified respectfully and your reminders cancelled.`,
      [
        { text: 'Keep date', style: 'cancel' },
        {
          text: 'Cancel date',
          style: 'destructive',
          onPress: async () => {
            await cancelDate(d.id);
            await cancelReminders(d.reminderIds);
          },
        },
      ]
    );
  };

  const handleRate = (d: ConfirmedDate, rating: 1 | 2 | 3 | 4 | 5) => {
    rateDate(d.id, rating);
    Alert.alert('Thanks!', 'Your feedback helps us tailor better proposals.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Dates</Text>
        <Text style={styles.sub}>Real plans across London. No chat needed.</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const count = t === 'Upcoming' ? upcomingList.length : pastList.length;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t} {count > 0 && <Text style={styles.tabCount}>· {count}</Text>}
              </Text>
              {tab === t && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {tab === 'Upcoming' && (
          upcomingList.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={42} color={COLORS.BRAND} />
              </View>
              <Text style={styles.emptyTitle}>No upcoming dates yet</Text>
              <Text style={styles.emptySub}>
                Accept proposals from the Today tab to see your London dates here.
              </Text>
            </View>
          ) : (
            upcomingList.map((d) => {
              const countdown = formatCountdown(d.startsAt);
              const isUrgent = countdown === 'Today' || countdown.startsWith('In ') && countdown.includes('hour');
              const isTomorrow = countdown === 'Tomorrow';
              const bannerColor = isUrgent ? COLORS.BRAND : isTomorrow ? COLORS.WARNING_LIGHT : COLORS.SUCCESS_LIGHT;
              const bannerText = isUrgent ? '#fff' : isTomorrow ? COLORS.WARNING : COLORS.SUCCESS;

              return (
                <View key={d.id} style={styles.upcomingCard}>
                  <View style={[styles.statusBanner, { backgroundColor: bannerColor }]}>
                    <Ionicons name="time-outline" size={14} color={bannerText} />
                    <Text style={[styles.statusBannerText, { color: bannerText }]}>{countdown}</Text>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.profileRow}>
                      {d.with.photoUrl ? (
                        <Image source={{ uri: d.with.photoUrl }} style={styles.profileImg} />
                      ) : (
                        <View style={[styles.profileImg, styles.photoFallback]}>
                          <Ionicons name="person" size={26} color={COLORS.TEXT_MUTED} />
                        </View>
                      )}
                      <View style={styles.profileInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name}>{d.with.name}, {d.with.age}</Text>
                          {d.with.verified && <Ionicons name="shield-checkmark" size={14} color={COLORS.LIKE} />}
                        </View>
                        <Text style={styles.subText}>Date confirmed</Text>
                      </View>
                    </View>

                    <View style={styles.planBox}>
                      <View style={styles.planTop}>
                        <View style={styles.planEmojiBox}>
                          <Text style={styles.planEmoji}>{d.venue.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.planType}>{d.category}</Text>
                          <Text style={styles.planVenue}>{d.venue.name}</Text>
                        </View>
                      </View>

                      <View style={styles.planRow}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.TEXT_SECONDARY} />
                        <Text style={styles.planRowText}>{formatDate(d.startsAt)} · {formatTime(d.startsAt)}</Text>
                      </View>
                      <View style={styles.planRow}>
                        <Ionicons name="location-outline" size={14} color={COLORS.TEXT_SECONDARY} />
                        <Text style={styles.planRowText}>{d.venue.address}, {d.venue.postcode}</Text>
                      </View>
                      <View style={styles.planRow}>
                        <Ionicons name="train-outline" size={14} color={COLORS.TEXT_SECONDARY} />
                        <Text style={styles.planRowText}>{d.venue.tube} station</Text>
                      </View>
                      <View style={styles.planRow}>
                        <Ionicons name="card-outline" size={14} color={COLORS.TEXT_SECONDARY} />
                        <Text style={styles.planRowText}>{paymentLabel(d.payment)}</Text>
                      </View>
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => handleDirections(d)}>
                        <Ionicons name="navigate-outline" size={16} color={COLORS.BRAND} />
                        <Text style={styles.smallBtnText}>Directions</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => handleAddCalendar(d)}>
                        <Ionicons name="calendar-outline" size={16} color={COLORS.BRAND} />
                        <Text style={styles.smallBtnText}>To calendar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtnGhost} onPress={() => handleCancel(d)}>
                        <Ionicons name="close-outline" size={16} color={COLORS.TEXT_MUTED} />
                        <Text style={styles.smallBtnGhostText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.safetyTip}>
                      <Ionicons name="shield-outline" size={14} color={COLORS.INFO} />
                      <Text style={styles.safetyText}>
                        Meet in public · Share live location with a friend · SOS in Profile › Safety
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )
        )}

        {tab === 'Past' && (
          pastList.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={42} color={COLORS.BRAND} />
              </View>
              <Text style={styles.emptyTitle}>No past dates yet</Text>
              <Text style={styles.emptySub}>Your date history will appear here.</Text>
            </View>
          ) : (
            pastList.map((d) => (
              <View key={d.id} style={styles.pastCard}>
                <View style={styles.pastTop}>
                  {d.with.photoUrl ? (
                    <Image source={{ uri: d.with.photoUrl }} style={styles.pastImg} />
                  ) : (
                    <View style={[styles.pastImg, styles.photoFallback]}>
                      <Ionicons name="person" size={20} color={COLORS.TEXT_MUTED} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pastName}>{d.with.name}, {d.with.age}</Text>
                    <Text style={styles.pastWhen}>{formatDate(d.startsAt)} · {formatTime(d.startsAt)}</Text>
                  </View>
                  <Text style={styles.pastEmoji}>{d.venue.emoji}</Text>
                </View>

                <View style={styles.pastDetail}>
                  <Text style={styles.pastDetailText}>
                    <Text style={styles.pastDetailLabel}>{d.category}</Text> at {d.venue.name}
                    {d.status === 'cancelled' && <Text style={{ color: COLORS.ERROR }}> · Cancelled</Text>}
                  </Text>
                </View>

                {d.status === 'completed' && !d.rating ? (
                  <View style={styles.rateSection}>
                    <Text style={styles.rateLabel}>How was your date?</Text>
                    <View style={styles.rateBtnRow}>
                      <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate(d, 2)}>
                        <Text style={styles.rateBtnEmoji}>👎</Text>
                        <Text style={[styles.rateBtnText, { color: COLORS.ERROR }]}>Not great</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate(d, 3)}>
                        <Text style={styles.rateBtnEmoji}>😐</Text>
                        <Text style={styles.rateBtnText}>It was OK</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate(d, 5)}>
                        <Text style={styles.rateBtnEmoji}>✨</Text>
                        <Text style={[styles.rateBtnText, { color: COLORS.LIKE }]}>Loved it</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : d.rating ? (
                  <View style={styles.ratedBadge}>
                    <Ionicons
                      name={d.rating >= 4 ? 'heart' : d.rating >= 3 ? 'happy-outline' : 'sad-outline'}
                      size={14}
                      color={d.rating >= 4 ? COLORS.LIKE : d.rating >= 3 ? COLORS.WARNING : COLORS.ERROR}
                    />
                    <Text style={styles.ratedBadgeText}>
                      You rated this {d.rating >= 4 ? '✨ Loved it' : d.rating >= 3 ? '😐 OK' : '👎 Not great'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))
          )
        )}

        <View style={styles.philosophyFooter}>
          <Ionicons name="sparkles" size={14} color={COLORS.BRAND} />
          <Text style={styles.philosophyText}>
            Real connections happen face-to-face — across London — not through endless messages.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 3, fontWeight: '500' },

  tabs: {
    flexDirection: 'row', paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT, marginBottom: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT_MUTED },
  tabTextActive: { color: COLORS.BRAND, fontWeight: '800' },
  tabCount: { fontWeight: '600', color: COLORS.TEXT_MUTED },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 3,
    backgroundColor: COLORS.BRAND, borderRadius: 2,
  },

  scroll: { padding: 16, paddingBottom: 32 },
  upcomingCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 22, marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4,
  },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8,
  },
  statusBannerText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  cardBody: { padding: 18 },
  profileRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 14 },
  profileImg: { width: 64, height: 64, borderRadius: 20 },
  photoFallback: { backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  subText: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 3, fontWeight: '500' },

  planBox: {
    backgroundColor: COLORS.BG, borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  planEmojiBox: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
  },
  planEmoji: { fontSize: 22 },
  planType: { fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 0.5, textTransform: 'uppercase' },
  planVenue: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, marginTop: 2 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  planRowText: { fontSize: 13, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },

  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  smallBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.BRAND },
  smallBtnGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  smallBtnGhostText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED },

  safetyTip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.INFO_LIGHT, padding: 10, borderRadius: 11,
  },
  safetyText: { fontSize: 11, color: COLORS.INFO, fontWeight: '600', flex: 1, lineHeight: 15 },

  pastCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  pastTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  pastImg: { width: 50, height: 50, borderRadius: 16 },
  pastName: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT },
  pastWhen: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2, fontWeight: '500' },
  pastEmoji: { fontSize: 28 },
  pastDetail: { paddingVertical: 8, borderTopWidth: 1, borderColor: COLORS.BORDER_LIGHT, marginBottom: 10 },
  pastDetailText: { fontSize: 13, color: COLORS.TEXT_SECONDARY },
  pastDetailLabel: { fontWeight: '700', color: COLORS.TEXT },

  rateSection: { backgroundColor: COLORS.BG, borderRadius: 14, padding: 12 },
  rateLabel: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT, marginBottom: 10, textAlign: 'center' },
  rateBtnRow: { flexDirection: 'row', gap: 8 },
  rateBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  rateBtnEmoji: { fontSize: 22, marginBottom: 4 },
  rateBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  ratedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.BG, padding: 10, borderRadius: 12,
  },
  ratedBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_SECONDARY, flex: 1 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 26, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: COLORS.TEXT_MUTED, textAlign: 'center', lineHeight: 21 },

  philosophyFooter: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 24, paddingHorizontal: 32,
  },
  philosophyText: { fontSize: 12, color: COLORS.TEXT_MUTED, fontStyle: 'italic', textAlign: 'center', flex: 1 },
});
