import React, { useState } from 'react';
import {
  StyleSheet, View, Text, Image, SafeAreaView, ScrollView,
  Alert, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';

const MEMBER = {
  id: '1', name: 'James', age: 29, city: 'Manhattan',
  bio: 'Creative director who believes the best conversations happen over good food. I enjoy discovering hidden restaurants, weekend gallery hops, and the occasional trail when weather cooperates.',
  photoUrl: 'https://i.pravatar.cc/400?img=11',
  interests: ['Cooking', 'Art', 'Travel', 'Music', 'Photography'],
  job: 'Creative Director', verified: true, score: 92,
  intention: 'Relationship', drinking: 'Socially', smoking: 'No',
  languages: ['English', 'French'],
};

export default function MemberDetailScreen() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const m = MEMBER;

  const handleSend = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSent(true);
    setLoading(false);
    Alert.alert('Interest Sent', `${m.name} will be notified.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={18} color={COLORS.TEXT} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Photo */}
        <View style={styles.photoWrap}>
          <Image source={{ uri: m.photoUrl }} style={styles.photo} />
          <View style={styles.photoGrad} />
          <View style={styles.photoBadges}>
            {m.verified && (
              <View style={styles.vBadge}><Ionicons name="shield-checkmark" size={11} color="#fff" /><Text style={styles.vText}>Verified</Text></View>
            )}
            <View style={styles.sBadge}>
              <Text style={styles.sVal}>{m.score}</Text><Text style={styles.sLbl}>Score</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{m.name}, {m.age}</Text>
            <View style={styles.intPill}><Text style={styles.intText}>{m.intention}</Text></View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.TEXT_MUTED} />
            <Text style={styles.metaText}>{m.city}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="briefcase-outline" size={13} color={COLORS.TEXT_MUTED} />
            <Text style={styles.metaText}>{m.job}</Text>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.card}>
          <Text style={styles.cardLbl}>About</Text>
          <Text style={styles.bioText}>{m.bio}</Text>
        </View>

        {/* Interests */}
        <View style={styles.card}>
          <Text style={styles.cardLbl}>Interests</Text>
          <View style={styles.tagRow}>
            {m.interests.map((t) => (
              <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
            ))}
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardLbl}>Details</Text>
          {[
            { icon: 'wine-outline', l: 'Drinking', v: m.drinking },
            { icon: 'close-circle-outline', l: 'Smoking', v: m.smoking },
            { icon: 'chatbubble-outline', l: 'Languages', v: m.languages.join(', ') },
          ].map((r) => (
            <View key={r.l} style={styles.detailRow}>
              <View style={styles.detailIcon}><Ionicons name={r.icon as any} size={14} color={COLORS.PRIMARY} /></View>
              <Text style={styles.detailLabel}>{r.l}</Text>
              <Text style={styles.detailVal}>{r.v}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Button title={sent ? 'Interest Sent' : 'Send Interest'} onPress={handleSend} loading={loading} disabled={sent} size="lg" style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  backBtn: {
    position: 'absolute', top: 52, left: 16, zIndex: 10,
    width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  photoWrap: { width: '100%', height: 400, position: 'relative' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(10,8,20,.35)' },
  photoBadges: { position: 'absolute', bottom: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  vBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(74,139,110,.85)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  vText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  sBadge: { alignItems: 'center', backgroundColor: 'rgba(44,44,58,.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sVal: { fontSize: 15, fontWeight: '900', color: '#fff', lineHeight: 17 },
  sLbl: { fontSize: 9, color: 'rgba(255,255,255,.75)', letterSpacing: 0.5 },

  info: { paddingHorizontal: 18, paddingVertical: 14, backgroundColor: COLORS.SURFACE, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 24, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5 },
  intPill: { backgroundColor: COLORS.PRIMARY_MUTED, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  intText: { fontSize: 11, fontWeight: '700', color: COLORS.PRIMARY },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: COLORS.TEXT_MUTED },
  metaDot: { color: COLORS.BORDER, fontSize: 12 },

  card: {
    marginHorizontal: 14, marginTop: 10, padding: 16, backgroundColor: COLORS.SURFACE, borderRadius: 16,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardLbl: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  bioText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: COLORS.PRIMARY_MUTED, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '600', color: COLORS.PRIMARY },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  detailIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.PRIMARY_MUTED, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  detailLabel: { flex: 1, fontSize: 13, color: COLORS.TEXT_SECONDARY },
  detailVal: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, paddingBottom: 24,
    backgroundColor: COLORS.SURFACE, borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT, flexDirection: 'row',
  },
});
