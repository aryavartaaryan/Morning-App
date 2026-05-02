import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { Colors, Font } from '@/constants/theme';

interface TypographyProps {
  children: React.ReactNode;
  style?: TextStyle;
  color?: string;
  numberOfLines?: number;
}

export const Heading = ({ children, style, color }: TypographyProps) => (
  <Text style={[styles.heading, color ? { color } : null, style]}>{children}</Text>
);

export const Title = ({ children, style, color }: TypographyProps) => (
  <Text style={[styles.title, color ? { color } : null, style]}>{children}</Text>
);

export const Body = ({ children, style, color, numberOfLines }: TypographyProps) => (
  <Text numberOfLines={numberOfLines} style={[styles.body, color ? { color } : null, style]}>{children}</Text>
);

export const Caption = ({ children, style, color }: TypographyProps) => (
  <Text style={[styles.caption, color ? { color } : null, style]}>{children}</Text>
);

export const Label = ({ children, style, color }: TypographyProps) => (
  <Text style={[styles.label, color ? { color } : null, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  heading: { fontSize: Font.sizes.xxl, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  title:   { fontSize: Font.sizes.lg,  fontWeight: '700', color: Colors.text },
  body:    { fontSize: Font.sizes.base, fontWeight: '400', color: Colors.textSub, lineHeight: 22 },
  caption: { fontSize: Font.sizes.sm,  fontWeight: '400', color: Colors.textMuted, lineHeight: 18 },
  label:   { fontSize: Font.sizes.xs,  fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
});
