import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import type { RoadmapStage } from '@/lib/date-plan-supabase';

/**
 * The steps between being matched and actually meeting.
 *
 * A blind date spends its first days as a row with no venue and no time. On
 * its own that reads as nothing happening, and the most common thing to do
 * with a dating app that appears to have stalled is delete it. Naming the
 * stages turns the same wait into visible progress, and shows whose turn it
 * is — which matters when the answer is "yours".
 */
export function DateRoadmap({ stages, compact }: {
  stages: RoadmapStage[];
  /** Trims to the current step plus its neighbours, for a list card */
  compact?: boolean;
}) {
  const shown = compact ? trimAround(stages) : stages;

  return (
    <View style={s.wrap}>
      {shown.map((stage, i) => {
        const last = i === shown.length - 1;
        return (
          <View key={stage.key} style={s.row}>
            <View style={s.rail}>
              <View
                style={[
                  s.node,
                  stage.state === 'done' && s.nodeDone,
                  stage.state === 'current' && s.nodeCurrent,
                ]}
              >
                {stage.state === 'done' ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : stage.state === 'current' ? (
                  <View style={s.pip} />
                ) : null}
              </View>
              {!last && (
                <View style={[s.line, stage.state === 'done' && s.lineDone]} />
              )}
            </View>

            <View style={[s.body, last && { paddingBottom: 0 }]}>
              <Text
                style={[
                  s.title,
                  stage.state === 'current' && s.titleCurrent,
                  stage.state === 'todo' && s.titleTodo,
                ]}
              >
                {stage.title}
              </Text>
              <Text style={[s.detail, stage.state === 'todo' && s.detailTodo]}>
                {stage.detail}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * On a list card there is no room for six steps, and the ones far behind or
 * far ahead are not what someone is looking for. Keep the current step with
 * one either side.
 */
function trimAround(stages: RoadmapStage[]): RoadmapStage[] {
  const i = stages.findIndex((x) => x.state === 'current');
  if (i === -1) return stages.slice(-2);
  const from = Math.max(0, i - 1);
  return stages.slice(from, Math.min(stages.length, from + 3));
}

const s = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 22 },
  node: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.BORDER, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
  },
  nodeDone: { backgroundColor: COLORS.LIKE, borderColor: COLORS.LIKE },
  nodeCurrent: { borderColor: COLORS.BRAND, backgroundColor: COLORS.BRAND_MUTED },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.BRAND },
  line: { flex: 1, width: 2, backgroundColor: COLORS.BORDER, marginVertical: 2 },
  lineDone: { backgroundColor: COLORS.LIKE },

  body: { flex: 1, paddingBottom: 16 },
  title: { fontSize: 13.5, fontWeight: '800', color: COLORS.TEXT },
  titleCurrent: { color: COLORS.BRAND },
  titleTodo: { color: COLORS.TEXT_MUTED },
  detail: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2, lineHeight: 17 },
  detailTodo: { color: COLORS.TEXT_MUTED },
});
