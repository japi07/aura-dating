import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { sendPasswordReset } from '@/lib/auth-supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        {sent ? (
          <>
            <View style={styles.heroIcon}>
              <Ionicons name="mail-open" size={40} color={COLORS.BRAND} />
            </View>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.sub}>
              If an account exists for {email.trim()}, we've sent a link to reset your password. Open it on this device to continue.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/auth/login')} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Back to sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={{ paddingVertical: 12 }}>
              <Text style={styles.resendText}>Didn't get it? Resend</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.heroIcon}>
              <Ionicons name="lock-closed" size={36} color={COLORS.BRAND} />
            </View>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.sub}>
              Enter your email and we'll send you a link to set a new one.
            </Text>

            <View style={[styles.field, error && styles.fieldError]}>
              <Ionicons name="mail-outline" size={18} color={COLORS.TEXT_MUTED} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={email}
                onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send reset link</Text>}
            </TouchableOpacity>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: { paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 12, alignItems: 'center' },
  heroIcon: {
    width: 80, height: 80, borderRadius: 26, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, marginBottom: 10, textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 21, marginBottom: 26, paddingHorizontal: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%',
    backgroundColor: COLORS.SURFACE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: COLORS.BORDER,
  },
  fieldError: { borderColor: COLORS.ERROR },
  input: { flex: 1, fontSize: 15, color: COLORS.TEXT, fontWeight: '500' },
  errorText: { fontSize: 13, color: COLORS.ERROR, alignSelf: 'flex-start', marginTop: 8, fontWeight: '600' },
  primaryBtn: {
    width: '100%', backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 22,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  resendText: { fontSize: 13, color: COLORS.BRAND, fontWeight: '700' },
});
