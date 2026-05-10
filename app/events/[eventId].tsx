import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { addDateToCalendar } from '@/lib/calendar';
import { openInMaps } from '@/lib/maps';

/**
 * Event detail screen.
 * In production the event data is fetched by id from the events API.
 * For now, no events exist so we show a graceful empty state.
 */
export default function EventDetailScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const close = () => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/events');
    }
  };

  // No real event data yet — once the events API is wired up, fetch by eventId here
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.back} onPress={close}>
          <Ionicons name="close" size={20} color={COLORS.TEXT} />
        </TouchableOpacity>
      </View>

      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="calendar-outline" size={42} color={COLORS.BRAND} />
        </View>
        <Text style={styles.emptyTitle}>This event isn't available</Text>
        <Text style={styles.emptySub}>
          It may have been cancelled or you're using a stale link. Take a look at the upcoming London events instead.
        </Text>

        <TouchableOpacity style={styles.backBtn} onPress={close}>
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={styles.backBtnText}>Back to events</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  topBar: { paddingHorizontal: 14, paddingVertical: 10 },
  back: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.SHADOW, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 28, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 22,
  },
  emptyTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.TEXT, marginBottom: 10,
    letterSpacing: -0.5, textAlign: 'center',
  },
  emptySub: {
    fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center',
    lineHeight: 21, marginBottom: 28,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 26,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  backBtnText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
