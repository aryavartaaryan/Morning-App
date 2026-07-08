// ─────────────────────────────────────────────────────────────────────────────
// cardTheme.ts — Deep Navy Tinted Glass Design System
//
// Single control centre for card appearance across ALL pages.
// To change the look site-wide: edit the CT tokens below.
// ─────────────────────────────────────────────────────────────────────────────
import { ViewStyle } from 'react-native';

// ── Core design tokens ────────────────────────────────────────────────────────
export const CT = {
  // Card background — deep navy at 85% opacity
  // Background image shows through softly while text stays crisp
  bg:       'rgba(6,15,40,0.50)',
  bgLight:  'rgba(6,15,40,0.32)',   // Secondary / inner cards
  bgStrong: 'rgba(6,15,40,0.62)',   // Modals, bottom sheets, overlapping panels

  // Borders
  border:   'rgba(255,255,255,0.22)',
  borderSm: 'rgba(255,255,255,0.14)',

  // Top-edge 1px highlight (gives depth on any bg)
  topHighlight: 'rgba(255,255,255,0.22)',

  // LinearGradient overlay colours — use with expo-linear-gradient
  // start={x:0,y:0} end={x:1,y:1}
  gradient: [
    'rgba(255,255,255,0.10)',
    'rgba(255,255,255,0.03)',
    'transparent',
  ] as const,

  // Divider line between rows inside a card
  divider: 'rgba(255,255,255,0.08)',

  // Border radius
  radius:   18,
  radiusSm: 12,

  // Text hierarchy
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.70)',
  textMuted:     'rgba(255,255,255,0.42)',
  textFaint:     'rgba(255,255,255,0.22)',
} as const;

// ── Shadow preset ─────────────────────────────────────────────────────────────
export const CARD_SHADOW: ViewStyle = {
  shadowColor:   '#000000',
  shadowOffset:  { width: 0, height: 8 },
  shadowOpacity: 0.38,
  shadowRadius:  20,
  elevation:     12,
};

// ── Dynamic card bg — adapts opacity to background brightness ─────────────────
// Night/dark images (brahma, predawn, twilight, evening, night) → transparent 0.36
// Golden transition (sunrise, sandhya) → medium 0.44
// Bright daytime (morning, midday, afternoon) → most opaque 0.50
const DARK_BG_KEYS  = ['night', 'night_early', 'night_early_mid1', 'night_early_mid2', 'brahma', 'predawn', 'predawn_mid1', 'predawn_mid2', 'predawn_late', 'twilight', 'twilight_late', 'twilight_deep', 'evening'];
const GOLDEN_BG_KEYS = ['sunrise', 'sandhya', 'sandhya_late', 'sandhya_late_2'];

export function getCardBg(bgKey: string): string {
  if (DARK_BG_KEYS.includes(bgKey))   return 'rgba(6,15,40,0.36)';
  if (GOLDEN_BG_KEYS.includes(bgKey)) return 'rgba(6,15,40,0.44)';
  return 'rgba(6,15,40,0.50)';
}

export function getCardBgLight(bgKey: string): string {
  if (DARK_BG_KEYS.includes(bgKey))   return 'rgba(6,15,40,0.24)';
  if (GOLDEN_BG_KEYS.includes(bgKey)) return 'rgba(6,15,40,0.32)';
  return 'rgba(6,15,40,0.38)';
}

// ── Base glass card ───────────────────────────────────────────────────────────
// Drop this on any View to get the full Deep Navy Tinted Glass look
export const GLASS_CARD: ViewStyle = {
  backgroundColor: CT.bg,
  borderRadius:    CT.radius,
  borderWidth:     1,
  borderColor:     CT.border,
  overflow:        'hidden',
  ...CARD_SHADOW,
};

// ── Small glass card ──────────────────────────────────────────────────────────
export const GLASS_CARD_SM: ViewStyle = {
  ...GLASS_CARD,
  borderRadius: CT.radiusSm,
};

// ── Accent glass card — coloured border glow ──────────────────────────────────
// Pass the accent hex colour; a semi-transparent version becomes the border.
export function glassCardAccent(accentHex: string): ViewStyle {
  return {
    ...GLASS_CARD,
    borderColor: accentHex + '55',
  };
}

// ── Inner / secondary card (sits inside a GLASS_CARD) ────────────────────────
export const GLASS_CARD_INNER: ViewStyle = {
  backgroundColor: CT.bgLight,
  borderRadius:    CT.radiusSm,
  borderWidth:     1,
  borderColor:     CT.borderSm,
  overflow:        'hidden',
};

// ── Modal / bottom-sheet panel ────────────────────────────────────────────────
export const GLASS_SHEET: ViewStyle = {
  backgroundColor:    CT.bgStrong,
  borderTopLeftRadius:  28,
  borderTopRightRadius: 28,
  borderTopWidth:       1,
  borderColor:          CT.border,
};
