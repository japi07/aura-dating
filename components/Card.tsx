import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: boolean;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  shadow = true,
  variant = 'default',
}) => {
  return (
    <View
      style={[
        styles.card,
        variant === 'outlined' && styles.outlined,
        shadow && styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 16,
    overflow: 'hidden',
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  shadow: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
});
