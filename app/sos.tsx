import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar, Alert, Linking, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useSettingsStore } from '@/store/settings';
import { getCurrentLocation } from '@/lib/location';

// UK emergency number. 112 also works across Europe.
const EMERGENCY_NUMBER = '999';

export default function SosScreen() {
  const router = useRouter();
  const { safety, hydrate, isHydrated } = useSettingsStore();
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    if (!isHydrated) hydrate();
    getCurrentLocation({ silent: true })
      .then(({ lat, lng }) => setLoc({ lat, lng }))
      .catch(() => {})
      .finally(() => setLocating(false));
  }, []);

  const contacts = safety.emergencyContacts;
  const mapsLink = loc ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : null;

  const call999 = () => {
    Alert.alert(
      `Call ${EMERGENCY_NUMBER}?`,
      'This will call the emergency services now. Only use this in a genuine emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Call ${EMERGENCY_NUMBER}`,
          style: 'destructive',
          onPress: () => Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() =>
            Alert.alert('Could not start call', `Please dial ${EMERGENCY_NUMBER} manually.`),
          ),
        },
      ],
    );
  };

  const alertContacts = () => {
    if (contacts.length === 0) {
      Alert.alert(
        'No contacts yet',
        'Add a trusted contact first so we know who to alert.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add contact', onPress: () => router.replace('/settings/emergency-contacts') },
        ],
      );
      return;
    }
    const numbers = contacts.map(c => c.phone).join(',');
    const locationLine = mapsLink ? ` My current location: ${mapsLink}` : ' (location unavailable)';
    const body = `I need help. I'm on a date and feel unsafe.${locationLine} — sent via Aura`;
    // iOS and Android differ on the body separator in the sms: URL scheme
    const sep = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${numbers}${sep}body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open Messages', 'Please text your contact manually.'),
    );
  };

  const shareLocationOnly = () => {
    if (!mapsLink) {
      Alert.alert('Location unavailable', 'We couldn\'t get your location. Check location permissions in Settings.');
      return;
    }
    const sep = Platform.OS === 'ios' ? '&' : '?';
    const body = `Sharing my live location with you: ${mapsLink} — sent via Aura`;
    const numbers = contacts.map(c => c.phone).join(',');
    const url = `sms:${numbers}${sep}body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => Alert.alert('Could not open Messages', 'Please share your location manually.'));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.heroIcon}>
          <Ionicons name="warning" size={44} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>Need help now?</Text>
        <Text style={styles.heroSub}>
          You're in control. Call emergency services or quietly alert your trusted contacts with your location.
        </Text>

        {/* Location status */}
        <View style={styles.locPill}>
          {locating ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.locText}>Getting your location…</Text>
            </>
          ) : mapsLink ? (
            <>
              <Ionicons name="location" size={14} color="#fff" />
              <Text style={styles.locText}>Location ready to share</Text>
            </>
          ) : (
            <>
              <Ionicons name="location-outline" size={14} color="#fff" />
              <Text style={styles.locText}>Location unavailable</Text>
            </>
          )}
        </View>

        {/* Primary: call 999 */}
        <TouchableOpacity style={styles.callBtn} onPress={call999} activeOpacity={0.9}>
          <Ionicons name="call" size={24} color={COLORS.ERROR} />
          <View>
            <Text style={styles.callTitle}>Call {EMERGENCY_NUMBER}</Text>
            <Text style={styles.callSub}>Emergency services</Text>
          </View>
        </TouchableOpacity>

        {/* Alert contacts */}
        <TouchableOpacity style={styles.actionBtn} onPress={alertContacts} activeOpacity={0.85}>
          <Ionicons name="people" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Alert my trusted contacts</Text>
            <Text style={styles.actionSub}>
              {contacts.length > 0
                ? `Text ${contacts.length} contact${contacts.length > 1 ? 's' : ''} with your location`
                : 'Add a contact to enable this'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Share location only */}
        <TouchableOpacity style={styles.actionBtnGhost} onPress={shareLocationOnly} activeOpacity={0.85}>
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={styles.actionGhostText}>Share my location with a friend</Text>
        </TouchableOpacity>

        {/* Manage contacts */}
        <TouchableOpacity style={styles.manageRow} onPress={() => router.push('/settings/emergency-contacts')}>
          <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.85)" />
          <Text style={styles.manageText}>Manage emergency contacts</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Aura can't contact emergency services for you automatically. These buttons open your phone's dialer and Messages so you stay in control.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ERROR },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  body: { paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center' },
  heroIcon: {
    width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 18,
  },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 21, marginBottom: 18, paddingHorizontal: 8 },

  locPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 24,
  },
  locText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 22,
    width: '100%', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 8,
  },
  callTitle: { fontSize: 20, fontWeight: '900', color: COLORS.ERROR },
  callSub: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '600', marginTop: 1 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 18, padding: 18, width: '100%', marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  actionTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  actionSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  actionBtnGhost: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 18, paddingVertical: 15, width: '100%', marginBottom: 24,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  actionGhostText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 16 },
  manageText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', textDecorationLine: 'underline' },

  disclaimer: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
});
