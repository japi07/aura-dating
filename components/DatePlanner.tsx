import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Modal, Pressable, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { DateField } from './DateField';

/** One day, with however many time slots the sender is free for. */
export interface DayPlan {
  /** ISO date, 'YYYY-MM-DD' */
  date: string;
  /** 24h times, 'HH:MM' */
  slots: string[];
}

interface DatePlannerProps {
  value: DayPlan[];
  onChange: (next: DayPlan[]) => void;
  maxDays?: number;
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Fri Sep 11' */
function prettyDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** '6:00 PM' */
function prettyTime(hhmm: string): string {
  const [h0, m] = hhmm.split(':');
  let h = parseInt(h0, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Availability planner: the sender picks the days that work and, within each,
 * the times they're free. The recipient then chooses whichever slot suits her,
 * rather than the whole date hinging on one take-it-or-leave-it time.
 */
export function DatePlanner({ value, onChange, maxDays = 5, error }: DatePlannerProps) {
  // Which day we're currently adding a time to (index), or null
  const [addingFor, setAddingFor] = useState<number | null>(null);
  // Bumping this remounts the date field so it clears after each pick
  const [dateKey, setDateKey] = useState(0);

  const addDay = (iso: string) => {
    if (!iso) return;
    setDateKey((k) => k + 1);
    if (value.some((d) => d.date === iso)) return; // already offered
    if (value.length >= maxDays) return;
    const next = [...value, { date: iso, slots: [] }]
      .sort((a, b) => a.date.localeCompare(b.date));
    onChange(next);
  };

  const removeDay = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const addSlot = (dayIndex: number, hhmm: string) => {
    const next = value.map((d, idx) => {
      if (idx !== dayIndex) return d;
      if (d.slots.includes(hhmm)) return d;
      return { ...d, slots: [...d.slots, hhmm].sort() };
    });
    onChange(next);
    setAddingFor(null);
  };

  const removeSlot = (dayIndex: number, hhmm: string) =>
    onChange(value.map((d, idx) =>
      idx === dayIndex ? { ...d, slots: d.slots.filter((s) => s !== hhmm) } : d,
    ));

  const totalSlots = value.reduce((n, d) => n + d.slots.length, 0);

  return (
    <View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>
          {totalSlots > 0
            ? `${totalSlots} time${totalSlots > 1 ? 's' : ''} offered`
            : 'Add the days and times that work for you'}
        </Text>
        {totalSlots > 0 && (
          <View style={styles.legendKey}>
            <View style={styles.checkSmall}><Ionicons name="checkmark" size={10} color="#fff" /></View>
            <Text style={styles.legendKeyText}>you're free</Text>
          </View>
        )}
      </View>

      {value.map((day, i) => (
        <View key={day.date} style={styles.dayBlock}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>{prettyDay(day.date)}</Text>
            <TouchableOpacity onPress={() => removeDay(i)} hitSlop={hit}>
              <Ionicons name="trash-outline" size={16} color={COLORS.TEXT_MUTED} />
            </TouchableOpacity>
          </View>

          {day.slots.map((s) => (
            <View key={s} style={styles.slotRow}>
              <Text style={styles.slotTime}>{prettyTime(s)}</Text>
              <View style={styles.check}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
              <TouchableOpacity onPress={() => removeSlot(i, s)} hitSlop={hit} style={styles.slotRemove}>
                <Ionicons name="close" size={14} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addSlotRow} onPress={() => setAddingFor(i)} activeOpacity={0.7}>
            <Text style={styles.addSlotText}>Add a time slot</Text>
            <View style={styles.plusBox}>
              <Ionicons name="add" size={16} color={COLORS.BRAND} />
            </View>
          </TouchableOpacity>
        </View>
      ))}

      {/* Adding a day reuses the calendar picker */}
      {value.length < maxDays && (
        <View style={styles.addDayWrap}>
          <DateField
            key={dateKey}
            label={value.length === 0 ? 'Pick a day' : 'Add another day'}
            value=""
            onChange={addDay}
            mode="future"
            placeholder={value.length === 0 ? 'Choose a date' : '+ Add more days'}
          />
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Time slot picker */}
      <Modal
        visible={addingFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAddingFor(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAddingFor(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>
              {addingFor !== null && value[addingFor] ? prettyDay(value[addingFor].date) : 'Choose a time'}
            </Text>
            <Text style={styles.sheetSub}>What time suits you?</Text>
            <ScrollView style={{ maxHeight: 330 }} showsVerticalScrollIndicator={false}>
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map((t) => {
                  const taken = addingFor !== null && value[addingFor]?.slots.includes(t);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timeChip, taken && styles.timeChipTaken]}
                      disabled={taken}
                      onPress={() => addingFor !== null && addSlot(addingFor, t)}
                    >
                      <Text style={[styles.timeChipText, taken && styles.timeChipTextTaken]}>
                        {prettyTime(t)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setAddingFor(null)}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

// 11:00 to 22:30, on the half hour — the realistic window for a date
const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 11; h <= 22; h++) {
    out.push(`${pad(h)}:00`);
    if (h !== 22) out.push(`${pad(h)}:30`);
  }
  return out;
})();

/** Flatten a plan into ISO datetimes, oldest first. */
export function planToISO(days: DayPlan[]): string[] {
  const out: string[] = [];
  for (const d of days) {
    for (const s of d.slots) {
      const dt = new Date(`${d.date}T${s}:00`);
      if (!isNaN(dt.getTime())) out.push(dt.toISOString());
    }
  }
  return out.sort();
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  legendText: { fontSize: 12, color: COLORS.TEXT_MUTED, fontWeight: '600', flex: 1 },
  legendKey: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendKeyText: { fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  checkSmall: {
    width: 16, height: 16, borderRadius: 5, backgroundColor: COLORS.LIKE,
    justifyContent: 'center', alignItems: 'center',
  },

  dayBlock: {
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT, borderRadius: 16,
    marginBottom: 12, overflow: 'hidden', backgroundColor: COLORS.SURFACE,
  },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11, backgroundColor: COLORS.BG,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT,
  },
  dayLabel: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT },

  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT,
  },
  slotTime: { flex: 1, fontSize: 15, color: COLORS.TEXT, fontWeight: '600' },
  check: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.LIKE,
    justifyContent: 'center', alignItems: 'center',
  },
  slotRemove: { padding: 2 },

  addSlotRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
  },
  addSlotText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  plusBox: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },

  addDayWrap: { marginTop: 2 },
  errorText: { fontSize: 12, color: COLORS.ERROR, fontWeight: '600', marginTop: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,16,40,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  sheet: { backgroundColor: COLORS.SURFACE, borderRadius: 22, padding: 18 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT, textAlign: 'center' },
  sheetSub: { fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 3, marginBottom: 14 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  timeChip: {
    width: '31%', paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: COLORS.BG, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT,
  },
  timeChipTaken: { backgroundColor: COLORS.LIKE_BG, borderColor: COLORS.LIKE },
  timeChipText: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  timeChipTextTaken: { color: COLORS.LIKE },
  closeBtn: { marginTop: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.BRAND, borderRadius: 14 },
  closeText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
