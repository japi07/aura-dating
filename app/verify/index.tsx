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
import { COLORS } from '@/constants/colors';
import { useAuthStore } from '@/store/auth';

type Step = 'intro' | 'biometric' | 'selfie' | 'liveness' | 'processing' | 'success';

const LIVENESS_ACTIONS = [
  { id: 'left', label: 'Turn your head LEFT', icon: 'arrow-back' },
  { id: 'right', label: 'Turn your head RIGHT', icon: 'arrow-forward' },
  { id: 'smile', label: 'Smile naturally', icon: 'happy' },
];

export default function VerifyScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>('intro');
  const [biometricType, setBiometricType] = useState<string>('Touch');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [livenessStep, setLivenessStep] = useState(0);
  const [livenessProgress, setLivenessProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(async (has) => {
      if (has) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (enrolled) {
          setBiometricAvailable(true);
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('Face ID');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('Fingerprint');
          } else {
            setBiometricType('Biometric');
          }
        }
      }
    });
  }, []);

  // Pulse animation for biometric step
  useEffect(() => {
    if (step === 'biometric' || step === 'liveness') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    }
    if (step === 'selfie' || step === 'processing') {
      Animated.loop(
        Animated.timing(scanLine, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    }
  }, [step]);

  const startBiometric = async () => {
    setError(null);
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
        setStep('selfie');
      } else {
        setError('Authentication cancelled');
        setStep('intro');
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
      setStep('intro');
    }
  };

  const takeSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission required', 'We need camera access to verify you\'re a real person.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
      setStep('liveness');
      setLivenessStep(0);
      setLivenessProgress([]);
    }
  };

  const completeLivenessAction = () => {
    const action = LIVENESS_ACTIONS[livenessStep];
    setLivenessProgress((p) => [...p, action.id]);
    if (livenessStep < LIVENESS_ACTIONS.length - 1) {
      setLivenessStep((s) => s + 1);
    } else {
      // All actions complete → process
      setStep('processing');
      setTimeout(() => {
        if (user) {
          setUser({ ...user, verified: true, verifiedAt: new Date().toISOString() });
        }
        setStep('success');
      }, 2400);
    }
  };

  // ─── Intro step ───
  if (step === 'intro') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
            We verify every member is a real human. It takes 30 seconds and gives you priority in the matching queue.
          </Text>

          <View style={styles.benefitList}>
            <BenefitRow icon="ribbon" color={COLORS.BRAND} title="Verified badge on your profile" desc="Stand out — verified profiles get 4× more proposals" />
            <BenefitRow icon="shield-checkmark" color={COLORS.LIKE} title="Trusted community" desc="Only humans here. No bots, no catfishing." />
            <BenefitRow icon="lock-closed" color={COLORS.INFO} title="Your data stays private" desc="Verification is processed locally on your device" />
          </View>

          <View style={styles.stepsBox}>
            <Text style={styles.stepsTitle}>3 quick steps</Text>
            <View style={styles.stepRow}>
              <View style={styles.stepDot}><Text style={styles.stepDotText}>1</Text></View>
              <Text style={styles.stepText}>{biometricType} authentication</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepDot}><Text style={styles.stepDotText}>2</Text></View>
              <Text style={styles.stepText}>Take a selfie</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepDot}><Text style={styles.stepDotText}>3</Text></View>
              <Text style={styles.stepText}>Liveness check (face movements)</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
          <TouchableOpacity style={styles.primaryBtn} onPress={startBiometric} activeOpacity={0.85}>
            <Ionicons name={biometricAvailable ? 'finger-print' : 'camera'} size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {biometricAvailable ? `Verify with ${biometricType}` : 'Start verification'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.legalText}>
            We use Face ID / Touch ID and selfie matching to confirm you're a real person.
            We never share biometric data.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Biometric step ───
  if (step === 'biometric') {
    return (
      <SafeAreaView style={styles.containerDark}>
        <StatusBar barStyle="light-content" />
        <View style={styles.body}>
          <Animated.View style={[styles.bioCircle, { transform: [{ scale: pulse }] }]}>
            <Ionicons name="finger-print" size={72} color={COLORS.BRAND} />
          </Animated.View>
          <Text style={styles.titleDark}>Authenticating...</Text>
          <Text style={styles.subtitleDark}>Use {biometricType} to continue</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Selfie step ───
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
              <Animated.View
                style={[
                  styles.scanLineOverlay,
                  {
                    transform: [{
                      translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, 280] }),
                    }],
                  },
                ]}
              />
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          <Text style={styles.title}>Take a selfie</Text>
          <Text style={styles.subtitle}>
            Center your face in the frame. Make sure you're in good light and not wearing sunglasses.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={takeSelfie} activeOpacity={0.85}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Open camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Liveness step ───
  if (step === 'liveness') {
    const action = LIVENESS_ACTIONS[livenessStep];
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
              {selfieUri && <Image source={{ uri: selfieUri }} style={[styles.selfiePreview, { opacity: 0.5 }]} />}
              <Animated.View style={[styles.livenessIcon, { transform: [{ scale: pulse }] }]}>
                <Ionicons name={action.icon as any} size={64} color="#fff" />
              </Animated.View>
            </View>
          </View>

          <Text style={styles.title}>{action.label}</Text>
          <Text style={styles.subtitle}>
            We're checking that you're a real person, not a photo.
          </Text>

          {/* Step pills */}
          <View style={styles.stepPills}>
            {LIVENESS_ACTIONS.map((a, i) => (
              <View
                key={a.id}
                style={[
                  styles.stepPill,
                  i < livenessStep && styles.stepPillDone,
                  i === livenessStep && styles.stepPillActive,
                ]}
              >
                {i < livenessStep ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={[styles.stepPillText, i === livenessStep && { color: '#fff' }]}>{i + 1}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={completeLivenessAction} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Done — next</Text>
          </TouchableOpacity>
          <Text style={styles.legalText}>
            On the real flow, this would happen automatically via the camera.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Processing step ───
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.body}>
          <View style={styles.processingWrap}>
            <ActivityIndicator size="large" color={COLORS.BRAND} />
          </View>
          <Text style={styles.title}>Verifying you...</Text>
          <Text style={styles.subtitle}>
            We're matching your selfie against the liveness check.{'\n'}This takes a few seconds.
          </Text>
          <View style={styles.processSteps}>
            <ProcessRow label="Biometric authenticated" done />
            <ProcessRow label="Selfie captured" done />
            <ProcessRow label="Liveness verified" done />
            <ProcessRow label="Issuing verified badge..." active />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Success step ───
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
          Your profile now has the verified badge. You'll get priority in our matching queue.
        </Text>

        <View style={styles.successStats}>
          <View style={styles.successStat}>
            <Text style={styles.successStatNum}>4×</Text>
            <Text style={styles.successStatLabel}>more proposals</Text>
          </View>
          <View style={styles.successStat}>
            <Text style={styles.successStatNum}>2×</Text>
            <Text style={styles.successStatLabel}>better match quality</Text>
          </View>
          <View style={styles.successStat}>
            <Text style={styles.successStatNum}>100%</Text>
            <Text style={styles.successStatLabel}>verified humans</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Back to my profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function BenefitRow({ icon, color, title, desc }: { icon: string; color: string; title: string; desc: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.benefitIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function ProcessRow({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <View style={styles.processRow}>
      {done ? (
        <Ionicons name="checkmark-circle" size={18} color={COLORS.LIKE} />
      ) : active ? (
        <ActivityIndicator size="small" color={COLORS.BRAND} />
      ) : (
        <View style={styles.processDot} />
      )}
      <Text style={[styles.processLabel, done && { color: COLORS.TEXT, fontWeight: '600' }]}>{label}</Text>
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
  shieldGlow: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: COLORS.BRAND, opacity: 0.18,
  },
  shieldInner: {
    width: 100, height: 100, borderRadius: 28, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },

  title: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, marginTop: 12, marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  titleDark: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 32, marginBottom: 8, textAlign: 'center' },
  titleSuccess: { fontSize: 28, fontWeight: '900', color: COLORS.BRAND, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 21, textAlign: 'center', paddingHorizontal: 16, marginBottom: 20 },
  subtitleDark: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 21, textAlign: 'center' },

  benefitList: { width: '100%', gap: 10, marginBottom: 18 },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.SURFACE, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  benefitIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  benefitTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, marginBottom: 2 },
  benefitDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, lineHeight: 16 },

  stepsBox: {
    width: '100%', backgroundColor: COLORS.BRAND_MUTED, padding: 16, borderRadius: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.BRAND,
  },
  stepsTitle: { fontSize: 12, fontWeight: '800', color: COLORS.BRAND, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  stepText: { fontSize: 13, color: COLORS.TEXT, fontWeight: '500' },

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
  corner: {
    position: 'absolute', width: 24, height: 24, borderColor: COLORS.BRAND, borderRadius: 4,
  },
  cornerTL: { top: 12, left: 12, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 4, borderRightWidth: 4 },

  livenessIcon: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  stepPills: { flexDirection: 'row', gap: 12, marginTop: 20 },
  stepPill: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE,
    borderWidth: 2, borderColor: COLORS.BORDER, justifyContent: 'center', alignItems: 'center',
  },
  stepPillActive: { backgroundColor: COLORS.BRAND, borderColor: COLORS.BRAND },
  stepPillDone: { backgroundColor: COLORS.LIKE, borderColor: COLORS.LIKE },
  stepPillText: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT_MUTED },

  processingWrap: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginVertical: 16,
  },
  processSteps: { width: '100%', gap: 10, marginTop: 12 },
  processRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.SURFACE, padding: 12, borderRadius: 12,
  },
  processDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.BORDER },
  processLabel: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },

  successHero: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  successGlow: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: COLORS.LIKE, opacity: 0.2,
  },
  successInner: {
    width: 110, height: 110, borderRadius: 32, backgroundColor: COLORS.LIKE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.LIKE, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  successStats: {
    flexDirection: 'row', gap: 10, width: '100%', marginTop: 12,
  },
  successStat: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.SURFACE,
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  successStatNum: { fontSize: 22, fontWeight: '900', color: COLORS.BRAND, marginBottom: 4 },
  successStatLabel: { fontSize: 11, color: COLORS.TEXT_MUTED, textAlign: 'center', fontWeight: '600' },
});
