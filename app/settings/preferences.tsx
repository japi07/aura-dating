import React, { useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useSettingsStore } from '@/store/settings';

const DATE_TYPES = [
  { id: 'dinner', label: 'Dinner', emoji: '🍷' },
  { id: 'lunch', label: 'Lunch', emoji: '🥗' },
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'drinks', label: 'Drinks', emoji: '🍸' },
  { id: 'walk', label: 'Walks', emoji: '🌳' },
  { id: 'gallery', label: 'Galleries', emoji: '🎨' },
  { id: 'cooking', label: 'Cooking', emoji: '🍝' },
  { id: 'concert', label: 'Concerts', emoji: '🎶' },
  { id: 'workshop', label: 'Workshops', emoji: '🏺' },
  { id: 'sport', label: 'Activities', emoji: '🚴' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const INTENTIONS = [
  { id: 'serious', label: 'Long-term relationship', icon: 'infinite' },
  { id: 'dating', label: 'Dating intentionally', icon: 'heart' },
  { id: 'open', label: 'Open to seeing where things go', icon: 'leaf' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { dates, hydrate, isHydrated, updateDates } = useSettingsStore();

  useEffect(() => { if (!isHydrated) hydrate(); }, []);

  const selectedTypes = dates.dateTypes;
  const ageMin = dates.ageMin;
  const ageMax = dates.ageMax;
  const radius = dates.radiusKm;
  const availableDays = dates.availableDays;
  const intention = dates.intention;
  const proposalsPerDay = dates.proposalsPerDay;

  const setAgeMin = (v: number) => updateDates({ ageMin: v });
  const setAgeMax = (v: number) => updateDates({ ageMax: v });
  const setRadius = (v: number) => updateDates({ radiusKm: v });
  const setIntention = (v: any) => updateDates({ intention: v });
  const setProposalsPerDay = (v: any) => updateDates({ proposalsPerDay: v });

  const toggleType = (id: string) => {
    const next = selectedTypes.includes(id)
      ? selectedTypes.filter(x => x !== id)
      : [...selectedTypes, id];
    updateDates({ dateTypes: next });
  };
  const toggleDay = (day: string) => {
    const next = availableDays.includes(day)
      ? availableDays.filter(x => x !== day)
      : [...availableDays, day];
    updateDates({ availableDays: next });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Date preferences</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* What I'm looking for */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What I'm looking for</Text>
          <View style={styles.card}>
            {INTENTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.row, i < INTENTIONS.length - 1 && styles.rowBorder]}
                onPress={() => setIntention(opt.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, intention === opt.id && { backgroundColor: COLORS.BRAND }]}>
                  <Ionicons name={opt.icon as any} size={18} color={intention === opt.id ? '#fff' : COLORS.BRAND} />
                </View>
                <Text style={[styles.rowLabel, { flex: 1 }]}>{opt.label}</Text>
                <View style={[styles.radio, intention === opt.id && styles.radioOn]}>
                  {intention === opt.id && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Age range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Age range</Text>
          <View style={styles.sliderCard}>
            <Text style={styles.sliderValue}>{ageMin} – {ageMax} years</Text>
            <View style={styles.sliderRow}>
              <Stepper label="Min" value={ageMin} onMinus={() => setAgeMin(Math.max(18, ageMin - 1))} onPlus={() => setAgeMin(Math.min(ageMax - 1, ageMin + 1))} />
              <Stepper label="Max" value={ageMax} onMinus={() => setAgeMax(Math.max(ageMin + 1, ageMax - 1))} onPlus={() => setAgeMax(Math.min(80, ageMax + 1))} />
            </View>
          </View>
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distance from me</Text>
          <View style={styles.sliderCard}>
            <Text style={styles.sliderValue}>{radius} km</Text>
            <View style={styles.distanceRow}>
              {[5, 10, 15, 25, 50, 100].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.distancePill, radius === d && styles.distancePillActive]}
                  onPress={() => setRadius(d)}
                >
                  <Text style={[styles.distanceText, radius === d && styles.distanceTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Date types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date types I enjoy</Text>
          <Text style={styles.sectionHint}>Pick at least 3 — we'll only send proposals you'd say yes to</Text>
          <View style={styles.typeGrid}>
            {DATE_TYPES.map((t) => {
              const selected = selectedTypes.includes(t.id);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeChip, selected && styles.typeChipActive]}
                  onPress={() => toggleType(t.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.typeLabel, selected && { color: COLORS.BRAND }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Available days */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Days I'm usually free</Text>
          <View style={styles.dayRow}>
            {DAYS.map((d) => {
              const selected = availableDays.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayChip, selected && styles.dayChipActive]}
                  onPress={() => toggleDay(d)}
                >
                  <Text style={[styles.dayText, selected && { color: '#fff' }]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Proposals per day */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proposals per day</Text>
          <Text style={styles.sectionHint}>Less is more. Quality over quantity, always.</Text>
          <View style={styles.card}>
            {[1, 2, 3, 5].map((n, i) => (
              <TouchableOpacity
                key={n}
                style={[styles.row, i < 3 && styles.rowBorder]}
                onPress={() => setProposalsPerDay(n)}
                activeOpacity={0.7}
              >
                <View style={styles.numIcon}>
                  <Text style={styles.numIconText}>{n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{n} {n === 1 ? 'proposal' : 'proposals'} per day</Text>
                  <Text style={styles.rowDesc}>
                    {n === 1 ? 'Maximum focus' : n === 2 ? 'Just the right amount' : n === 3 ? 'Recommended' : 'Maximum (Gold only)'}
                  </Text>
                </View>
                <View style={[styles.radio, proposalsPerDay === n && styles.radioOn]}>
                  {proposalsPerDay === n && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ label, value, onMinus, onPlus }: any) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={onMinus}>
          <Ionicons name="remove" size={16} color={COLORS.BRAND} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onPlus}>
          <Ionicons name="add" size={16} color={COLORS.BRAND} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  saveText: { fontSize: 15, fontWeight: '800', color: COLORS.BRAND, paddingHorizontal: 16 },

  section: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 8 },
  sectionHint: { fontSize: 12, color: COLORS.TEXT_MUTED, paddingHorizontal: 24, marginBottom: 10, fontStyle: 'italic' },

  card: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  rowDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.BORDER, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: COLORS.BRAND },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.BRAND },

  numIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  numIconText: { fontSize: 16, fontWeight: '900', color: COLORS.BRAND },

  sliderCard: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  sliderValue: { fontSize: 22, fontWeight: '800', color: COLORS.BRAND, marginBottom: 14, textAlign: 'center' },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },

  stepper: { flex: 1, alignItems: 'center', backgroundColor: COLORS.BG, borderRadius: 12, padding: 12 },
  stepperLabel: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  stepperValue: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT, minWidth: 32, textAlign: 'center' },

  distanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  distancePill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: COLORS.BG, borderWidth: 1.5, borderColor: COLORS.BORDER,
    minWidth: 60, alignItems: 'center',
  },
  distancePillActive: { backgroundColor: COLORS.BRAND, borderColor: COLORS.BRAND },
  distanceText: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT_SECONDARY },
  distanceTextActive: { color: '#fff' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER,
  },
  typeChipActive: { backgroundColor: COLORS.BRAND_MUTED, borderColor: COLORS.BRAND },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, gap: 6 },
  dayChip: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER,
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: COLORS.BRAND, borderColor: COLORS.BRAND },
  dayText: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_SECONDARY, letterSpacing: 0.5 },
});
