import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Image, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

const SAFETY_TIPS = [
  { icon: 'people', title: 'Always meet in public', desc: 'Restaurants, cafés, parks. We pre-vet every venue our matchmakers suggest.' },
  { icon: 'share-social', title: 'Share your location', desc: 'Send a friend your live location during the date.' },
  { icon: 'wallet', title: 'Get there yourself', desc: 'Don\'t accept rides. Use your own transport.' },
  { icon: 'wine', title: 'Trust your gut', desc: 'Don\'t leave drinks unattended. Leave anytime — no judgment.' },
  { icon: 'call', title: 'Have an exit plan', desc: 'Use our in-app SOS button. We can call you a ride or alert your contacts.' },
];

const BLOCKED_USERS = [
  { id: 'b1', name: 'Mark', age: 35, photoUrl: 'https://i.pravatar.cc/150?img=33', blockedDate: '2 weeks ago', reason: 'Inappropriate behavior' },
  { id: 'b2', name: 'Aaron', age: 31, photoUrl: 'https://i.pravatar.cc/150?img=34', blockedDate: '1 month ago', reason: 'Pushy after no' },
];

export default function SafetyScreen() {
  const router = useRouter();
  const [blocked, setBlocked] = useState(BLOCKED_USERS);

  const unblock = (id: string, name: string) => {
    Alert.alert(`Unblock ${name}?`, 'They\'ll be able to send you proposals again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => setBlocked((b) => b.filter(x => x.id !== id)) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Safety</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* SOS card */}
        <View style={styles.sosCard}>
          <View style={styles.sosIconWrap}>
            <Ionicons name="warning" size={28} color="#fff" />
          </View>
          <Text style={styles.sosTitle}>SOS button</Text>
          <Text style={styles.sosDesc}>
            On a date and feel uncomfortable? Tap SOS to silently alert your emergency contacts and get help.
          </Text>
          <TouchableOpacity style={styles.sosBtn}>
            <Text style={styles.sosBtnText}>Set up SOS</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.ERROR} />
          </TouchableOpacity>
        </View>

        {/* Emergency contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency contacts</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} activeOpacity={0.7}>
              <View style={[styles.rowIcon, { backgroundColor: COLORS.LIKE + '18' }]}>
                <Ionicons name="person-add" size={18} color={COLORS.LIKE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Add a trusted contact</Text>
                <Text style={styles.rowDesc}>They'll be notified if you trigger SOS</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Safety tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety tips for first dates</Text>
          <View style={styles.card}>
            {SAFETY_TIPS.map((t, i) => (
              <View key={t.title} style={[styles.tipRow, i < SAFETY_TIPS.length - 1 && styles.rowBorder]}>
                <View style={styles.tipIcon}>
                  <Ionicons name={t.icon as any} size={20} color={COLORS.BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t.title}</Text>
                  <Text style={styles.tipDesc}>{t.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Blocked users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blocked ({blocked.length})</Text>
          {blocked.length === 0 ? (
            <View style={[styles.card, { padding: 24, alignItems: 'center' }]}>
              <Text style={styles.emptyText}>No one is blocked.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {blocked.map((u, i) => (
                <View key={u.id} style={[styles.blockRow, i < blocked.length - 1 && styles.rowBorder]}>
                  <Image source={{ uri: u.photoUrl }} style={styles.blockAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blockName}>{u.name}, {u.age}</Text>
                    <Text style={styles.blockMeta}>{u.reason} · blocked {u.blockedDate}</Text>
                  </View>
                  <TouchableOpacity style={styles.unblockBtn} onPress={() => unblock(u.id, u.name)}>
                    <Text style={styles.unblockText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Report */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} activeOpacity={0.7}>
              <View style={[styles.rowIcon, { backgroundColor: COLORS.ERROR_LIGHT }]}>
                <Ionicons name="flag" size={18} color={COLORS.ERROR} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: COLORS.ERROR }]}>Report someone</Text>
                <Text style={styles.rowDesc}>Inappropriate behavior, harassment, or no-show</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
            </TouchableOpacity>
          </View>
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

  sosCard: {
    marginHorizontal: 16, marginTop: 8, padding: 20, borderRadius: 22,
    backgroundColor: COLORS.ERROR, alignItems: 'center',
    shadowColor: COLORS.ERROR, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  sosIconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  sosTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  sosDesc: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
  },
  sosBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.ERROR },

  section: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 8 },
  card: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  rowDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  tipIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, marginBottom: 3 },
  tipDesc: { fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 17 },

  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  blockAvatar: { width: 46, height: 46, borderRadius: 23 },
  blockName: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  blockMeta: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.BG, borderWidth: 1, borderColor: COLORS.BORDER },
  unblockText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  emptyText: { fontSize: 14, color: COLORS.TEXT_MUTED },
});
