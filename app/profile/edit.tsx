import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { profileApi } from '@/lib/api';
import { updateMyProfile } from '@/lib/profile-supabase';
import { getSessionUserId } from '@/lib/proposals-supabase';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { InterestTag } from '@/components/InterestTag';
import { DateField } from '@/components/DateField';
import { CityField } from '@/components/CityField';

const ALL_INTERESTS = [
  'Travel', 'Music', 'Art', 'Cooking', 'Sports', 'Reading',
  'Fitness', 'Yoga', 'Meditation', 'Dancing', 'Photography', 'Volunteering',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  // Edit only makes sense if we have a logged-in user
  if (!user) {
    router.replace('/auth/login');
    return null;
  }

  const current = user;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(current.name);
  const [bio, setBio] = useState(current.bio || '');
  const [city] = useState('London');
  const [birthday, setBirthday] = useState(current.birthday || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(current.interests || []);
  const initialPhotos = current.photos?.length ? current.photos : (current.photoUrl ? [current.photoUrl] : []);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  const MAX_PHOTOS = 6;

  const addPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Maximum photos', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      const uris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const makePrimary = (index: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      const [pick] = next.splice(index, 1);
      return [pick, ...next];
    });
  };

  const toggle = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      let finalPhotos = photos;

      const signedIn = await getSessionUserId();
      if (signedIn) {
        // Save to Supabase: uploads + moderates any new photos and writes fields
        const res = await updateMyProfile({
          name, bio, city, birthday,
          interests: selectedInterests,
          photos,
        });
        if (res.photos) finalPhotos = res.photos;
      } else {
        // Offline / legacy demo mode — best-effort REST call, ignore failures
        try {
          await profileApi.updateProfile({
            name, bio, city, birthday, interests: selectedInterests,
          });
        } catch {
          // API may not be connected in demo mode
        }
      }

      // Update local state — always save to store
      setUser({
        ...current,
        name, bio, city, birthday,
        interests: selectedInterests,
        photos: finalPhotos,
        photoUrl: finalPhotos[0] || current.photoUrl,
      });

      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="close" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photos */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Photos</Text>
          <Text style={styles.photoHint}>Add up to 6. Tap a photo to make it your main one. Long-press hint: the first is shown everywhere.</Text>
          <View style={styles.photoGrid}>
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.photoTile}>
                <Image source={{ uri }} style={styles.photoTileImg} />
                {i === 0 ? (
                  <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Main</Text></View>
                ) : (
                  <TouchableOpacity style={styles.makePrimaryBtn} onPress={() => makePrimary(i)}>
                    <Ionicons name="star-outline" size={13} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(i)}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 6 && (
              <TouchableOpacity style={styles.addPhotoTile} onPress={addPhotos} activeOpacity={0.7}>
                <Ionicons name="add" size={30} color={COLORS.BRAND} />
                <Text style={styles.addPhotoText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Basic Info</Text>
          <Input label="Name" placeholder="Your name" value={name} onChangeText={setName} icon="person-outline" />
          <CityField label="City" />
          <DateField label="Birthday" value={birthday} onChange={setBirthday} mode="past" placeholder="Select your birthday" />
        </View>

        {/* Bio */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>About You</Text>
          <Input label="Bio" placeholder="Tell others what makes you unique..." value={bio} onChangeText={setBio} multiline numberOfLines={4} />
        </View>

        {/* Interests */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Interests</Text>
          <Text style={styles.hint}>Select the topics that define you</Text>
          <View style={styles.tagCloud}>
            {ALL_INTERESTS.map((interest) => (
              <InterestTag
                key={interest}
                label={interest}
                selected={selectedInterests.includes(interest)}
                onPress={() => toggle(interest)}
              />
            ))}
          </View>
        </View>

        {/* Save */}
        <Button title="Save Changes" onPress={handleSave} loading={loading} size="lg" style={{ width: '100%', marginTop: 4 }} />

        <View style={{ height: 30 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.BG,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.3 },
  content: { paddingHorizontal: 14, paddingVertical: 16, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  sectionLbl: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  hint: { fontSize: 12, color: COLORS.TEXT_MUTED, marginBottom: 10 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoTile: { width: 92, height: 116, borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: COLORS.BG },
  photoTileImg: { width: '100%', height: '100%' },
  primaryBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: COLORS.BRAND, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  primaryBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  makePrimaryBtn: { position: 'absolute', bottom: 6, left: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  removePhotoBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  addPhotoTile: {
    width: 92, height: 116, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.BRAND,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 2, backgroundColor: COLORS.BRAND_MUTED,
  },
  addPhotoText: { fontSize: 12, fontWeight: '700', color: COLORS.BRAND },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 22 },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: COLORS.PRIMARY_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  photoInfo: { flex: 1 },
  photoAction: { fontSize: 14, fontWeight: '700', color: COLORS.PRIMARY },
  photoHint: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },

  tagCloud: { flexDirection: 'row', flexWrap: 'wrap' },
});
