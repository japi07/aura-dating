import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/colors';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'accent';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  default: { bg: COLORS.PRIMARY_MUTED, text: COLORS.PRIMARY },
  success: { bg: COLORS.SUCCESS_LIGHT, text: COLORS.SUCCESS },
  error: { bg: COLORS.ERROR_LIGHT, text: COLORS.ERROR },
  warning: { bg: COLORS.WARNING_LIGHT, text: COLORS.WARNING },
  info: { bg: COLORS.INFO_LIGHT, text: COLORS.INFO },
  accent: { bg: COLORS.ACCENT_MUTED, text: COLORS.PRIMARY },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  style,
}) => {
  const colors = BADGE_STYLES[variant];
  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.sm,
        { backgroundColor: colors.bg },
        style,
      ]}
    >
      <Text style={[styles.text, size === 'sm' && styles.textSm, { color: colors.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sm: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  textSm: {
    fontSize: 11,
  },
});
