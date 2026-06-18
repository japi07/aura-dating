import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { updatePassword } from '@/lib/auth-supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords don\'t match'); return; }
    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated ✨', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      setError(e?.message || 'Could not update your password. The reset link may have expired — request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <View style={styles.heroIcon}>
          <Ionicons name="key" size={36} color={COLORS.BRAND} />
        </View>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.sub}>Choose a strong password you'll remember.</Text>

        <View style={[styles.field, error && styles.fieldError]}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.TEXT_MUTED} />
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={COLORS.TEXT_MUTED}
            value={password}
            onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
            secureTextEntry={!show}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShow(!show)}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <View style={[styles.field, { marginTop: 12 }, error && styles.fieldError]}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.TEXT_MUTED} />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={COLORS.TEXT_MUTED}
            value={confirm}
            onChangeText={(t) => { setConfirm(t); if (error) setError(null); }}
            secureTextEntry={!show}
            autoCapitalize="none"
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update password</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 40, alignItems: 'center' },
  heroIcon: {
    width: 80, height: 80, borderRadius: 26, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, marginBottom: 10, textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 21, marginBottom: 26 },
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
});
