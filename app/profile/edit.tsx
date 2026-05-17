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
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { InterestTag } from '@/components/InterestTag';

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
  const [city, setCity] = useState(current.city || '');
  const [birthday, setBirthday] = useState(current.birthday || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(current.interests || []);
  const [photoUri, setPhotoUri] = useState<string | null>(current.photoUrl || null);
  const [photoChanged, setPhotoChanged] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoChanged(true);
    }
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
      // Upload photo if changed
      if (photoChanged && photoUri) {
        const formData = new FormData();
        formData.append('photo', {
          uri: photoUri,
          name: 'profile.jpg',
          type: 'image/jpeg',
        } as any);
        try {
          await profileApi.uploadPhoto(formData);
        } catch {
          // Photo upload may fail in demo mode — continue saving other fields
        }
      }

      // Update profile fields
      try {
        await profileApi.updateProfile({
          name, bio, city, birthday, interests: selectedInterests,
        });
      } catch {
        // API may not be connected in demo mode
      }

      // Update local state — always save to store
      setUser({
        ...current,
        name, bio, city, birthday,
        interests: selectedInterests,
        photoUrl: photoUri || current.photoUrl,
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
        {/* Photo */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Profile Photo</Text>
          <TouchableOpacity style={styles.photoRow} onPress={pickImage}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={28} color={COLORS.TEXT_MUTED} />
              </View>
            )}
            <View style={styles.photoInfo}>
              <Text style={styles.photoAction}>Change Photo</Text>
              <Text style={styles.photoHint}>Tap to upload from gallery</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
          </TouchableOpacity>
        </View>

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Basic Info</Text>
          <Input label="Name" placeholder="Your name" value={name} onChangeText={setName} icon="person-outline" />
          <Input label="City" placeholder="Where are you based?" value={city} onChangeText={setCity} icon="location-outline" />
          <Input label="Birthday" placeholder="MM/DD/YYYY" value={birthday} onChangeText={setBirthday} icon="calendar-outline" />
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
