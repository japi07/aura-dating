import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useAuthStore } from '@/store/auth';
import { useUsersStore, type DirectoryUser } from '@/store/users';
import { MemberCard } from '@/components/MemberCard';
import { MemberDetailSheet } from '@/components/MemberDetailSheet';

const CARD_W = Dimensions.get('window').width - 32;

/**
 * Browse the members you could invite. Deliberately a considered list rather
 * than an endless swipe feed — you see who's here, open a full profile, and
 * decide to propose.
 */
export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { candidatesFor, hydrate, isHydrated, refreshFromServer } = useUsersStore();
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState<DirectoryUser | null>(null);

  // Always pull the latest members when the tab opens — someone who signed up
  // after this session started otherwise stays invisible until a manual refresh.
  useEffect(() => {
    if (!isHydrated) hydrate();
    else refreshFromServer();
  }, []);

  const people: DirectoryUser[] = user?.email
    ? candidatesFor(user.email, { genderInterest: user.genderInterest, myGender: user.gender })
    : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFromServer();
    setRefreshing(false);
  }, [refreshFromServer]);

  const propose = (p: DirectoryUser) => {
    setPreviewing(null);
    router.push({ pathname: '/proposal/create', params: { recipientEmail: p.email } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.sub}>
            {people.length > 0
              ? `${people.length} member${people.length > 1 ? 's' : ''} in London`
              : 'Members you could invite on a date'}
          </Text>
        </View>
        <TouchableOpacity style={styles.composeBtn} onPress={() => router.push('/proposal/create')}>
          <Ionicons name="videocam" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />
        }
      >
        {!isHydrated ? (
          <View style={styles.empty}>
            <ActivityIndicator color={COLORS.BRAND} />
          </View>
        ) : people.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={40} color={COLORS.BRAND} />
            </View>
            <Text style={styles.emptyTitle}>No one here yet</Text>
            <Text style={styles.emptySub}>
              As more members join Aura in London, they'll appear here. Pull down to refresh.
            </Text>
          </View>
        ) : (
          people.map((p) => (
            <MemberCard
              key={p.email}
              width={CARD_W}
              person={p}
              onPress={() => setPreviewing(p)}
              footer={
                <View style={{ gap: 8 }}>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => setPreviewing(p)} activeOpacity={0.8}>
                    <Ionicons name="expand-outline" size={15} color={COLORS.TEXT_SECONDARY} />
                    <Text style={styles.viewText}>View full profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.proposeBtn} onPress={() => propose(p)} activeOpacity={0.88}>
                    <Ionicons name="heart" size={17} color="#fff" />
                    <Text style={styles.proposeText}>Propose a date</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ))
        )}
      </ScrollView>

      <MemberDetailSheet
        person={previewing}
        visible={!!previewing}
        onClose={() => setPreviewing(null)}
        ctaLabel={previewing ? `Propose to ${previewing.name.split(' ')[0]}` : undefined}
        onCta={() => previewing && propose(previewing)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 2 },
  composeBtn: {
    width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.38,
    shadowRadius: 10, elevation: 6,
  },

  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },

  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12,
    backgroundColor: COLORS.BG, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  viewText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  proposeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.BRAND,
  },
  proposeText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 26, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.TEXT_MUTED, textAlign: 'center', lineHeight: 21 },
});
