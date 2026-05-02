import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/colors';

interface InterestTagProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const InterestTag: React.FC<InterestTagProps> = ({
  label,
  selected = false,
  onPress,
  style,
}) => (
  <TouchableOpacity
    style={[styles.tag, selected && styles.selected, style]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    marginRight: 8,
    marginBottom: 8,
  },
  selected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
  textSelected: {
    color: COLORS.TEXT_INVERSE,
  },
});
