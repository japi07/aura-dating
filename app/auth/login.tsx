import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, Dimensions, TouchableOpacity, Image,
  TextInput, StatusBar,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

const { height: SH, width: SW } = Dimensions.get('window');

const HERO_AVATARS = [
  'https://i.pravatar.cc/120?img=47',
  'https://i.pravatar.cc/120?img=48',
  'https://i.pravatar.cc/120?img=49',
  'https://i.pravatar.cc/120?img=25',
  'https://i.pravatar.cc/120?img=26',
  'https://i.pravatar.cc/120?img=50',
];

export default function LoginScreen() {
  const router = useRouter();
  const { setToken, setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Min 6 characters';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      await setToken(res.token);
      setUser({ id: res.user.id, email: res.user.email, name: res.user.name, profileComplete: res.user.profileComplete, age: res.user.age, city: res.user.city, bio: res.user.bio, interests: res.user.interests, gender: res.user.gender, genderInterest: res.user.genderInterest, photoUrl: res.user.photoUrl });
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Login failed', err.response?.data?.message || 'Invalid credentials. Try demo mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    await setToken('demo-token-12345');
    setUser({ id: 'demo-user-1', email: 'demo@aura.com', name: 'Sarah', profileComplete: true, age: 27, city: 'Shoreditch, London', bio: 'Marketing director, always hunting hidden cafés in east London. Looking for someone who can keep up on a Sunday market wander.', interests: ['Art', 'Coffee', 'Travel', 'Cooking', 'Theatre'], gender: 'female', genderInterest: 'male', photoUrl: 'https://i.pravatar.cc/400?img=47' });
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Hero section */}
      <View style={styles.hero}>
        {/* Floating avatar grid */}
        <View style={styles.avatarGrid}>
          {HERO_AVATARS.map((uri, i) => (
            <View
              key={i}
              style={[
                styles.avatarWrap,
                { transform: [{ rotate: `${(i % 2 === 0 ? -1 : 1) * (4 + i * 2)}deg` }] },
              ]}
            >
              <Image source={{ uri }} style={styles.avatarImg} />
              {i === 0 && <View style={styles.avatarRing} />}
            </View>
          ))}
        </View>

        {/* Overlay gradient */}
        <View style={styles.heroOverlay} />

        {/* Logo + tagline */}
        <View style={styles.heroContent}>
          <View style={styles.logoRow}>
            <Ionicons name="flame" size={36} color="#fff" />
            <Text style={styles.logoText}>aura</Text>
          </View>
          <Text style={styles.tagline}>Where real connections{'\n'}begin ✨</Text>
        </View>
      </View>

      {/* Form sheet */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sheetTitle}>Welcome back</Text>
        <Text style={styles.sheetSub}>Sign in to find your match</Text>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={[styles.fieldWrap, focusedField === 'email' && styles.fieldWrapFocused, errors.email && styles.fieldWrapError]}>
            <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? COLORS.BRAND : COLORS.TEXT_MUTED} />
            <TextInput
              style={styles.fieldInput}
              placeholder="your@email.com"
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={email}
              onChangeText={(t) => { setEmail(t); if (errors.email) setErrors(e => ({...e, email: undefined})); }}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[styles.fieldWrap, focusedField === 'pw' && styles.fieldWrapFocused, errors.password && styles.fieldWrapError]}>
            <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'pw' ? COLORS.BRAND : COLORS.TEXT_MUTED} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Enter password"
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={password}
              onChangeText={(t) => { setPassword(t); if (errors.password) setErrors(e => ({...e, password: undefined})); }}
              secureTextEntry={!showPw}
              onFocus={() => setFocusedField('pw')}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.TEXT_MUTED} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign in button */}
        <TouchableOpacity style={[styles.signInBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading ? (
            <Text style={styles.signInText}>Signing in...</Text>
          ) : (
            <>
              <Text style={styles.signInText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Demo button */}
        <TouchableOpacity style={styles.demoBtn} onPress={handleDemo} activeOpacity={0.85}>
          <Ionicons name="sparkles-outline" size={18} color={COLORS.BRAND} />
          <Text style={styles.demoBtnText}>Try Demo Mode</Text>
        </TouchableOpacity>

        {/* Register link */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <Link href="/auth/register">
            <Text style={styles.registerLink}>Create one</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  hero: {
    height: SH * 0.42, backgroundColor: COLORS.BRAND,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  avatarGrid: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 16, opacity: 0.55,
  },
  avatarWrap: { width: 76, height: 76, borderRadius: 20, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarRing: {
    position: 'absolute', inset: 0, borderRadius: 20,
    borderWidth: 2.5, borderColor: '#fff',
  },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
    backgroundColor: 'rgba(200,20,55,0.72)',
  },
  heroContent: {
    padding: 28, paddingBottom: 36,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  logoText: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: 20, fontWeight: '600', color: 'rgba(255,255,255,0.9)', lineHeight: 28 },

  sheet: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -28,
  },
  sheetContent: { padding: 28, paddingTop: 32 },
  sheetTitle: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, marginBottom: 4, letterSpacing: -0.5 },
  sheetSub: { fontSize: 14, color: COLORS.TEXT_MUTED, marginBottom: 28 },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY, marginBottom: 8, letterSpacing: 0.2 },
  fieldWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER,
  },
  fieldWrapFocused: { borderColor: COLORS.BRAND, backgroundColor: COLORS.BRAND_MUTED + '60' },
  fieldWrapError: { borderColor: COLORS.ERROR },
  fieldInput: { flex: 1, fontSize: 15, color: COLORS.TEXT, fontWeight: '500' },
  errorText: { fontSize: 12, color: COLORS.ERROR, marginTop: 5, fontWeight: '600' },
  forgotText: { fontSize: 13, color: COLORS.BRAND, fontWeight: '700' },

  signInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    marginBottom: 24,
  },
  signInText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.BORDER },
  dividerText: { fontSize: 13, color: COLORS.TEXT_MUTED, marginHorizontal: 14, fontWeight: '600' },

  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 15, borderWidth: 2, borderColor: COLORS.BRAND_MUTED,
    backgroundColor: COLORS.BRAND_MUTED,
    marginBottom: 28,
  },
  demoBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.BRAND },

  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { fontSize: 14, color: COLORS.TEXT_MUTED },
  registerLink: { fontSize: 14, fontWeight: '800', color: COLORS.BRAND },
});
