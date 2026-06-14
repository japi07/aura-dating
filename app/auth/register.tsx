import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAuthStore, type User } from '@/store/auth';
import { useUsersStore } from '@/store/users';
import { authApi } from '@/lib/api';
import { signUpWithEmail, signInWithApple } from '@/lib/auth-supabase';
import { supabaseEnabled } from '@/lib/supabase';
import { AppleSignInButton } from '@/components/AppleSignInButton';
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
  const upsertUser = useUsersStore((s) => s.upsertUser);
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
    if (!birthday.trim()) {
      e.birthday = 'Birthday is required';
    } else {
      // Real 18+ enforcement — Apple requires this for dating apps
      const age = computeAgeForValidation(birthday);
      if (age === null) {
        e.birthday = 'Please enter a valid date (MM/DD/YYYY)';
      } else if (age < 18) {
        e.birthday = 'You must be 18 or older to use Aura';
      } else if (age > 120) {
        e.birthday = 'Please enter a valid birthday';
      }
    }
    if (!gender) e.gender = 'Please select your gender';
    if (!genderInterest) e.genderInterest = 'Please select gender preference';
    if (!city.trim()) e.city = 'City is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** Returns age in years, or null if the input is not parseable */
  const computeAgeForValidation = (str: string): number | null => {
    const trimmed = str.trim();
    // Accept both MM/DD/YYYY (US) and DD/MM/YYYY — try MM/DD/YYYY first
    let d: Date | null = null;
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (slash) {
      const a = parseInt(slash[1], 10);
      const b = parseInt(slash[2], 10);
      const year = parseInt(slash[3], 10);
      // If first part > 12 it must be DD/MM/YYYY; otherwise treat as MM/DD/YYYY
      if (a > 12) d = new Date(year, b - 1, a);
      else d = new Date(year, a - 1, b);
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (!d || isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
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
    if (step === 1 && validateStep1()) {
      Haptics.selectionAsync().catch(() => {});
      setErrors({}); setStep(2);
    } else if (step === 2 && validateStep2()) {
      Haptics.selectionAsync().catch(() => {});
      setErrors({}); setStep(3);
    } else {
      // Validation failed — short error buzz
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  /**
   * Compute age from a yyyy-mm-dd, dd/mm/yyyy or any Date-parseable birthday string.
   */
  const computeAge = (birthdayStr: string): number | undefined => {
    if (!birthdayStr) return undefined;
    // Accept dd/mm/yyyy as well as ISO
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(birthdayStr.trim());
    const d = ddmmyyyy
      ? new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`)
      : new Date(birthdayStr);
    if (isNaN(d.getTime())) return undefined;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  };

  /**
   * Register the user. Tries the backend first; if it's unreachable
   * (no server / offline / wrong env), falls back to creating a local
   * account so you can keep exploring the app without a backend.
   */
  const handleRegister = async () => {
    if (!validateStep3()) return;
    setLoading(true);

    const age = computeAge(birthday);
    const localUser: User = {
      id: `local_${Date.now()}`,
      email,
      name,
      profileComplete: true,
      age,
      birthday,
      city,
      bio,
      interests: selectedInterests,
      gender: gender.toLowerCase(),
      genderInterest: genderInterest.toLowerCase(),
      photoUrl: photoUri || `https://i.pravatar.cc/400?u=${encodeURIComponent(email)}`,
    };

    // Prefer Supabase when configured
    if (supabaseEnabled) {
      try {
        const { user, token } = await signUpWithEmail({
          email, password, name, birthday, city, gender, genderInterest, bio,
          interests: selectedInterests, photoUrl: photoUri || undefined,
        });
        await setToken(token);
        setUser(user);
        await upsertUser(user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/');
        return;
      } catch (e: any) {
        // If Supabase rejects (e.g. weak password, duplicate email), surface it
        Alert.alert('Registration failed', e?.message || 'Please check your details and try again.');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await authApi.register({
        name, email, password, birthday, gender, genderInterest, city, bio,
        interests: selectedInterests,
      });
      // Backend reachable → use real token + user
      await setToken(response.token);
      const finalUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        profileComplete: true,
        age: response.user.age ?? age,
        birthday,
        city: response.user.city ?? city,
        bio: response.user.bio ?? bio,
        interests: response.user.interests ?? selectedInterests,
        gender: response.user.gender ?? gender.toLowerCase(),
        genderInterest: response.user.genderInterest ?? genderInterest.toLowerCase(),
        photoUrl: response.user.photoUrl ?? localUser.photoUrl,
      };
      setUser(finalUser);
      await upsertUser(finalUser);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
      return;
    } catch (error: any) {
      // Distinguish between "server not running" (network error) and
      // "server said no" (validation/conflict). Only fall back for the former.
      const status = error?.response?.status;
      const isNetworkError = !error?.response;
      const isServerUnavailable = status === 502 || status === 503 || status === 504;

      if (isNetworkError || isServerUnavailable) {
        // Local-only fallback so the app is usable without the backend
        await setToken(`local-${localUser.id}`);
        setUser(localUser);
        await upsertUser(localUser);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/');
        return;
      }

      Alert.alert(
        'Registration failed',
        error?.response?.data?.message || 'Something went wrong. Please try again.',
      );
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
          onPress={() => {
            if (step > 1) { setErrors({}); setStep(step - 1); }
            else if (router.canGoBack()) router.back();
            else router.replace('/auth/login');
          }}
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

            {/* Apple Sign-In (iOS only; required by Apple if any other social option exists) */}
            <View style={{ marginTop: 14 }}>
              <AppleSignInButton
                onSuccess={async (cred) => {
                  setLoading(true);
                  try {
                    const { user, token } = await signInWithApple({
                      identityToken: cred.identityToken!,
                      fullName: cred.fullName,
                      email: cred.email,
                    });
                    await setToken(token);
                    setUser(user);
                    await upsertUser(user);
                    router.replace('/');
                  } catch (e: any) {
                    Alert.alert('Apple sign-in failed', e?.message || 'Please try again.');
                  } finally {
                    setLoading(false);
                  }
                }}
                onError={(e) => Alert.alert('Apple sign-in failed', e?.message || 'Please try again.')}
              />
            </View>
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
