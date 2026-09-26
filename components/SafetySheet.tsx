import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
  Linking, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import {
  REPORT_REASONS, SUPPORT_EMAIL, reportMember, blockMember, targetKey, type SafetyTarget,
} from '@/lib/safety-supabase';

export type SafetyOutcome = 'reported' | 'blocked';

type Stage = 'menu' | 'report' | 'done';

/**
 * Report or block whoever is on screen: a profile, a proposal, a date, or the
 * voice on a call. The same sheet everywhere, so a member learns it once.
 *
 * Both actions block. A report without a block would leave the person you
 * just reported sitting in your list, and Apple's guideline 1.2 asks that
 * objectionable content can be removed from the feed immediately.
 *
 * When this sheet is opened from inside another Modal, render it inside that
 * Modal's tree: iOS will not present a sibling modal over one already showing.
 */
// The slide-down dismiss takes about 300ms. If iOS never reports it (it
// should), the outcome is delivered after this anyway.
const DISMISS_FALLBACK_MS = 800;

export function SafetySheet({ target, onClose, onDone }: {
  target: SafetyTarget | null;
  onClose: () => void;
  /** Called after the sheet closes, so the screen can drop what was reported. */
  onDone?: (outcome: SafetyOutcome) => void;
}) {
  const [stage, setStage] = useState<Stage>('menu');
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SafetyOutcome | null>(null);

  /**
   * The sheet stays mounted while it animates away, showing the last person
   * it was opened for. It used to unmount the instant it closed, in the same
   * commit as the caller's onDone -- and when the caller is itself a modal
   * (the full-profile sheet) that closes on onDone, iOS was asked to dismiss
   * both view controllers at once. The outer one never went away: a frozen
   * full-screen profile, and a force-quit. So onDone now waits until this
   * sheet has finished dismissing.
   */
  const [shown, setShown] = useState<SafetyTarget | null>(target);
  /**
   * The caller's onDone, bound as it was when the sheet closed. The render
   * that dismisses the sheet has already cleared the caller's state (their
   * onClose ran first), so calling the onDone of that later render would
   * find nothing to remove -- the reported person stayed on screen.
   */
  const pendingDone = useRef<(() => void) | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (target) setShown(target); }, [targetKey(target)]);
  useEffect(() => () => { if (fallback.current) clearTimeout(fallback.current); }, []);

  const flushDone = () => {
    if (fallback.current) { clearTimeout(fallback.current); fallback.current = null; }
    const run = pendingDone.current;
    pendingDone.current = null;
    run?.();
  };

  // Reset when the sheet opens for someone, not on every render. Callers
  // build the target inline, so its identity changes whenever their screen
  // re-renders -- once a second during a call, with the countdown -- and
  // keying on the object reset the form under the member mid-report.
  const key = targetKey(target);
  useEffect(() => {
    if (key) {
      setStage('menu');
      setReason(null);
      setDetails('');
      setOutcome(null);
      setBusy(false);
    }
  }, [key]);

  const t = target ?? shown;
  if (!t) return null;
  const name = t.name || 'this person';

  const close = () => {
    if (busy) return;
    const done = outcome;
    onClose();
    if (!done) return;
    if (Platform.OS === 'ios') {
      const cb = onDone;
      pendingDone.current = () => cb?.(done);
      fallback.current = setTimeout(flushDone, DISMISS_FALLBACK_MS);
    } else {
      onDone?.(done);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${name}?`,
      "You'll disappear for each other everywhere on Aura, straight away, and anything live between you ends. They aren't told.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await blockMember(t);
              setOutcome('blocked');
              setStage('done');
            } catch (e: any) {
              Alert.alert('Could not block', e?.message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const submitReport = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await reportMember(t, reason, details);
      setOutcome('reported');
      setStage('done');
    } catch (e: any) {
      Alert.alert('Could not send your report', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const emailUs = () => {
    const subject = encodeURIComponent('Safety report');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() =>
      Alert.alert('No mail app', `You can email us at ${SUPPORT_EMAIL}`));
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close} onDismiss={flushDone}>
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />

        <View style={s.sheet}>
          <View style={s.grabber} />

          {stage === 'menu' && (
            <>
              <Text style={s.title}>{name}</Text>
              <Text style={s.sub}>
                Reports go to a real person and are reviewed within 24 hours.
              </Text>

              <View style={s.options}>
                <TouchableOpacity style={s.option} onPress={() => setStage('report')} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: COLORS.ERROR_LIGHT }]}>
                    <Ionicons name="flag" size={18} color={COLORS.ERROR} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionLabel, { color: COLORS.ERROR }]}>Report {name}</Text>
                    <Text style={s.optionDesc}>Tell us what happened. We'll block them for you too.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
                </TouchableOpacity>

                <TouchableOpacity style={s.option} onPress={confirmBlock} disabled={busy} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: COLORS.PLUM_MUTED }]}>
                    <Ionicons name="ban" size={18} color={COLORS.PLUM} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionLabel}>Block {name}</Text>
                    <Text style={s.optionDesc}>You'll disappear for each other, straight away.</Text>
                  </View>
                  {busy ? <ActivityIndicator color={COLORS.BRAND} /> : null}
                </TouchableOpacity>
              </View>

              <Contact onEmail={emailUs} />

              <TouchableOpacity style={s.cancel} onPress={close}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {stage === 'report' && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.title}>What happened?</Text>
              <Text style={s.sub}>Only our safety team sees this. {name} is never told who reported them.</Text>

              <View style={s.reasons}>
                {REPORT_REASONS.map((r) => {
                  const on = reason === r;
                  return (
                    <TouchableOpacity key={r} style={[s.reason, on && s.reasonOn]} onPress={() => setReason(r)} activeOpacity={0.8}>
                      <Ionicons
                        name={on ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={on ? COLORS.BRAND : COLORS.TEXT_MUTED}
                      />
                      <Text style={[s.reasonText, on && { color: COLORS.TEXT }]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Anything else we should know? (optional)</Text>
              <TextInput
                style={s.input}
                value={details}
                onChangeText={setDetails}
                placeholder="What was said or done, and when"
                placeholderTextColor={COLORS.TEXT_MUTED}
                multiline
                maxLength={1000}
              />

              <TouchableOpacity
                style={[s.primary, (!reason || busy) && { opacity: 0.5 }]}
                onPress={submitReport}
                disabled={!reason || busy}
                activeOpacity={0.88}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryText}>Report and block</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.cancel} onPress={() => setStage('menu')} disabled={busy}>
                <Text style={s.cancelText}>Back</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {stage === 'done' && (
            <>
              <View style={s.doneIcon}>
                <Ionicons name="checkmark" size={30} color={COLORS.SUCCESS} />
              </View>
              <Text style={[s.title, { textAlign: 'center' }]}>
                {outcome === 'reported' ? 'Thanks for telling us' : `${name} is blocked`}
              </Text>
              <Text style={[s.sub, { textAlign: 'center' }]}>
                {outcome === 'reported'
                  ? `${name} is blocked, and our team will review your report within 24 hours. Anyone who breaks our rules is removed from Aura.`
                  : "You won't see each other anywhere on Aura again. You can undo this in Safety."}
              </Text>
              <Contact onEmail={emailUs} />
              <TouchableOpacity style={s.primary} onPress={close} activeOpacity={0.88}>
                <Text style={s.primaryText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * The visible way in. An unlabelled ⋯ reads as decoration; App Review looks
 * for the words, so every place a member sees someone else says them.
 */
export function ReportBlockLink({ name, onPress, tone = 'light' }: {
  name: string;
  onPress: () => void;
  tone?: 'light' | 'dark';
}) {
  const color = tone === 'dark' ? 'rgba(255,255,255,0.85)' : COLORS.TEXT_SECONDARY;
  return (
    <TouchableOpacity
      style={s.reportLink}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Report or block ${name}`}
    >
      <Ionicons name="flag-outline" size={15} color={color} />
      <Text style={[s.reportLinkText, { color }]}>Report or block {name}</Text>
    </TouchableOpacity>
  );
}

function Contact({ onEmail }: { onEmail: () => void }) {
  return (
    <View style={s.contact}>
      <Ionicons name="mail-outline" size={15} color={COLORS.TEXT_SECONDARY} />
      <Text style={s.contactText}>
        Something urgent? Email{' '}
        <Text style={s.contactLink} onPress={onEmail}>{SUPPORT_EMAIL}</Text>
        . If you're in danger, call 999.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(31,20,40,0.45)' },
  sheet: {
    backgroundColor: COLORS.SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34, maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 5, borderRadius: 3,
    backgroundColor: COLORS.BORDER, marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.3 },
  sub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 20, marginTop: 6 },

  options: { marginTop: 18, gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.BG,
  },
  optionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  optionDesc: { fontSize: 12.5, color: COLORS.TEXT_SECONDARY, marginTop: 2, lineHeight: 17 },

  reasons: { marginTop: 16, gap: 8 },
  reason: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.BORDER_LIGHT, minHeight: 44,
  },
  reasonOn: { borderColor: COLORS.BRAND, backgroundColor: COLORS.BRAND_MUTED },
  reasonText: { fontSize: 14.5, color: COLORS.TEXT_SECONDARY, fontWeight: '600' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY, marginTop: 18, marginBottom: 8 },
  input: {
    minHeight: 84, borderRadius: 14, borderWidth: 1, borderColor: COLORS.BORDER, padding: 12,
    fontSize: 14.5, color: COLORS.TEXT, textAlignVertical: 'top', backgroundColor: COLORS.BG,
  },

  primary: {
    marginTop: 18, backgroundColor: COLORS.BRAND, borderRadius: 26, minHeight: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  doneIcon: {
    alignSelf: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.SUCCESS_LIGHT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },

  contact: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 18,
    padding: 12, borderRadius: 12, backgroundColor: COLORS.BG,
  },
  contactText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: COLORS.TEXT_SECONDARY },
  contactLink: { color: COLORS.BRAND, fontWeight: '700' },
  reportLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 12,
  },
  reportLinkText: { fontSize: 13.5, fontWeight: '700' },
});
