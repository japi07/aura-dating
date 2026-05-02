/**
 * Aura palette — "Velvet"
 * Deep rose + champagne gold + aubergine + warm cream.
 * Elegant editorial feel, vibrant without being loud.
 */
export const COLORS = {
  // ── Brand: deep crimson rose ──────────────────
  BRAND: '#C8175E',          // Refined deep rose
  BRAND_DARK: '#8E0E40',     // Wine — for pressed/shadow states
  BRAND_LIGHT: '#E94B7B',    // Soft rose — gradient pair
  BRAND_GLOW: '#F8B7CB',     // Pale rose — chips & glows
  BRAND_MUTED: '#FBE8EE',    // Blush wash — backgrounds

  // ── Gold: warm champagne accent ───────────────
  GOLD: '#C99A4E',           // Champagne (was bright #FFCF40)
  GOLD_DEEP: '#9B7434',      // Antique gold
  GOLD_LIGHT: '#E6CB95',     // Soft champagne
  GOLD_MUTED: '#FBF5EA',     // Cream wash

  // ── Aubergine: secondary brand for premium ────
  PLUM: '#3D2A4E',           // Deep aubergine
  PLUM_LIGHT: '#5C4A5E',
  PLUM_MUTED: '#F2EAF2',

  // ── Action colors (Like / Pass / Super) ───────
  LIKE: '#3FA88A',           // Refined teal-green (was bright #25D997)
  LIKE_BG: '#E5F2EC',
  PASS: '#C8175E',
  PASS_BG: '#FBE8EE',
  SUPER: '#5B6FA8',          // Soft navy
  SUPER_BG: '#E8EBF4',

  // ── Backgrounds: warm cream ───────────────────
  BG: '#FBF6F2',             // Warm ivory (was cool #F6F6FA)
  BG_WARM: '#F7EDE3',        // Slightly more saturated
  BG_BLUSH: '#FDF2F0',       // Whisper-pink for hero areas
  SURFACE: '#FFFFFF',
  SURFACE_ELEVATED: '#FCF9F5',

  // ── Text: deep aubergine-black ────────────────
  TEXT: '#1F1428',           // Aubergine-black
  TEXT_SECONDARY: '#5C4A5E',
  TEXT_MUTED: '#9C8FA0',
  TEXT_INVERSE: '#FFFFFF',

  // ── Borders: warm muted ───────────────────────
  BORDER: '#EAE0E5',
  BORDER_LIGHT: '#F4ECEF',
  DIVIDER: '#EFE5E9',

  // ── Semantic ──────────────────────────────────
  ERROR: '#C8175E',
  ERROR_LIGHT: '#FBE8EE',
  SUCCESS: '#3FA88A',
  SUCCESS_LIGHT: '#E5F2EC',
  WARNING: '#C99A4E',
  WARNING_LIGHT: '#FBF5EA',
  INFO: '#5B6FA8',
  INFO_LIGHT: '#E8EBF4',

  // ── Specials ──────────────────────────────────
  OVERLAY: 'rgba(31,20,40,0.58)',
  SHADOW: 'rgba(31,20,40,0.08)',
  CARD_SHADOW: 'rgba(31,20,40,0.05)',

  // ── Legacy aliases (do not break old imports) ──
  PRIMARY: '#C8175E',
  PRIMARY_DARK: '#8E0E40',
  PRIMARY_LIGHT: '#E94B7B',
  PRIMARY_MUTED: '#FBE8EE',
  ACCENT: '#E94B7B',
  ACCENT_LIGHT: '#F8B7CB',
  ACCENT_MUTED: '#FBE8EE',
  TEAL: '#C8175E',
  TEAL_DARK: '#8E0E40',
  TEAL_LIGHT: '#E94B7B',
  CORAL: '#E94B7B',
  CORAL_LIGHT: '#F8B7CB',
} as const;

export default COLORS;
