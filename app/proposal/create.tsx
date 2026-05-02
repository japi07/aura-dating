import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

const DATE_TYPES = [
  { key: 'Dinner', emoji: '🍽️', label: 'Dress-up Dinner' },
  { key: 'Coffee', emoji: '☕', label: 'Coffee Date' },
  { key: 'Nature', emoji: '🌿', label: 'Nature Walk' },
  { key: 'Activity', emoji: '🎨', label: 'Activity' },
];

const PAYMENT_OPTIONS = [
  { key: 'I\'ll Pay', icon: 'gift-outline', label: 'I\'ll treat you' },
  { key: 'Split Equally', icon: 'git-branch-outline', label: 'We split equally' },
  { key: 'They\'ll Pay', icon: 'wallet-outline', label: 'Your preference' },
];

export default function CreateProposalScreen() {
  const router = useRouter();
  const { userId, userName } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [message, setMessage] = useState('');
  const [dateType, setDateType] = useState('');
  const [venue, setVenue] = useState('');
  const [alternativePlan, setAlternativePlan] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [paymentArrangement, setPaymentArrangement] = useState('');

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!message.trim()) e.message = 'Please write a personal message';
    else if (message.length < 10) e.message = 'At least 10 characters';
    if (!dateType) e.dateType = 'Select a date type';
    if (!preferredDate.trim()) e.preferredDate = 'Date is required';
    if (!preferredTime.trim()) e.preferredTime = 'Time is required';
    if (!paymentArrangement) e.paymentArrangement = 'Select a payment option';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSend = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert(
        'Proposal Sent',
        `Your thoughtful proposal has been sent to ${userName}. They'll be in touch if they accept.`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Propose a Date</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recipient Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="heart" size={16} color={COLORS.PRIMARY} />
          </View>
          <View>
            <Text style={styles.bannerLbl}>Proposing to</Text>
            <Text style={styles.bannerName}>{userName}</Text>
          </View>
        </View>

        {/* Message */}
        <View style={styles.card}>
          <Input
            label="Your Personal Message"
            placeholder="Tell her why you'd like to take her out and what inspired this plan..."
            value={message} onChangeText={setMessage} multiline numberOfLines={4} error={errors.message}
          />
        </View>

        {/* Date Type */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Type of Date</Text>
          <View style={styles.typeGrid}>
            {DATE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[styles.typeCard, dateType === type.key && styles.typeCardOn]}
                onPress={() => setDateType(type.key)}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={[styles.typeLbl, dateType === type.key && styles.typeLblOn]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.dateType && <Text style={styles.err}>{errors.dateType}</Text>}

          <Input label="Venue / Restaurant" placeholder="e.g., Balthazar, SoHo" value={venue} onChangeText={setVenue} icon="restaurant-outline" />
          <Input label="Alternative Plan (Optional)" placeholder="Backup idea if she has another preference..." value={alternativePlan} onChangeText={setAlternativePlan} icon="repeat-outline" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Date" placeholder="April 12, 2026" value={preferredDate} onChangeText={setPreferredDate} error={errors.preferredDate} icon="calendar-outline" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Time" placeholder="7:30 PM" value={preferredTime} onChangeText={setPreferredTime} error={errors.preferredTime} icon="time-outline" />
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Payment</Text>
          <View style={styles.payList}>
            {PAYMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.payRow, paymentArrangement === opt.key && styles.payRowOn]}
                onPress={() => setPaymentArrangement(opt.key)}
              >
                <View style={[styles.payIcon, paymentArrangement === opt.key && styles.payIconOn]}>
                  <Ionicons name={opt.icon as any} size={15} color={paymentArrangement === opt.key ? '#fff' : COLORS.PRIMARY} />
                </View>
                <Text style={[styles.payLbl, paymentArrangement === opt.key && styles.payLblOn]}>{opt.label}</Text>
                {paymentArrangement === opt.key && (
                  <Ionicons name="checkmark-circle" size={17} color={COLORS.PRIMARY} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          {errors.paymentArrangement && <Text style={styles.err}>{errors.paymentArrangement}</Text>}
        </View>

        <Button title="Send Proposal" onPress={handleSend} loading={loading} size="lg" style={{ width: '100%', marginTop: 4 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.BG,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.3 },
  content: { paddingHorizontal: 14, paddingVertical: 16, paddingBottom: 40 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.PRIMARY_MUTED, borderRadius: 14, padding: 14, marginBottom: 12,
  },
  bannerIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  bannerLbl: { fontSize: 10, color: COLORS.PRIMARY_LIGHT, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerName: { fontSize: 16, fontWeight: '800', color: COLORS.PRIMARY, letterSpacing: -0.3 },

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  sectionLbl: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeCard: {
    flex: 1, minWidth: '44%', alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE, gap: 4,
  },
  typeCardOn: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_MUTED },
  typeEmoji: { fontSize: 22 },
  typeLbl: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_SECONDARY, textAlign: 'center' },
  typeLblOn: { color: COLORS.PRIMARY },
  err: { fontSize: 11, color: COLORS.ERROR, marginTop: -6, marginBottom: 10 },

  payList: { gap: 8, marginBottom: 8 },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE,
  },
  payRowOn: { borderColor: COLORS.PRIMARY_LIGHT, backgroundColor: COLORS.PRIMARY_MUTED },
  payIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.PRIMARY_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  payIconOn: { backgroundColor: COLORS.PRIMARY },
  payLbl: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },
  payLblOn: { color: COLORS.PRIMARY, fontWeight: '700' },
});
