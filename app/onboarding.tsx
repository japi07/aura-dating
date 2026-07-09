import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth';
import { profileApi } from '@/lib/api';
import { updateMyProfile } from '@/lib/profile-supabase';
import { getSessionUserId } from '@/lib/proposals-supabase';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { InterestTag } from '@/components/InterestTag';
import { Avatar } from '@/components/Avatar';
import { DateField } from '@/components/DateField';
import { CityField } from '@/components/CityField';
import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';

const INTERESTS = [
  'Travel', 'Music', 'Art', 'Cooking', 'Sports', 'Reading',
  'Fitness', 'Yoga', 'Meditation', 'Dancing', 'Photography', 'Volunteering',
];

const DATE_TYPES = [
  { key: 'Dinner', emoji: '🍽️', label: 'Dress-up Dinners' },
  { key: 'Coffee', emoji: '☕', label: 'Coffee & Walks' },
  { key: 'Nature', emoji: '🌿', label: 'Outdoors' },
  { key: 'Activity', emoji: '🎨', label: 'Activities' },
  { key: 'Cultural', emoji: '🎭', label: 'Cultural Outings' },
];

const QUALITIES = [
  'Emotional intelligence', 'Ambition', 'Humour', 'Kindness',
  'Honesty', 'Creativity', 'Stability', 'Adventurousness',
];

const DEALBREAKERS = [
  'Smoking', 'No job', 'No ambition', 'Children already',
  'Long distance', 'Different religion', 'No commitment',
];

const GENDERS = ['Male', 'Female', 'Non-binary'];
const GENDER_INTERESTS = ['Male', 'Female', 'Everyone'];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);

  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [genderInterest, setGenderInterest] = useState('');
  const [city, setCity] = useState('London');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedDateTypes, setSelectedDateTypes] = useState<string[]>([]);
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);
  const [selectedDealbreakers, setSelectedDealbreakers] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const toggle = <T extends string>(arr: T[], setArr: React.Dispatch<React.SetStateAction<T[]>>, val: T) => {
    setArr(arr.includes(val) ? arr.filter((i) => i !== val) : [...arr, val]);
  };

  const validateAndProceed = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!birthday.trim()) e.birthday = 'Birthday is required';
      if (!gender) e.gender = 'Select your gender';
      if (!genderInterest) e.genderInterest = 'Select your preference';
      if (!city.trim()) e.city = 'City is required';
    } else if (step === 2) {
      if (!bio.trim()) e.bio = 'Tell us about yourself';
      else if (bio.length < 20) e.bio = 'At least 20 characters';
      if (selectedInterests.length === 0) e.interests = 'Select at least one';
    } else if (step === 3) {
      if (selectedDateTypes.length === 0) e.dateTypes = 'Select at least one';
      if (selectedQualities.length < 3) e.qualities = 'Pick at least 3 qualities';
    }
    setErrors(e);
    if (Object.keys(e).length === 0) {
      if (step < 3) setStep(step + 1);
      else handleComplete();
    }
  };

  const computeAge = (str: string): number | undefined => {
    if (!str) return undefined;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str.trim());
    const d = m ? new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`) : new Date(str);
    if (isNaN(d.getTime())) return undefined;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age;
  };

  const handleComplete = async () => {
    setLoading(true);
    const age = computeAge(birthday);

    // Always update the local store first — that's the source of truth for the UI.
    // Then attempt to sync with the backend; if it fails we still proceed.
    if (user) {
      setUser({
        ...user,
        profileComplete: true,
        age, birthday, city, bio,
        gender: gender.toLowerCase(),
        genderInterest: genderInterest.toLowerCase(),
        interests: selectedInterests,
        photoUrl: photoUri || user.photoUrl,
      });
    }

    try {
      const signedIn = await getSessionUserId();
      if (signedIn) {
        // Persist to Supabase — crucially sets profile_complete = true so the
        // user isn't sent back through onboarding on their next login.
        await updateMyProfile({
          birthday, age, city, bio,
          gender: gender.toLowerCase(),
          genderInterest: genderInterest.toLowerCase(),
          interests: selectedInterests,
          photoUrl: photoUri || undefined,
          profileComplete: true,
        });
      } else {
        // Offline / legacy fallback
        await profileApi.updateProfile({
          birthday, gender, genderInterest, city, bio, interests: selectedInterests,
        });
      }
    } catch {
      // Backend not reachable — local state already saved; will re-sync later
    } finally {
      setLoading(false);
      router.replace('/');
    }
  };

  const titles = ['The Basics', 'Your Personality', 'Your Preferences'];
  const subs = ['Quick setup — just name, city, and a photo', 'Help us understand your passions and voice', 'Tell us exactly the experience you want'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.bar, s <= step && styles.barActive, s < step && styles.barDone]} />
        ))}
      </View>

      <Text style={styles.stepBadge}>Step {step} of 3</Text>
      <Text style={styles.title}>{titles[step - 1]}</Text>
      <Text style={styles.subtitle}>{subs[step - 1]}</Text>

      {/* STEP 1 */}
      {step === 1 && (
        <View style={styles.card}>
          <TouchableOpacity style={styles.photoUpload} onPress={pickImage}>
            {photoUri ? (
              <Avatar photoUrl={photoUri} size="xl" ring />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={28} color={COLORS.PRIMARY_LIGHT} />
                <Text style={styles.photoHint}>Add a photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <DateField label="Birthday" value={birthday} onChange={setBirthday} mode="past" placeholder="Select your birthday" error={errors.birthday} />

          <Text style={styles.fieldLbl}>Gender</Text>
          <View style={styles.chips}>
            {GENDERS.map((g) => (
              <TouchableOpacity key={g} style={[styles.chip, gender === g && styles.chipOn]} onPress={() => setGender(g)}>
                <Text style={[styles.chipText, gender === g && styles.chipTextOn]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.gender && <Text style={styles.err}>{errors.gender}</Text>}

          <Text style={styles.fieldLbl}>Interested in</Text>
          <View style={styles.chips}>
            {GENDER_INTERESTS.map((gi) => (
              <TouchableOpacity key={gi} style={[styles.chip, genderInterest === gi && styles.chipOn]} onPress={() => setGenderInterest(gi)}>
                <Text style={[styles.chipText, genderInterest === gi && styles.chipTextOn]}>{gi}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.genderInterest && <Text style={styles.err}>{errors.genderInterest}</Text>}

          <CityField label="City" />
        </View>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <View style={styles.card}>
          <Input label="About You" placeholder="What makes you, you? Be honest and specific..." value={bio} onChangeText={setBio} multiline numberOfLines={5} error={errors.bio} />

          <Text style={styles.fieldLbl}>Your Interests</Text>
          {errors.interests && <Text style={styles.err}>{errors.interests}</Text>}
          <View style={styles.tagCloud}>
            {INTERESTS.map((interest) => (
              <InterestTag key={interest} label={interest} selected={selectedInterests.includes(interest)} onPress={() => toggle(selectedInterests, setSelectedInterests, interest)} />
            ))}
          </View>
        </View>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.fieldLbl}>Types of dates I enjoy</Text>
          {errors.dateTypes && <Text style={styles.err}>{errors.dateTypes}</Text>}
          <View style={styles.typeGrid}>
            {DATE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[styles.typeCard, selectedDateTypes.includes(type.key) && styles.typeCardOn]}
                onPress={() => toggle(selectedDateTypes, setSelectedDateTypes, type.key)}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={[styles.typeLbl, selectedDateTypes.includes(type.key) && styles.typeLblOn]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLbl}>Top qualities I look for (pick 3+)</Text>
          {errors.qualities && <Text style={styles.err}>{errors.qualities}</Text>}
          <View style={styles.tagCloud}>
            {QUALITIES.map((q) => (
              <InterestTag key={q} label={q} selected={selectedQualities.includes(q)} onPress={() => toggle(selectedQualities, setSelectedQualities, q)} />
            ))}
          </View>

          <Text style={styles.fieldLbl}>My dealbreakers (optional)</Text>
          <View style={styles.tagCloud}>
            {DEALBREAKERS.map((d) => (
              <InterestTag key={d} label={d} selected={selectedDealbreakers.includes(d)} onPress={() => toggle(selectedDealbreakers, setSelectedDealbreakers, d)} />
            ))}
          </View>
        </View>
      )}

      {/* Nav Buttons */}
      <View style={styles.navRow}>
        {step > 1 && (
          <Button title="Back" onPress={() => setStep(step - 1)} variant="secondary" style={{ flex: 1 }} />
        )}
        <Button
          title={step === 3 ? 'Complete Profile' : 'Continue'}
          onPress={validateAndProceed}
          loading={loading && step === 3}
          size="lg"
          style={{ flex: step > 1 ? 2 : 1 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  content: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 40 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  bar: { flex: 1, height: 3, borderRadius: 1.5, backgroundColor: COLORS.BORDER_LIGHT },
  barActive: { backgroundColor: COLORS.PRIMARY_LIGHT },
  barDone: { backgroundColor: COLORS.PRIMARY },
  stepBadge: { fontSize: 10, fontWeight: '800', color: COLORS.PRIMARY_LIGHT, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.TEXT_MUTED, lineHeight: 20, marginBottom: 20 },

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  fieldLbl: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE,
  },
  chipOn: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  err: { fontSize: 11, color: COLORS.ERROR, marginBottom: 10, marginTop: -4 },

  photoUpload: { alignSelf: 'center', marginBottom: 20 },
  photoPlaceholder: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.PRIMARY_MUTED,
    borderWidth: 2, borderColor: COLORS.PRIMARY_LIGHT, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  photoHint: { fontSize: 11, color: COLORS.PRIMARY_LIGHT, fontWeight: '700' },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeCard: {
    minWidth: '44%', flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE, gap: 4,
  },
  typeCardOn: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_MUTED },
  typeEmoji: { fontSize: 22 },
  typeLbl: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_SECONDARY, textAlign: 'center' },
  typeLblOn: { color: COLORS.PRIMARY },

  navRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
