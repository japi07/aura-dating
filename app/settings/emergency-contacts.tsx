import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useSettingsStore } from '@/store/settings';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { safety, hydrate, isHydrated, addEmergencyContact, removeEmergencyContact } = useSettingsStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => { if (!isHydrated) hydrate(); }, []);

  const contacts = safety.emergencyContacts;

  const add = async () => {
    const n = name.trim();
    const p = phone.trim();
    if (!n) { Alert.alert('Name needed', 'Please enter a name for this contact.'); return; }
    if (p.replace(/[^0-9]/g, '').length < 7) { Alert.alert('Check the number', 'Please enter a valid phone number.'); return; }
    await addEmergencyContact(n, p);
    setName('');
    setPhone('');
  };

  const remove = (id: string, n: string) => {
    Alert.alert(`Remove ${n}?`, 'They will no longer be alerted if you trigger SOS.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeEmergencyContact(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings/safety'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Emergency contacts</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Trusted people who'll be alerted with your location if you trigger SOS during a date. They're stored only on your phone.
          </Text>

          {/* Existing contacts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your contacts ({contacts.length})</Text>
            {contacts.length === 0 ? (
              <View style={[styles.card, { padding: 22, alignItems: 'center' }]}>
                <Ionicons name="people-outline" size={28} color={COLORS.TEXT_MUTED} />
                <Text style={styles.emptyText}>No contacts yet. Add one below.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {contacts.map((c, i) => (
                  <View key={c.id} style={[styles.contactRow, i < contacts.length - 1 && styles.rowBorder]}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      <Text style={styles.contactPhone}>{c.phone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => remove(c.id, c.name)} style={styles.removeBtn}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.ERROR} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Add form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add a contact</Text>
            <View style={styles.card}>
              <View style={styles.field}>
                <Ionicons name="person-outline" size={18} color={COLORS.TEXT_MUTED} />
                <TextInput
                  style={styles.input}
                  placeholder="Name (e.g. Mum, Sarah)"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={[styles.field, styles.rowBorderTop]}>
                <Ionicons name="call-outline" size={18} color={COLORS.TEXT_MUTED} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={add} activeOpacity={0.85}>
              <Ionicons name="person-add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Add contact</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },

  intro: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 19, paddingHorizontal: 24, marginTop: 4 },

  section: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 8 },
  card: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  emptyText: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 8 },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800', color: COLORS.BRAND },
  contactName: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  contactPhone: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 2 },
  removeBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.ERROR_LIGHT, justifyContent: 'center', alignItems: 'center' },

  field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  rowBorderTop: { borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT },
  input: { flex: 1, fontSize: 15, color: COLORS.TEXT, fontWeight: '500' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 14, paddingVertical: 14, marginHorizontal: 16, marginTop: 12,
  },
  addBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
