import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Modal, Pressable, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface TimeFieldProps {
  label?: string;
  /** 24h 'HH:MM' */
  value?: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  error?: string;
  /** first / last selectable hour (inclusive), default 8–23 */
  minHour?: number;
  maxHour?: number;
  /** step in minutes, default 30 */
  stepMinutes?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Pretty 24h → "7:30 PM" */
function pretty(hhmm?: string): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export function TimeField({
  label, value, onChange, placeholder, error,
  minHour = 8, maxHour = 23, stepMinutes = 30,
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);

  const slots: string[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      slots.push(`${pad(h)}:${pad(m)}`);
    }
  }

  const pick = (s: string) => { onChange(s); setOpen(false); };

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.field, error && styles.fieldError]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="time-outline" size={18} color={COLORS.TEXT_MUTED} />
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {value ? pretty(value) : (placeholder || 'Select a time')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.TEXT_MUTED} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Choose a time</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {slots.map((s) => {
                  const on = s === value;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.slot, on && styles.slotOn]}
                      onPress={() => pick(s)}
                    >
                      <Text style={[styles.slotText, on && styles.slotTextOn]}>{pretty(s)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY, marginBottom: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: COLORS.BORDER,
  },
  fieldError: { borderColor: COLORS.ERROR },
  valueText: { flex: 1, fontSize: 15, color: COLORS.TEXT, fontWeight: '500' },
  placeholderText: { color: COLORS.TEXT_MUTED, fontWeight: '400' },
  errorText: { fontSize: 12, color: COLORS.ERROR, marginTop: 5, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,16,40,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  sheet: { backgroundColor: COLORS.SURFACE, borderRadius: 22, padding: 18 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, textAlign: 'center', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  slot: {
    width: '31%', paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: COLORS.BG, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT,
  },
  slotOn: { backgroundColor: COLORS.BRAND, borderColor: COLORS.BRAND },
  slotText: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  slotTextOn: { color: '#fff' },
  closeBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  closeText: { fontSize: 14, fontWeight: '700', color: COLORS.BRAND },
});
