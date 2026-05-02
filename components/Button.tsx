import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
}) => {
  const isDisabled = disabled || loading;

  const bgColors: Record<string, string> = {
    primary: COLORS.PRIMARY,
    secondary: 'transparent',
    danger: COLORS.ERROR,
    ghost: 'transparent',
  };

  const textColors: Record<string, string> = {
    primary: COLORS.TEXT_INVERSE,
    secondary: COLORS.PRIMARY,
    danger: COLORS.TEXT_INVERSE,
    ghost: COLORS.PRIMARY,
  };

  const paddings: Record<string, ViewStyle> = {
    sm: { paddingVertical: 10, paddingHorizontal: 20 },
    md: { paddingVertical: 14, paddingHorizontal: 28 },
    lg: { paddingVertical: 16, paddingHorizontal: 36 },
  };

  const fontSizes: Record<string, number> = { sm: 13, md: 14, lg: 15 };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: isDisabled ? COLORS.BORDER : bgColors[variant] },
        variant === 'secondary' && styles.secondary,
        paddings[size],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Ionicons
              name={icon as any}
              size={fontSizes[size] + 2}
              color={isDisabled ? COLORS.TEXT_MUTED : textColors[variant]}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: isDisabled ? COLORS.TEXT_MUTED : textColors[variant],
                fontSize: fontSizes[size],
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondary: {
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY_LIGHT,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.4,
  },
});
