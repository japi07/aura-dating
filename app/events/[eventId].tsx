import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, SafeAreaView,
  Alert, TouchableOpacity, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';

const EVT = {
  id: '1', title: 'Wine Tasting Night', date: 'April 5, 2026', time: '7:00 PM',
  location: 'SoHo Wine Bar', address: '123 Spring St, New York, NY 10012',
  type: 'Social', emoji: '🍷',
  description: 'An intimate evening of curated wine tasting from Burgundy, Tuscany, and Napa Valley, paired with seasonal appetizers. Perfect for making meaningful connections in a relaxed, sophisticated setting.',
  spotsAvailable: 3, totalSpots: 12,
  organizer: { name: 'Alex', photoUrl: 'https://i.pravatar.cc/150?img=3' },
  attendees: [
    { name: 'Sarah', photoUrl: 'https://i.pravatar.cc/150?img=47' },
    { name: 'Emma', photoUrl: 'https://i.pravatar.cc/150?img=48' },
    { name: 'Jessica', photoUrl: 'https://i.pravatar.cc/150?img=49' },
  ],
};

export default function EventDetailScreen() {
  const router = useRouter();
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const fill = ((EVT.totalSpots - EVT.spotsAvailable) / EVT.totalSpots) * 100;

  const handleApply = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setApplied(true); setLoading(false);
    Alert.alert('You\'re in!', 'Your spot has been reserved.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="close" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.emojiBox}><Text style={styles.emojiLg}>{EVT.emoji}</Text></View>
          <View style={styles.typePill}><Text style={styles.typeText}>{EVT.type}</Text></View>
          <Text style={styles.eventTitle}>{EVT.title}</Text>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          {[
            { icon: 'calendar-outline', lbl: 'Date & Time', val: `${EVT.date} · ${EVT.time}` },
            { icon: 'location-outline', lbl: 'Venue', val: EVT.location, sub: EVT.address },
            { icon: 'people-outline', lbl: 'Spots', val: `${EVT.spotsAvailable} of ${EVT.totalSpots} remaining` },
          ].map((r, i) => (
            <View key={r.lbl} style={[styles.infoRow, i < 2 && styles.infoRowBorder]}>
              <View style={styles.infoIcon}><Ionicons name={r.icon as any} size={15} color={COLORS.PRIMARY} /></View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLbl}>{r.lbl}</Text>
                <Text style={styles.infoVal}>{r.val}</Text>
                {r.sub && <Text style={styles.infoSub}>{r.sub}</Text>}
                {r.lbl === 'Spots' && (
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${fill}%` }]} /></View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardLbl}>About</Text>
          <Text style={styles.desc}>{EVT.description}</Text>
        </View>

        {/* Organizer */}
        <View style={styles.card}>
          <Text style={styles.cardLbl}>Organised By</Text>
          <View style={styles.orgRow}>
            <Avatar photoUrl={EVT.organizer.photoUrl} size="md" ring />
            <View>
              <Text style={styles.orgName}>{EVT.organizer.name}</Text>
              <Text style={styles.orgRole}>Event Organizer</Text>
            </View>
          </View>
        </View>

        {/* Attendees */}
        <View style={styles.card}>
          <Text style={styles.cardLbl}>Going ({EVT.attendees.length})</Text>
          <View style={styles.attendees}>
            {EVT.attendees.map((a, i) => (
              <View key={i} style={[styles.attItem, { marginLeft: i > 0 ? -8 : 0 }]}>
                <Image source={{ uri: a.photoUrl }} style={styles.attAvatar} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Button
          title={applied ? 'Spot Reserved' : 'Reserve My Spot'}
          onPress={handleApply}
          loading={loading}
          disabled={applied}
          size="lg"
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  topBar: { paddingHorizontal: 14, paddingVertical: 10 },
  back: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  emojiBox: { width: 72, height: 72, borderRadius: 22, backgroundColor: COLORS.PRIMARY_MUTED, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emojiLg: { fontSize: 34 },
  typePill: { backgroundColor: COLORS.PRIMARY_MUTED, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  typeText: { fontSize: 11, fontWeight: '800', color: COLORS.PRIMARY, letterSpacing: 0.5 },
  eventTitle: { fontSize: 24, fontWeight: '800', color: COLORS.TEXT, textAlign: 'center', letterSpacing: -0.5 },

  infoCard: {
    marginHorizontal: 14, marginBottom: 10, backgroundColor: COLORS.SURFACE, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  infoRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.PRIMARY_MUTED, justifyContent: 'center', alignItems: 'center' },
  infoContent: { flex: 1 },
  infoLbl: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoVal: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  infoSub: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1 },
  barTrack: { marginTop: 6, height: 3, backgroundColor: COLORS.BORDER_LIGHT, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.PRIMARY_LIGHT, borderRadius: 2 },

  card: {
    marginHorizontal: 14, marginBottom: 10, padding: 16, backgroundColor: COLORS.SURFACE, borderRadius: 16,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardLbl: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  desc: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 22 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orgName: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  orgRole: { fontSize: 12, color: COLORS.TEXT_MUTED },
  attendees: { flexDirection: 'row', alignItems: 'center' },
  attItem: { borderWidth: 2, borderColor: COLORS.SURFACE, borderRadius: 18 },
  attAvatar: { width: 32, height: 32, borderRadius: 16 },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, paddingBottom: 24,
    backgroundColor: COLORS.SURFACE, borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT, flexDirection: 'row',
  },
});
