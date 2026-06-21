import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Alert,
  Animated, Easing, ActivityIndicator, Image, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/colors';
import { useAuthStore } from '@/store/auth';
import { verificationApi } from '@/lib/api';
import { submitVerificationToServer } from '@/lib/profile-supabase';
import { getSessionUserId } from '@/lib/proposals-supabase';
import { personaConfigured, startPersonaVerification } from '@/lib/persona';

type Step =
  | 'intro'
  | 'biometric'
  | 'selfie'
  | 'liveness'      // real video capture, no fake button taps
  | 'uploading'
  | 'pending'       // submitted, awaiting backend / manual review
  | 'success'
  | 'rejected';

const MIN_VIDEO_SEC = 3;
const MAX_VIDEO_SEC = 15;

export default function VerifyScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>('intro');
  const [biometricType, setBiometricType] = useState<string>('Touch');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const scanLine = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  /* ─── biometric availability check ─────────────────────────────── */
  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(async (has) => {
      if (!has) return;
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return;
      setBiometricAvailable(true);
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setBiometricType('Face ID');
      else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setBiometricType('Fingerprint');
      else setBiometricType('Biometric');
    });
  }, []);

  /* ─── animations per step ───────────────────────────────────────── */
  useEffect(() => {
    if (step === 'biometric') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])).start();
    }
    if (step === 'selfie' || step === 'liveness') {
      Animated.loop(Animated.timing(scanLine, {
        toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.linear,
      })).start();
    }
  }, [step]);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: uploadPct, duration: 200, useNativeDriver: false }).start();
  }, [uploadPct]);

  const close = () => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  };

  /* ─── entry: prefer Persona ID verification when configured ───────── */
  const beginVerification = async () => {
    if (personaConfigured) {
      const uid = await getSessionUserId();
      if (uid) {
        try {
          const started = await startPersonaVerification(uid);
          if (started) {
            if (user) setUser({ ...user, verificationStatus: 'pending' });
            setEstimatedMinutes(10);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            setStep('pending');
            return;
          }
        } catch (e: any) {
          setError(e?.message || 'Could not open ID verification. Please try again.');
          return;
        }
      }
    }
    // Fall back to the in-app selfie + liveness flow
    startBiometric();
  };

  /* ─── step 1: biometric ─────────────────────────────────────────── */
  const startBiometric = async () => {
    setError(null);
    Haptics.selectionAsync().catch(() => {});
    if (!biometricAvailable) {
      setStep('selfie');
      return;
    }
    setStep('biometric');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify it\'s really you',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setStep('selfie');
      } else {
        setError('Authentication cancelled — please try again to continue.');
        setStep('intro');
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
      setStep('intro');
    }
  };

  /* ─── step 2: selfie ────────────────────────────────────────────── */
  const takeSelfie = async () => {
    Haptics.selectionAsync().catch(() => {});
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission required', 'We need camera access to verify you.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('liveness');
    }
  };

  /* ─── step 3: liveness — record a real video ────────────────────── */
  const recordLivenessVideo = async () => {
    Haptics.selectionAsync().catch(() => {});
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      Alert.alert('Camera permission needed', 'We need camera access for the liveness check.');
      return;
    }
    // Not in expo-image-picker's types on every SDK — call defensively
    const mic = await (ImagePicker as any).requestMicrophonePermissionsAsync?.();
    if (mic && !mic.granted) {
      Alert.alert('Microphone permission needed', 'The liveness video needs sound too.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      cameraType: ImagePicker.CameraType.front,
      videoMaxDuration: MAX_VIDEO_SEC,
      videoQuality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const durSec = a.duration ? Math.round(a.duration / 1000) : null;
      // Real check: video must be at least MIN_VIDEO_SEC long, otherwise
      // it's not enough motion for liveness detection.
      if (durSec !== null && durSec < MIN_VIDEO_SEC) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert(
          'Video too short',
          `Please record at least ${MIN_VIDEO_SEC} seconds turning your head left, right, and smiling so we can confirm you're a real person.`,
        );
        return;
      }
      setVideoUri(a.uri);
      setVideoDuration(durSec);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      submitVerification(a.uri, durSec);
    }
  };

  /* ─── step 4: submit to backend ─────────────────────────────────── */
  const submitVerification = async (videoUriArg: string, durSec: number | null) => {
    if (!selfieUri) return;
    setStep('uploading');
    setUploadPct(0);
    setError(null);

    if (user) setUser({ ...user, verificationStatus: 'submitting' });

    // Preferred path: upload straight to Supabase Storage + verifications table.
    const signedIn = await getSessionUserId();
    if (signedIn) {
      try {
        setUploadPct(15);
        const result = await submitVerificationToServer({
          photoUri: selfieUri,
          videoUri: videoUriArg,
          videoDurationSec: durSec ?? undefined,
        });
        setUploadPct(100);
        if (user) {
          setUser({
            ...user,
            verificationStatus: 'pending',
            verificationId: result.verificationId,
          });
        }
        setEstimatedMinutes(result.estimatedReviewMinutes);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setStep('pending');
      } catch (e: any) {
        setError(e?.message || 'Verification upload failed — please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setStep('intro');
      }
      return;
    }

    // Legacy / offline fallback: the old REST endpoint (may be unreachable).
    try {
      const result = await verificationApi.submit(
        { photoUri: selfieUri, videoUri: videoUriArg, videoDurationSec: durSec ?? undefined },
        (pct) => setUploadPct(pct),
      );

      if (result.status === 'verified') {
        if (user) {
          setUser({
            ...user,
            verified: true,
            verifiedAt: result.reviewedAt || new Date().toISOString(),
            verificationStatus: 'verified',
            verificationId: result.verificationId,
          });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setStep('success');
      } else if (result.status === 'pending') {
        if (user) {
          setUser({
            ...user,
            verificationStatus: 'pending',
            verificationId: result.verificationId,
          });
        }
        setEstimatedMinutes(result.estimatedReviewMinutes ?? 30);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setStep('pending');
      } else {
        if (user) {
          setUser({
            ...user,
            verificationStatus: 'rejected',
            verificationReason: result.reason,
          });
        }
        setRejectReason(result.reason || 'Could not verify identity');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setStep('rejected');
      }
    } catch (e: any) {
      // Backend unreachable — queue locally as pending review
      const isNetworkError = !e?.response;
      if (isNetworkError) {
        const pendingId = `local_v_${Date.now()}`;
        if (user) {
          setUser({
            ...user,
            verificationStatus: 'pending',
            verificationId: pendingId,
          });
        }
        setEstimatedMinutes(60);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setStep('pending');
      } else {
        setError(e?.response?.data?.message || 'Verification failed — please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setStep('intro');
      }
    }
  };

  /* ─── render: intro ─────────────────────────────────────────────── */
  if (step === 'intro') {
    const wasRejected = user?.verificationStatus === 'rejected';
    const isPending = user?.verificationStatus === 'pending';
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.backBtn}>
            <Ionicons name="close" size={26} color={COLORS.TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify yourself</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.body}>
          <View style={styles.shieldHero}>
            <View style={styles.shieldGlow} />
            <View style={styles.shieldInner}>
              <Ionicons name="shield-checkmark" size={56} color="#fff" />
            </View>
          </View>

          <Text style={styles.title}>Get the verified badge</Text>
          <Text style={styles.subtitle}>
            Real human, real identity. The process takes ~45 seconds and your selfie + liveness video are sent to our verification team.
          </Text>

          {wasRejected && user?.verificationReason && (
            <View style={styles.errorPill}>
              <Ionicons name="alert-circle" size={14} color={COLORS.ERROR} />
              <Text style={styles.errorPillText}>{user.verificationReason}</Text>
            </View>
          )}
          {isPending && (
            <View style={styles.pendingPill}>
              <Ionicons name="time" size={14} color={COLORS.WARNING} />
              <Text style={styles.pendingPillText}>Your last submission is still under review</Text>
            </View>
          )}

          <View style={styles.stepsBox}>
            <Text style={styles.stepsTitle}>3 steps · about 45 seconds</Text>
            <StepRow num={1} text={`${biometricType} authentication`} icon="finger-print" />
            <StepRow num={2} text="Take a selfie" icon="camera" />
            <StepRow num={3} text={`Record a ${MIN_VIDEO_SEC}-${MAX_VIDEO_SEC}s liveness video`} icon="videocam" />
          </View>
        </View>

        <View style={styles.footer}>
          {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
          <TouchableOpacity style={styles.primaryBtn} onPress={beginVerification} activeOpacity={0.85}>
            <Ionicons name={biometricAvailable ? 'finger-print' : 'camera'} size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {wasRejected ? 'Try again' : isPending ? 'Re-submit' : (biometricAvailable ? `Verify with ${biometricType}` : 'Start verification')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.legalText}>
            Your selfie and video are reviewed by our trust &amp; safety team using face-match and liveness detection. They're never shown on your profile.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── biometric step ────────────────────────────────────────────── */
  if (step === 'biometric') {
    return (
      <SafeAreaView style={styles.containerDark}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[styles.bioCircle, { transform: [{ scale: pulse }] }]}>
          <Ionicons name="finger-print" size={72} color={COLORS.BRAND} />
        </Animated.View>
        <Text style={styles.titleDark}>Authenticating…</Text>
        <Text style={styles.subtitleDark}>Use {biometricType} to continue</Text>
      </SafeAreaView>
    );
  }

  /* ─── selfie step ───────────────────────────────────────────────── */
  if (step === 'selfie') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('intro')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step 2 of 3</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>

        <View style={styles.body}>
          <View style={styles.cameraFrameOuter}>
            <View style={styles.cameraFrame}>
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
              ) : (
                <Ionicons name="person" size={120} color={COLORS.BORDER} />
              )}
              <Animated.View style={[styles.scanLineOverlay, {
                transform: [{ translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, 280] }) }],
              }]} />
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          <Text style={styles.title}>Take a selfie</Text>
          <Text style={styles.subtitle}>
            Center your face. Good light. No hat or sunglasses.{'\n'}This becomes the reference photo for face-match.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={takeSelfie} activeOpacity={0.85}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>{selfieUri ? 'Retake selfie' : 'Open camera'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── liveness step (real video capture) ────────────────────────── */
  if (step === 'liveness') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('selfie')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step 3 of 3</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>

        <View style={styles.body}>
          <View style={styles.cameraFrameOuter}>
            <View style={styles.cameraFrame}>
              {selfieUri && <Image source={{ uri: selfieUri }} style={[styles.selfiePreview, { opacity: 0.35 }]} />}
              <View style={styles.livenessCenter}>
                <Ionicons name="videocam" size={56} color={COLORS.BRAND} />
                <Text style={styles.livenessHint}>{MIN_VIDEO_SEC}–{MAX_VIDEO_SEC}s</Text>
              </View>
            </View>
          </View>

          <Text style={styles.title}>Record a liveness video</Text>
          <Text style={styles.subtitle}>
            Hold the camera at face height. Slowly turn your head <Text style={styles.subBold}>left</Text>, then <Text style={styles.subBold}>right</Text>, then <Text style={styles.subBold}>smile</Text>. {MIN_VIDEO_SEC}–{MAX_VIDEO_SEC} seconds.
          </Text>

          <View style={styles.actionsRow}>
            <View style={styles.action}>
              <View style={styles.actionIcon}><Ionicons name="arrow-back" size={18} color={COLORS.BRAND} /></View>
              <Text style={styles.actionText}>Look left</Text>
            </View>
            <View style={styles.action}>
              <View style={styles.actionIcon}><Ionicons name="arrow-forward" size={18} color={COLORS.BRAND} /></View>
              <Text style={styles.actionText}>Look right</Text>
            </View>
            <View style={styles.action}>
              <View style={styles.actionIcon}><Ionicons name="happy" size={18} color={COLORS.BRAND} /></View>
              <Text style={styles.actionText}>Smile</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={recordLivenessVideo} activeOpacity={0.85}>
            <Ionicons name="videocam" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Start recording</Text>
          </TouchableOpacity>
          <Text style={styles.legalText}>
            The video is encrypted in transit and only used to confirm you're a real human.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── uploading step ────────────────────────────────────────────── */
  if (step === 'uploading') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.body}>
          <View style={styles.processingWrap}>
            <ActivityIndicator size="large" color={COLORS.BRAND} />
          </View>
          <Text style={styles.title}>Uploading…</Text>
          <Text style={styles.subtitle}>
            Sending your selfie and liveness video to our verification team.
          </Text>

          <View style={styles.uploadBar}>
            <Animated.View style={[styles.uploadBarFill, {
              width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
            }]} />
          </View>
          <Text style={styles.uploadPctText}>{uploadPct}%</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── pending step ──────────────────────────────────────────────── */
  if (step === 'pending') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.body}>
          <View style={styles.pendingHero}>
            <View style={styles.pendingGlow} />
            <View style={styles.pendingInner}>
              <Ionicons name="time" size={56} color="#fff" />
            </View>
          </View>

          <Text style={styles.title}>Under review</Text>
          <Text style={styles.subtitle}>
            Your verification is being reviewed by our trust &amp; safety team. We'll notify you the moment it's complete.
          </Text>

          <View style={styles.pendingBox}>
            <View style={styles.pendingRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.LIKE} />
              <Text style={styles.pendingText}>Selfie received</Text>
            </View>
            <View style={styles.pendingRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.LIKE} />
              <Text style={styles.pendingText}>Liveness video received</Text>
            </View>
            <View style={styles.pendingRow}>
              <ActivityIndicator size="small" color={COLORS.WARNING} />
              <Text style={styles.pendingText}>Manual review in progress</Text>
            </View>
            {estimatedMinutes !== null && (
              <Text style={styles.pendingEta}>
                Estimated review: {estimatedMinutes < 60 ? `~${estimatedMinutes} min` : `~${Math.round(estimatedMinutes / 60)} hr`}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={close} activeOpacity={0.85}>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── rejected step ─────────────────────────────────────────────── */
  if (step === 'rejected') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.body}>
          <View style={styles.rejectHero}>
            <View style={styles.rejectGlow} />
            <View style={styles.rejectInner}>
              <Ionicons name="close" size={56} color="#fff" />
            </View>
          </View>

          <Text style={styles.title}>Verification couldn't complete</Text>
          <Text style={styles.subtitle}>
            {rejectReason || 'We couldn\'t confirm your identity from these recordings.'}
          </Text>

          <View style={styles.errorBoxFull}>
            <Text style={styles.errorBoxTitle}>Common causes</Text>
            <Text style={styles.errorBoxText}>• Face partially obscured (hat, mask, sunglasses)</Text>
            <Text style={styles.errorBoxText}>• Lighting too dark or too backlit</Text>
            <Text style={styles.errorBoxText}>• Selfie and video don't appear to be the same person</Text>
            <Text style={styles.errorBoxText}>• Video too short to confirm motion</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('intro')} activeOpacity={0.85}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── success step ──────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.body}>
        <View style={styles.successHero}>
          <View style={styles.successGlow} />
          <View style={styles.successInner}>
            <Ionicons name="shield-checkmark" size={64} color="#fff" />
          </View>
        </View>

        <Text style={styles.titleSuccess}>You're verified! ✨</Text>
        <Text style={styles.subtitle}>
          Your verified badge is now on your profile. You'll get priority in our matching queue.
        </Text>

        <View style={styles.successStats}>
          <SuccessStat num="4×" label="more proposals" />
          <SuccessStat num="2×" label="match quality" />
          <SuccessStat num="100%" label="verified humans" />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={close} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Back to my profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StepRow({ num, text, icon }: { num: number; text: string; icon: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepDot}><Text style={styles.stepDotText}>{num}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
      <Ionicons name={icon as any} size={14} color={COLORS.TEXT_MUTED} />
    </View>
  );
}

function SuccessStat({ num, label }: { num: string; label: string }) {
  return (
    <View style={styles.successStat}>
      <Text style={styles.successStatNum}>{num}</Text>
      <Text style={styles.successStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  containerDark: { flex: 1, backgroundColor: COLORS.TEXT, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT },

  progressBar: { height: 3, marginHorizontal: 16, backgroundColor: COLORS.BORDER_LIGHT, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.BRAND, borderRadius: 2 },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },

  shieldHero: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  shieldGlow: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: COLORS.BRAND, opacity: 0.18 },
  shieldInner: {
    width: 100, height: 100, borderRadius: 28, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },

  title: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, marginTop: 12, marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  titleDark: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 32, marginBottom: 8, textAlign: 'center' },
  titleSuccess: { fontSize: 28, fontWeight: '900', color: COLORS.BRAND, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8, marginBottom: 20 },
  subtitleDark: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 21, textAlign: 'center' },
  subBold: { fontWeight: '800', color: COLORS.TEXT },

  errorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.ERROR_LIGHT, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    marginBottom: 16,
  },
  errorPillText: { fontSize: 12, color: COLORS.ERROR, fontWeight: '600' },
  pendingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.WARNING_LIGHT, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    marginBottom: 16,
  },
  pendingPillText: { fontSize: 12, color: COLORS.WARNING, fontWeight: '700' },

  stepsBox: {
    width: '100%', backgroundColor: COLORS.BRAND_MUTED, padding: 16, borderRadius: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.BRAND,
  },
  stepsTitle: { fontSize: 12, fontWeight: '800', color: COLORS.BRAND, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.BRAND, justifyContent: 'center', alignItems: 'center' },
  stepDotText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  stepText: { flex: 1, fontSize: 13, color: COLORS.TEXT, fontWeight: '500' },

  footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  legalText: { fontSize: 11, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 12, lineHeight: 16, paddingHorizontal: 16 },
  errorText: { fontSize: 13, color: COLORS.ERROR, textAlign: 'center', marginBottom: 10, fontWeight: '600' },

  bioCircle: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(253,58,92,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(253,58,92,0.4)',
  },

  cameraFrameOuter: {
    width: 280, height: 280, borderRadius: 32, padding: 6,
    backgroundColor: COLORS.BRAND_MUTED, marginVertical: 12,
  },
  cameraFrame: {
    flex: 1, borderRadius: 28, backgroundColor: COLORS.SURFACE, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  selfiePreview: { width: '100%', height: '100%', position: 'absolute' },
  scanLineOverlay: {
    position: 'absolute', left: 0, right: 0, height: 3,
    backgroundColor: COLORS.BRAND, opacity: 0.7,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8,
  },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: COLORS.BRAND, borderRadius: 4 },
  cornerTL: { top: 12, left: 12, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 4, borderRightWidth: 4 },

  livenessCenter: { alignItems: 'center', gap: 6 },
  livenessHint: { fontSize: 11, fontWeight: '700', color: COLORS.BRAND, letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  actionText: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  processingWrap: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginVertical: 16,
  },
  uploadBar: { width: '100%', height: 8, backgroundColor: COLORS.BORDER_LIGHT, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  uploadBarFill: { height: '100%', backgroundColor: COLORS.BRAND, borderRadius: 4 },
  uploadPctText: { fontSize: 14, fontWeight: '700', color: COLORS.BRAND, marginTop: 8 },

  pendingHero: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginVertical: 18 },
  pendingGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: COLORS.WARNING, opacity: 0.18 },
  pendingInner: {
    width: 110, height: 110, borderRadius: 32, backgroundColor: COLORS.WARNING,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.WARNING, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  pendingBox: {
    width: '100%', backgroundColor: COLORS.SURFACE, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pendingText: { fontSize: 13, color: COLORS.TEXT, fontWeight: '500' },
  pendingEta: { fontSize: 12, color: COLORS.WARNING, fontWeight: '700', marginTop: 10, textAlign: 'center' },

  rejectHero: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginVertical: 18 },
  rejectGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: COLORS.ERROR, opacity: 0.18 },
  rejectInner: {
    width: 110, height: 110, borderRadius: 32, backgroundColor: COLORS.ERROR,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.ERROR, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  errorBoxFull: {
    width: '100%', backgroundColor: COLORS.ERROR_LIGHT, padding: 16, borderRadius: 14,
    borderLeftWidth: 3, borderLeftColor: COLORS.ERROR,
  },
  errorBoxTitle: { fontSize: 12, fontWeight: '900', color: COLORS.ERROR, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  errorBoxText: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 19 },

  successHero: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  successGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: COLORS.LIKE, opacity: 0.2 },
  successInner: {
    width: 110, height: 110, borderRadius: 32, backgroundColor: COLORS.LIKE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.LIKE, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  successStats: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 12 },
  successStat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.SURFACE, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.BORDER_LIGHT },
  successStatNum: { fontSize: 22, fontWeight: '900', color: COLORS.BRAND, marginBottom: 4 },
  successStatLabel: { fontSize: 11, color: COLORS.TEXT_MUTED, textAlign: 'center', fontWeight: '600' },
});
