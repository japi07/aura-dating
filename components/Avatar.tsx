import React from 'react';
import { StyleSheet, View, Image, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface AvatarProps {
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  ring?: boolean;
}

const SIZES = {
  sm: 40,
  md: 56,
  lg: 88,
  xl: 120,
};

const ICON_SIZES = { sm: 18, md: 24, lg: 38, xl: 50 };

export const Avatar: React.FC<AvatarProps> = ({
  photoUrl,
  size = 'md',
  style,
  ring = false,
}) => {
  const dim = SIZES[size];
  const radius = dim / 2;

  return (
    <View
      style={[
        ring && {
          padding: 3,
          borderRadius: radius + 5,
          borderWidth: 2,
          borderColor: COLORS.ACCENT,
        },
        style,
      ]}
    >
      <View style={[styles.avatar, { width: dim, height: dim, borderRadius: radius }]}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: dim, height: dim, borderRadius: radius }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: dim, height: dim, borderRadius: radius },
            ]}
          >
            <Ionicons name="person" size={ICON_SIZES[size]} color={COLORS.PRIMARY_LIGHT} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: COLORS.PRIMARY_MUTED,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
