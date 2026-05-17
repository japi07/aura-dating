/**
 * Sign in with Apple button.
 *
 * Required by Apple for any iOS app that offers other social-login
 * options (App Store Review Guideline 4.8). On Android / web we just
 * render nothing so the parent doesn't have to special-case it.
 *
 * Pass `onSuccess` with the user payload and a token — the parent is
 * responsible for handing it to your backend (Supabase signInWithIdToken).
 */
import React from 'react';
import { Platform, StyleSheet, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';

interface Props {
  /** Called on a successful Apple sign-in with the credential */
  onSuccess: (cred: AppleAuthentication.AppleAuthenticationCredential) => void | Promise<void>;
  /** Called when the user explicitly cancels or sign-in errors */
  onError?: (err: any) => void;
  style?: any;
  /** Defaults to 14 — Apple's UI guideline */
  cornerRadius?: number;
}

export function AppleSignInButton({ onSuccess, onError, style, cornerRadius = 14 }: Props) {
  const [available, setAvailable] = React.useState(Platform.OS === 'ios');

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  if (Platform.OS !== 'ios' || !available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={cornerRadius}
      style={[styles.button, style]}
      onPress={async () => {
        Haptics.selectionAsync().catch(() => {});
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (!credential.identityToken) {
            Alert.alert('Apple sign-in failed', 'Apple did not return an identity token. Please try again.');
            onError?.(new Error('No identityToken'));
            return;
          }
          await onSuccess(credential);
        } catch (e: any) {
          if (e?.code === 'ERR_REQUEST_CANCELED') return; // user cancelled — silent
          onError?.(e);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', height: 50 },
});
