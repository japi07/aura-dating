import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator, Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { startGoogleSignIn } from '@/lib/auth-supabase';

/**
 * Opens Google's consent screen in the system browser. The session is
 * established when Google redirects back to `auradating://auth-callback`,
 * which the root layout handles.
 */
export function GoogleSignInButton({ onError }: { onError?: (e: any) => void }) {
  const [loading, setLoading] = useState(false);

  const press = async () => {
    setLoading(true);
    try {
      const url = await startGoogleSignIn();
      await Linking.openURL(url);
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={styles.btn} onPress={press} disabled={loading} activeOpacity={0.85}>
      {loading ? (
        <ActivityIndicator color={COLORS.TEXT} />
      ) : (
        <>
          <View style={styles.glyphWrap}>
            <Ionicons name="logo-google" size={18} color="#4285F4" />
          </View>
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: COLORS.BORDER, marginTop: 10,
  },
  glyphWrap: { width: 20, alignItems: 'center' },
  text: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
});
