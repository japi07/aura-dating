import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface DateFieldProps {
  label?: string;
  /** ISO date 'YYYY-MM-DD' */
  value?: string;
  onChange: (iso: string) => void;
  /** 'past' for birthdays, 'future' for planning a date */
  mode?: 'past' | 'future';
  placeholder?: string;
  error?: string;
  icon?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseISO(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
}

function prettyDate(s?: string): string {
  const d = parseISO(s);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function DateField({ label, value, onChange, mode = 'past', placeholder, error, icon }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();

  // Default the calendar view: birthdays open ~25 years back, planning opens today
  const initial = parseISO(value) ?? (mode === 'past'
    ? new Date(today.getFullYear() - 25, today.getMonth(), 1)
    : today);
  const [viewY, setViewY] = useState(initial.getFullYear());
  const [viewM, setViewM] = useState(initial.getMonth());

  const minDate = mode === 'past' ? new Date(today.getFullYear() - 100, 0, 1) : startOfDay(today);
  const maxDate = mode === 'past' ? startOfDay(today) : new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const firstWeekday = (new Date(viewY, viewM, 1).getDay() + 6) % 7; // Monday-based
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selected = parseISO(value);
  const isSelected = (d: number) =>
    selected && selected.getFullYear() === viewY && selected.getMonth() === viewM && selected.getDate() === d;
  const isDisabled = (d: number) => {
    const dt = new Date(viewY, viewM, d);
    return dt < minDate || dt > maxDate;
  };

  const step = (deltaMonths: number) => {
    let m = viewM + deltaMonths;
    let y = viewY;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setViewM(m); setViewY(y);
  };

  const pick = (d: number) => {
    if (isDisabled(d)) return;
    onChange(toISO(viewY, viewM, d));
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.field, error && styles.fieldError]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name={(icon as any) || 'calendar-outline'} size={18} color={COLORS.TEXT_MUTED} />
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {value ? prettyDate(value) : (placeholder || 'Select a date')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.TEXT_MUTED} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Header: year + month steppers */}
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => step(-12)} hitSlop={hit}><Ionicons name="play-back" size={18} color={COLORS.BRAND} /></TouchableOpacity>
              <TouchableOpacity onPress={() => step(-1)} hitSlop={hit}><Ionicons name="chevron-back" size={22} color={COLORS.BRAND} /></TouchableOpacity>
              <Text style={styles.calTitle}>{MONTHS[viewM]} {viewY}</Text>
              <TouchableOpacity onPress={() => step(1)} hitSlop={hit}><Ionicons name="chevron-forward" size={22} color={COLORS.BRAND} /></TouchableOpacity>
              <TouchableOpacity onPress={() => step(12)} hitSlop={hit}><Ionicons name="play-forward" size={18} color={COLORS.BRAND} /></TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => <Text key={w} style={styles.weekday}>{w}</Text>)}
            </View>

            <View style={styles.grid}>
              {cells.map((d, i) => (
                <View key={i} style={styles.cell}>
                  {d ? (
                    <TouchableOpacity
                      style={[styles.day, isSelected(d) && styles.daySelected, isDisabled(d) && styles.dayDisabled]}
                      onPress={() => pick(d)}
                      disabled={isDisabled(d)}
                    >
                      <Text style={[styles.dayText, isSelected(d) && styles.dayTextSelected, isDisabled(d) && styles.dayTextDisabled]}>{d}</Text>
                    </TouchableOpacity>
                  ) : <View style={styles.day} />}
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

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
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 },
  calTitle: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, flex: 1, textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  daySelected: { backgroundColor: COLORS.BRAND },
  dayDisabled: { opacity: 0.3 },
  dayText: { fontSize: 14, color: COLORS.TEXT, fontWeight: '600' },
  dayTextSelected: { color: '#fff', fontWeight: '800' },
  dayTextDisabled: { color: COLORS.TEXT_MUTED },
  closeBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  closeText: { fontSize: 14, fontWeight: '700', color: COLORS.BRAND },
});
