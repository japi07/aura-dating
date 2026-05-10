import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

const EVENT_TYPES = [
  { key: 'Social', emoji: '🥂', label: 'Social' },
  { key: 'Activity', emoji: '🌿', label: 'Activity' },
  { key: 'Workshop', emoji: '🎨', label: 'Workshop' },
  { key: 'Dinner', emoji: '🍽️', label: 'Dinner' },
];

export default function CreateEventScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [maxSpots, setMaxSpots] = useState('');

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!description.trim()) e.description = 'Description is required';
    else if (description.length < 20) e.description = 'At least 20 characters';
    if (!location.trim()) e.location = 'Location is required';
    if (!date.trim()) e.date = 'Date is required';
    if (!time.trim()) e.time = 'Time is required';
    if (!eventType) e.eventType = 'Select an event type';
    if (!maxSpots.trim()) e.maxSpots = 'Spots required';
    else if (isNaN(parseInt(maxSpots)) || parseInt(maxSpots) < 1) e.maxSpots = 'Must be a valid number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Event Created', 'Your event is now live!', [
        { text: 'Done', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="close" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Form Card */}
        <View style={styles.card}>
          <Input label="Event Title" placeholder="e.g., Wine Tasting Night" value={title} onChangeText={setTitle} error={errors.title} icon="bookmark-outline" />
          <Input label="Description" placeholder="Describe the experience (min 20 characters)" value={description} onChangeText={setDescription} multiline numberOfLines={4} error={errors.description} />
          <Input label="Venue / Location" placeholder="e.g., SoHo Wine Bar" value={location} onChangeText={setLocation} error={errors.location} icon="location-outline" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Date" placeholder="April 5, 2026" value={date} onChangeText={setDate} error={errors.date} icon="calendar-outline" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Time" placeholder="7:00 PM" value={time} onChangeText={setTime} error={errors.time} icon="time-outline" />
            </View>
          </View>
        </View>

        {/* Event Type */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Event Type</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[styles.typeCard, eventType === type.key && styles.typeCardOn]}
                onPress={() => setEventType(type.key)}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={[styles.typeLbl, eventType === type.key && styles.typeLblOn]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.eventType && <Text style={styles.err}>{errors.eventType}</Text>}

          <Input label="Max Spots" placeholder="e.g., 12" value={maxSpots} onChangeText={setMaxSpots} keyboardType="number-pad" error={errors.maxSpots} icon="people-outline" />
        </View>

        <Button title="Create Event" onPress={handleCreate} loading={loading} size="lg" style={{ width: '100%', marginTop: 4 }} />
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

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  sectionLbl: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },

  typeGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE, gap: 4,
  },
  typeCardOn: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_MUTED },
  typeEmoji: { fontSize: 20 },
  typeLbl: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  typeLblOn: { color: COLORS.PRIMARY },
  err: { fontSize: 11, color: COLORS.ERROR, marginTop: -8, marginBottom: 12 },
});
