import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore, type User } from '@/store/auth';
import { authApi } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { InterestTag } from '@/components/InterestTag';
import { Avatar } from '@/components/Avatar';
import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';

const INTERESTS = [
  'Travel', 'Music', 'Art', 'Cooking', 'Sports', 'Reading',
  'Fitness', 'Yoga', 'Meditation', 'Dancing', 'Photography', 'Volunteering',
];

const GENDERS = ['Male', 'Female', 'Non-binary'];
const GENDER_INTERESTS = ['Male', 'Female', 'Everyone'];

export default function RegisterScreen() {
  const router = useRouter();
  const { setToken, setUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [genderInterest, setGenderInterest] = useState('');
  const [city, setCity] = useState('');

  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Please enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!birthday.trim()) e.birthday = 'Birthday is required';
    if (!gender) e.gender = 'Please select your gender';
    if (!genderInterest) e.genderInterest = 'Please select gender preference';
    if (!city.trim()) e.city = 'City is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e: Record<string, string> = {};
    if (!bio.trim()) e.bio = 'Bio is required';
    else if (bio.length < 20) e.bio = 'Bio must be at least 20 characters';
    if (selectedInterests.length === 0) e.interests = 'Select at least one interest';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) { setErrors({}); setStep(2); }
    else if (step === 2 && validateStep2()) { setErrors({}); setStep(3); }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const handleRegister = async () => {
    if (!validateStep3()) return;
    setLoading(true);
    try {
      const response = await authApi.register({
        name, email, password, birthday, gender, genderInterest, city, bio,
        interests: selectedInterests,
      });
      await setToken(response.token);
      const user: User = {
        id: response.user.id, email: response.user.email, name: response.user.name,
        profileComplete: false, age: response.user.age, city: response.user.city,
        bio: response.user.bio, interests: response.user.interests, gender: response.user.gender,
        genderInterest: response.user.genderInterest, photoUrl: response.user.photoUrl,
      };
      setUser(user);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const titles = ['Your Details', 'About You', 'Your Story'];
  const subs = ['Let\u2019s get started with the basics', 'Help us understand who you are', 'Show the world what makes you unique'];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity
          onPress={() => step > 1 ? (setErrors({}), setStep(step - 1)) : router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>

        {/* Progress */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={[styles.bar, s <= step && styles.barActive, s < step && styles.barDone]} />
          ))}
        </View>

        <Text style={styles.stepBadge}>Step {step} of 3</Text>
        <Text style={styles.title}>{titles[step - 1]}</Text>
        <Text style={styles.subtitle}>{subs[step - 1]}</Text>

        {/* Step 1 */}
        {step === 1 && (
          <View style={styles.formCard}>
            <Input label="Full Name" placeholder="Your name" value={name} onChangeText={setName} error={errors.name} icon="person-outline" />
            <Input label="Email" placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} icon="mail-outline" />
            <Input label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} icon="lock-closed-outline" />
            <Input label="Confirm Password" placeholder="Confirm your password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={errors.confirmPassword} icon="lock-closed-outline" />
          </View>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <View style={styles.formCard}>
            <Input label="Birthday" placeholder="MM/DD/YYYY" value={birthday} onChangeText={setBirthday} error={errors.birthday} icon="calendar-outline" />

            <Text style={styles.fieldLbl}>Gender</Text>
            <View style={styles.chips}>
              {GENDERS.map((g) => (
                <TouchableOpacity key={g} style={[styles.chip, gender === g && styles.chipOn]} onPress={() => setGender(g)}>
                  <Text style={[styles.chipText, gender === g && styles.chipTextOn]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.gender && <Text style={styles.err}>{errors.gender}</Text>}

            <Text style={styles.fieldLbl}>Interested In</Text>
            <View style={styles.chips}>
              {GENDER_INTERESTS.map((gi) => (
                <TouchableOpacity key={gi} style={[styles.chip, genderInterest === gi && styles.chipOn]} onPress={() => setGenderInterest(gi)}>
                  <Text style={[styles.chipText, genderInterest === gi && styles.chipTextOn]}>{gi}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.genderInterest && <Text style={styles.err}>{errors.genderInterest}</Text>}

            <Input label="City" placeholder="Where are you based?" value={city} onChangeText={setCity} error={errors.city} icon="location-outline" />
          </View>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <View style={styles.formCard}>
            <TouchableOpacity style={styles.photoUpload} onPress={pickImage}>
              {photoUri ? (
                <Avatar photoUrl={photoUri} size="xl" ring />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={30} color={COLORS.PRIMARY_LIGHT} />
                  <Text style={styles.photoHint}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Input label="About You" placeholder="What makes you, you? (min 20 characters)" value={bio} onChangeText={setBio} multiline numberOfLines={4} error={errors.bio} />

            <Text style={styles.fieldLbl}>Your Interests</Text>
            {errors.interests && <Text style={styles.err}>{errors.interests}</Text>}
            <View style={styles.tagCloud}>
              {INTERESTS.map((interest) => (
                <InterestTag
                  key={interest}
                  label={interest}
                  selected={selectedInterests.includes(interest)}
                  onPress={() => {
                    if (selectedInterests.includes(interest)) setSelectedInterests(selectedInterests.filter((i) => i !== interest));
                    else setSelectedInterests([...selectedInterests, interest]);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* CTA */}
        <View style={styles.cta}>
          {step < 3 ? (
            <Button title="Continue" onPress={handleNextStep} size="lg" style={{ width: '100%' }} />
          ) : (
            <Button title="Create My Profile" onPress={handleRegister} loading={loading} size="lg" style={{ width: '100%' }} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 36 },
  backBtn: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  bar: { flex: 1, height: 3, borderRadius: 1.5, backgroundColor: COLORS.BORDER_LIGHT },
  barActive: { backgroundColor: COLORS.PRIMARY_LIGHT },
  barDone: { backgroundColor: COLORS.PRIMARY },
  stepBadge: { fontSize: 10, fontWeight: '800', color: COLORS.PRIMARY_LIGHT, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.TEXT_MUTED, lineHeight: 20, marginBottom: 20 },

  formCard: {
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
  err: { fontSize: 11, color: COLORS.ERROR, marginTop: -8, marginBottom: 10 },

  photoUpload: { alignSelf: 'center', marginBottom: 20 },
  photoPlaceholder: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.PRIMARY_MUTED,
    borderWidth: 2, borderColor: COLORS.PRIMARY_LIGHT, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  photoHint: { fontSize: 11, color: COLORS.PRIMARY_LIGHT, fontWeight: '700' },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap' },

  cta: { marginTop: 'auto', paddingBottom: 16 },
});
