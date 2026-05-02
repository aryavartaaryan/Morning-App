import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors, Radius, Font } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', loading, disabled, style, textStyle, icon }: ButtonProps) {
  const bg = variant === 'primary' ? Colors.gold
    : variant === 'secondary' ? Colors.card
    : variant === 'danger' ? Colors.error
    : Colors.transparent;

  const textColor = variant === 'primary' ? '#0A0A0F'
    : variant === 'ghost' ? Colors.gold
    : Colors.text;

  const paddingV = size === 'sm' ? 8 : size === 'lg' ? 18 : 13;
  const fontSize = size === 'sm' ? Font.sizes.sm : size === 'lg' ? Font.sizes.md : Font.sizes.base;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btn,
        { backgroundColor: bg, paddingVertical: paddingV, opacity: disabled ? 0.45 : 1 },
        variant === 'ghost' && styles.ghost,
        variant === 'secondary' && styles.secondary,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[styles.label, { color: textColor, fontSize }, textStyle]}>
            {icon ? `${icon}  ` : ''}{label}
          </Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ghost: {
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  secondary: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
