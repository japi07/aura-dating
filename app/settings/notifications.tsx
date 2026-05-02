import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Switch, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface Toggle {
  key: string; label: string; desc: string; icon: string; value: boolean;
}

const INITIAL: Record<string, Toggle[]> = {
  Proposals: [
    { key: 'newProposal', label: 'New proposal received', desc: 'When someone sends you a date proposal', icon: 'mail', value: true },
    { key: 'proposalReminder', label: 'Daily proposal reminder', desc: 'A 9 AM ping when fresh proposals are ready', icon: 'sunny', value: true },
    { key: 'proposalExpiring', label: 'Proposal expiring soon', desc: '6 hours before a proposal auto-passes', icon: 'time', value: true },
  ],
  Dates: [
    { key: 'dateConfirmed', label: 'Date confirmed', desc: 'When the other person confirms a date', icon: 'checkmark-circle', value: true },
    { key: 'dateReminder', label: 'Date reminder', desc: '2 hours and 30 min before your date', icon: 'alarm', value: true },
    { key: 'dateRescheduled', label: 'Date rescheduled or cancelled', desc: 'Important: always recommended', icon: 'alert-circle', value: true },
    { key: 'dateRecap', label: 'Post-date check-in', desc: 'Rate your date the next morning', icon: 'star', value: true },
  ],
  Community: [
    { key: 'eventNearby', label: 'New events near you', desc: 'Curated group events you might love', icon: 'sparkles', value: true },
    { key: 'newsletter', label: 'Aura Weekly digest', desc: 'Stories, tips & seasonal date ideas', icon: 'newspaper', value: false },
    { key: 'productUpdates', label: 'Product updates', desc: 'New features and improvements', icon: 'gift', value: false },
  ],
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState(INITIAL);
  const [allMuted, setAllMuted] = useState(false);

  const toggle = (group: string, key: string) => {
    setGroups((g) => ({
      ...g,
      [group]: g[group].map((t) => t.key === key ? { ...t, value: !t.value } : t),
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Master toggle */}
        <View style={styles.masterCard}>
          <View style={styles.masterIcon}>
            <Ionicons name={allMuted ? 'notifications-off' : 'notifications'} size={24} color={allMuted ? COLORS.TEXT_MUTED : COLORS.BRAND} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.masterLabel}>Pause all notifications</Text>
            <Text style={styles.masterDesc}>{allMuted ? 'You won\'t receive any pings' : 'Get all the alerts you\'ve enabled below'}</Text>
          </View>
          <Switch
            value={allMuted}
            onValueChange={setAllMuted}
            trackColor={{ false: COLORS.BORDER, true: COLORS.BRAND }}
            thumbColor="#fff"
          />
        </View>

        {Object.entries(groups).map(([groupName, items]) => (
          <View key={groupName} style={styles.section}>
            <Text style={styles.sectionTitle}>{groupName}</Text>
            <View style={styles.card}>
              {items.map((t, i) => (
                <View key={t.key} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowIcon}>
                    <Ionicons name={t.icon as any} size={18} color={COLORS.BRAND} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{t.label}</Text>
                    <Text style={styles.rowDesc}>{t.desc}</Text>
                  </View>
                  <Switch
                    value={t.value && !allMuted}
                    onValueChange={() => toggle(groupName, t.key)}
                    disabled={allMuted}
                    trackColor={{ false: COLORS.BORDER, true: COLORS.BRAND }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.TEXT_MUTED} />
          <Text style={styles.footerText}>
            Some critical date notifications can't be disabled for safety reasons.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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

  masterCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 8, padding: 16,
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.BRAND + '30',
  },
  masterIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
  },
  masterLabel: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  masterDesc: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 3 },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 8 },
  card: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  rowDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2, lineHeight: 16 },

  footer: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: 20 },
  footerText: { fontSize: 11, color: COLORS.TEXT_MUTED, textAlign: 'center', flex: 1, lineHeight: 16 },
});
