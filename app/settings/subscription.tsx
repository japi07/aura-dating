import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

const PERKS = [
  { icon: 'mail', title: '5 proposals per day', desc: 'Get more options without sacrificing curation' },
  { icon: 'eye-off', title: 'Incognito mode', desc: 'Browse anonymously when you choose' },
  { icon: 'sparkles', title: 'Priority matching', desc: 'Verified Gold profiles get curated first every day' },
  { icon: 'star', title: 'See who proposed', desc: 'Preview new proposals before opening them' },
  { icon: 'flash', title: '1 instant date weekly', desc: 'Skip the queue with a curated same-day match' },
  { icon: 'ticket', title: 'Exclusive events', desc: 'Members-only group events & dinners' },
];

const PLANS = [
  { id: 'monthly', label: '1 month', price: '$24.99', perMonth: '$24.99/mo' },
  { id: 'sixmonth', label: '6 months', price: '$89.99', perMonth: '$15.00/mo', discount: '40% off', popular: true },
  { id: 'yearly', label: '12 months', price: '$149.99', perMonth: '$12.50/mo', discount: '50% off' },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState('sixmonth');

  const subscribe = () => {
    const plan = PLANS.find(p => p.id === selectedPlan);
    Alert.alert(
      'Subscribe to Aura Gold',
      `${plan?.label} plan — ${plan?.price}\n\n(In a real app, this would open Apple Pay / Google Pay.)`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="close" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <View />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.diamondGlow} />
          <View style={styles.diamondInner}>
            <Ionicons name="diamond" size={40} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Aura Gold</Text>
          <Text style={styles.heroSub}>Curated dating, elevated.</Text>
        </View>

        {/* Perks */}
        <View style={styles.perksSection}>
          {PERKS.map((p, i) => (
            <View key={p.title} style={styles.perkRow}>
              <View style={styles.perkIcon}>
                <Ionicons name={p.icon as any} size={20} color={COLORS.GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkDesc}>{p.desc}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.LIKE} />
            </View>
          ))}
        </View>

        {/* Plans */}
        <Text style={styles.plansTitle}>Choose your plan</Text>
        <View style={styles.plansRow}>
          {PLANS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.planCard, selectedPlan === p.id && styles.planCardActive]}
              onPress={() => setSelectedPlan(p.id)}
              activeOpacity={0.85}
            >
              {p.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>BEST VALUE</Text>
                </View>
              )}
              <Text style={[styles.planLabel, selectedPlan === p.id && { color: COLORS.GOLD }]}>{p.label}</Text>
              <Text style={[styles.planPrice, selectedPlan === p.id && { color: '#fff' }]}>{p.price}</Text>
              <Text style={[styles.planMo, selectedPlan === p.id && { color: 'rgba(255,255,255,0.85)' }]}>{p.perMonth}</Text>
              {p.discount && (
                <View style={styles.discountPill}>
                  <Text style={styles.discountText}>{p.discount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity style={styles.ctaBtn} onPress={subscribe} activeOpacity={0.85}>
            <Ionicons name="diamond" size={18} color={COLORS.TEXT} />
            <Text style={styles.ctaText}>Become a Gold Member</Text>
          </TouchableOpacity>
          <Text style={styles.smallText}>Cancel anytime · Auto-renews · Restored across devices</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  diamondGlow: {
    position: 'absolute', top: 16, width: 140, height: 140, borderRadius: 70,
    backgroundColor: COLORS.GOLD, opacity: 0.18,
  },
  diamondInner: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.GOLD,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: COLORS.GOLD, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  heroTitle: { fontSize: 32, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.5, marginBottom: 4 },
  heroSub: { fontSize: 14, color: COLORS.TEXT_MUTED, fontWeight: '500' },

  perksSection: {
    marginHorizontal: 16, marginTop: 12, padding: 18,
    backgroundColor: COLORS.SURFACE, borderRadius: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  perkIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.GOLD + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  perkTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, marginBottom: 2 },
  perkDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, lineHeight: 16 },

  plansTitle: {
    fontSize: 13, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1,
    textTransform: 'uppercase', textAlign: 'center', marginTop: 28, marginBottom: 14,
  },
  plansRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 24 },
  planCard: {
    flex: 1, padding: 14, borderRadius: 18, backgroundColor: COLORS.SURFACE,
    borderWidth: 2, borderColor: COLORS.BORDER, alignItems: 'center', position: 'relative',
  },
  planCardActive: {
    backgroundColor: COLORS.GOLD, borderColor: COLORS.GOLD,
    shadowColor: COLORS.GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  popularBadge: {
    position: 'absolute', top: -10, alignSelf: 'center',
    backgroundColor: COLORS.BRAND, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  popularText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  planLabel: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED, marginTop: 6, marginBottom: 4, textTransform: 'uppercase' },
  planPrice: { fontSize: 18, fontWeight: '900', color: COLORS.TEXT, marginBottom: 4 },
  planMo: { fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  discountPill: { marginTop: 6, backgroundColor: COLORS.LIKE, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  discountText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  ctaWrap: { paddingHorizontal: 16 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.GOLD, borderRadius: 18, paddingVertical: 16,
    shadowColor: COLORS.GOLD, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
  ctaText: { fontSize: 15, fontWeight: '900', color: COLORS.TEXT },
  smallText: { fontSize: 11, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});
