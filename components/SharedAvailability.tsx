import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Modal, Pressable, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { DateField } from './DateField';
import type { DayPlan } from './DatePlanner';

const hit = { top: 8, bottom: 8, left: 8, right: 8 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

function prettyDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function prettyTime(hhmm: string): string {
  const [h0, m] = hhmm.split(':');
  let h = parseInt(h0, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${m}${ampm}`;
}

/** Half-hourly, 11:00 to 22:30 — the same grid the single-person planner offers. */
const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 11; h <= 22; h++) { out.push(`${pad(h)}:00`); out.push(`${pad(h)}:30`); }
  return out;
})();

/** One time on one day, with where each of the two people stands on it. */
interface SlotRow {
  hhmm: string;
  mine: boolean;
  theirs: boolean;
  /**
   * Present when this row exists because THEY offered it. Carries the exact
   * instant they sent, which is what gets submitted if I agree to it — a time
   * rebuilt from this row's day and HH:MM would be an hour out inside a
   * repeated fall-back hour, and their slots can land there because they are
   * authored in their timezone, not mine.
   */
  theirInstant?: string;
}

interface DayGroup {
  date: string;
  rows: SlotRow[];
}

export interface SharedAvailabilityProps {
  /** My own offer, in the picker's wall-clock terms */
  value: DayPlan[];
  onChange: (next: DayPlan[]) => void;
  /** Their offer, as the exact instants the server holds */
  theirSlots: string[];
  /** Have they answered at all? Changes "not this one" to "not yet" */
  theySubmitted: boolean;
  /** Agree to one of THEIRS — passes the exact instant straight back */
  onToggleTheirInstant: (iso: string) => void;
  /** Is this exact instant already in my offer? */
  isMine: (iso: string) => boolean;
  maxDays?: number;
  error?: string;
}

/**
 * One grid, both people.
 *
 * The previous version put my picker in one section and their times in
 * another, which left the actual question — is there an evening we have both
 * said yes to — as something you worked out by looking back and forth. Here
 * every time either of us has offered is one row, with both answers on it,
 * so agreement is visible rather than inferred.
 *
 * Their column is deliberately read-only. Tapping my side of a row they
 * offered is how you agree to it, and that reads as a decision; a grid where
 * both columns are live invites you to think you can edit their answer.
 */
export function SharedAvailability({
  value, onChange, theirSlots, theySubmitted,
  onToggleTheirInstant, isMine, maxDays = 5, error,
}: SharedAvailabilityProps) {
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState(0);

  /** Every time either of us has named, grouped by day and sorted. */
  const groups: DayGroup[] = useMemo(() => {
    const byDay = new Map<string, Map<string, SlotRow>>();

    const touch = (date: string, hhmm: string): SlotRow => {
      if (!byDay.has(date)) byDay.set(date, new Map());
      const day = byDay.get(date)!;
      if (!day.has(hhmm)) day.set(hhmm, { hhmm, mine: false, theirs: false });
      return day.get(hhmm)!;
    };

    for (const d of value) {
      for (const s of d.slots) touch(d.date, s).mine = true;
    }

    for (const iso of theirSlots) {
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) continue;
      const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      const hhmm = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      const row = touch(date, hhmm);
      row.theirs = true;
      row.theirInstant = iso;
      // They offered it and I have already agreed — the instant is the truth
      // here, not the label, so ask by instant rather than by row position.
      if (isMine(iso)) row.mine = true;
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        rows: Array.from(rows.values()).sort((a, b) => a.hhmm.localeCompare(b.hhmm)),
      }));
  }, [value, theirSlots, isMine]);

  const bothCount = groups.reduce(
    (n, g) => n + g.rows.filter((r) => r.mine && r.theirs).length, 0,
  );

  const addDay = (iso: string) => {
    if (!iso) return;
    setDateKey((k) => k + 1);
    if (value.some((d) => d.date === iso)) return;
    if (groups.length >= maxDays) return;
    onChange([...value, { date: iso, slots: [] }].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const addSlot = (date: string, hhmm: string) => {
    setAddingFor(null);
    const existing = value.find((d) => d.date === date);
    if (existing) {
      if (existing.slots.includes(hhmm)) return;
      onChange(value.map((d) =>
        d.date === date ? { ...d, slots: [...d.slots, hhmm].sort() } : d,
      ));
    } else {
      onChange([...value, { date, slots: [hhmm] }].sort((a, b) => a.date.localeCompare(b.date)));
    }
  };

  /** Toggle MY answer on a row. Their rows go back as exact instants. */
  const toggleMine = (date: string, row: SlotRow) => {
    if (row.theirInstant) { onToggleTheirInstant(row.theirInstant); return; }
    const day = value.find((d) => d.date === date);
    if (!day) return;
    onChange(value.map((d) =>
      d.date === date
        ? { ...d, slots: d.slots.filter((s) => s !== row.hhmm) }
        : d,
    ).filter((d) => d.slots.length > 0 || theirSlots.length > 0));
  };

  return (
    <View>
      {/* Legend — which column is whose */}
      <View style={s.legend}>
        <View style={s.legendSide}>
          <View style={[s.dot, s.dotMine]} />
          <Text style={s.legendText}>you</Text>
        </View>
        <View style={s.legendSide}>
          <View style={[s.dot, s.dotTheirs]} />
          <Text style={s.legendText}>them</Text>
        </View>
        {bothCount > 0 && (
          <View style={s.bothPill}>
            <Ionicons name="checkmark-circle" size={12} color={COLORS.LIKE} />
            <Text style={s.bothText}>
              {bothCount} you both said yes to
            </Text>
          </View>
        )}
      </View>

      {groups.map((g) => (
        <View key={g.date} style={s.dayBlock}>
          <Text style={s.dayLabel}>{prettyDay(g.date)}</Text>

          {g.rows.map((row) => {
            const agreed = row.mine && row.theirs;
            return (
              <View key={row.hhmm} style={[s.row, agreed && s.rowAgreed]}>
                <Text style={[s.time, agreed && s.timeAgreed]}>{prettyTime(row.hhmm)}</Text>

                {/* Mine — tappable */}
                <TouchableOpacity
                  onPress={() => toggleMine(g.date, row)}
                  hitSlop={hit}
                  activeOpacity={0.7}
                  style={[s.cell, row.mine ? s.cellYes : s.cellEmpty]}
                >
                  {row.mine
                    ? <Ionicons name="checkmark" size={15} color="#fff" />
                    : <Ionicons name="add" size={14} color={COLORS.TEXT_MUTED} />}
                </TouchableOpacity>

                {/* Theirs — read only */}
                <View style={[s.cell, row.theirs ? s.cellYes : s.cellUnknown]}>
                  {row.theirs
                    ? <Ionicons name="checkmark" size={15} color="#fff" />
                    : <Text style={s.unknownMark}>{theySubmitted ? '–' : '?'}</Text>}
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={s.addSlot}
            onPress={() => setAddingFor(g.date)}
            activeOpacity={0.7}
          >
            <Text style={s.addSlotText}>Add a time</Text>
            <View style={s.plus}><Ionicons name="add" size={15} color={COLORS.BRAND} /></View>
          </TouchableOpacity>
        </View>
      ))}

      {groups.length < maxDays && (
        <View style={{ marginTop: 4 }}>
          <DateField
            key={dateKey}
            label={groups.length === 0 ? 'Pick a day' : 'Add another day'}
            value=""
            onChange={addDay}
            mode="future"
            placeholder={groups.length === 0 ? 'Choose a date' : '+ Add more days'}
          />
        </View>
      )}

      {!!error && <Text style={s.error}>{error}</Text>}

      <Modal
        visible={addingFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAddingFor(null)}
      >
        <Pressable style={s.backdrop} onPress={() => setAddingFor(null)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>{addingFor ? prettyDay(addingFor) : 'Choose a time'}</Text>
            <Text style={s.sheetSub}>What time suits you?</Text>
            <ScrollView style={{ maxHeight: 330 }} showsVerticalScrollIndicator={false}>
              <View style={s.timeGrid}>
                {TIME_SLOTS.map((t) => {
                  const day = addingFor ? groups.find((g) => g.date === addingFor) : undefined;
                  const taken = !!day?.rows.find((r) => r.hhmm === t && r.mine);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.timeChip, taken && s.timeChipTaken]}
                      disabled={taken}
                      onPress={() => addingFor && addSlot(addingFor, t)}
                    >
                      <Text style={[s.timeChipText, taken && s.timeChipTextTaken]}>
                        {prettyTime(t)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={s.sheetClose} onPress={() => setAddingFor(null)}>
              <Text style={s.sheetCloseText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  legendSide: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotMine: { backgroundColor: COLORS.BRAND },
  dotTheirs: { backgroundColor: COLORS.PLUM },
  legendText: { fontSize: 11.5, fontWeight: '700', color: COLORS.TEXT_MUTED },
  bothPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto',
    backgroundColor: COLORS.LIKE_BG, borderRadius: 9,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  bothText: { fontSize: 10.5, fontWeight: '800', color: COLORS.LIKE },

  dayBlock: {
    backgroundColor: COLORS.SURFACE, borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  dayLabel: {
    fontSize: 12, fontWeight: '800', color: COLORS.TEXT,
    marginBottom: 8, letterSpacing: 0.2,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4,
  },
  rowAgreed: { backgroundColor: COLORS.LIKE_BG },
  time: { flex: 1, fontSize: 13.5, fontWeight: '700', color: COLORS.TEXT },
  timeAgreed: { color: COLORS.LIKE },

  cell: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  cellYes: { backgroundColor: COLORS.LIKE },
  cellEmpty: { backgroundColor: COLORS.BG, borderWidth: 1.5, borderColor: COLORS.BORDER },
  cellUnknown: { backgroundColor: COLORS.BG, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT },
  unknownMark: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT_MUTED },

  addSlot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 8, marginTop: 2,
  },
  addSlotText: { fontSize: 12.5, fontWeight: '700', color: COLORS.TEXT_MUTED },
  plus: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },

  error: { fontSize: 12, color: COLORS.ERROR, marginTop: 6 },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(26,15,38,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT },
  sheetSub: { fontSize: 12.5, color: COLORS.TEXT_MUTED, marginTop: 2, marginBottom: 14 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    backgroundColor: COLORS.BG, borderRadius: 11,
    paddingHorizontal: 13, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  timeChipTaken: { backgroundColor: COLORS.LIKE_BG, borderColor: COLORS.LIKE_BG },
  timeChipText: { fontSize: 12.5, fontWeight: '700', color: COLORS.TEXT },
  timeChipTextTaken: { color: COLORS.LIKE },
  sheetClose: {
    marginTop: 16, backgroundColor: COLORS.BRAND, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  sheetCloseText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
