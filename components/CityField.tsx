import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

/**
 * Aura is London-only at launch, so city isn't a free-text field — it's fixed
 * to London with a note that more cities are coming. Screens should keep their
 * city state set to "London".
 */
export function CityField({ label = 'City' }: { label?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <Ionicons name="location" size={18} color={COLORS.BRAND} />
        <Text style={styles.value}>London</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>More cities soon</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY, marginBottom: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: COLORS.BRAND + '30',
  },
  value: { flex: 1, fontSize: 15, color: COLORS.TEXT, fontWeight: '700' },
  badge: { backgroundColor: COLORS.SURFACE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.BRAND },
});
