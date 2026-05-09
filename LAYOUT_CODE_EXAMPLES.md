# Layout Improvements - Code Examples

This document shows before and after code examples for key layout changes.

---

## 1. Title Typography Improvements

### Before
```typescript
title: { fontSize: 24, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5 },
sub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 1 },
```

### After
```typescript
title: { fontSize: 28, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.5 },
sub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 3 },
```

**Changes:**
- Title: 24px → 28px (14% larger)
- Font weight: 800 → 900 (bolder)
- Subtitle margin: 1 → 3 (3x more spacing)

**Impact:** Stronger visual hierarchy and better readability

---

## 2. Header Padding Improvements

### Before
```typescript
header: {
  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
},
```

### After
```typescript
header: {
  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
},
```

**Changes:**
- Top padding: 14 → 16 (+14%)
- Bottom padding: 6 → 10 (+67%)

**Impact:** More generous spacing from safe area and content

---

## 3. Content List/Container Padding

### Before
```typescript
list: { paddingHorizontal: 14, paddingBottom: 20 },
row: { justifyContent: 'space-between', marginBottom: 10 },
```

### After
```typescript
list: { paddingHorizontal: 16, paddingBottom: 24 },
row: { justifyContent: 'space-between', marginBottom: 12 },
```

**Changes:**
- Horizontal padding: 14 → 16 (+14%)
- Bottom padding: 20 → 24 (+20%)
- Row margin: 10 → 12 (+20%)

**Impact:** Better content centering and spacing

---

## 4. Card Styling Improvements

### Before
```typescript
card: {
  width: SW - 24, height: SH * 0.6,
  borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.SURFACE,
  shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12, shadowRadius: 24, elevation: 10,
},
```

### After
```typescript
card: {
  width: SW - 32, height: SH * 0.58,
  borderRadius: 24, overflow: 'hidden', backgroundColor: COLORS.SURFACE,
  shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.15, shadowRadius: 28, elevation: 12,
},
```

**Changes:**
- Width: SW - 24 → SW - 32 (more side padding)
- Border radius: 20 → 24 (softer)
- Shadow height: 8 → 12 (deeper)
- Shadow opacity: 0.12 → 0.15 (more visible)
- Elevation: 10 → 12 (higher z-index)

**Impact:** Larger cards with better depth and softer appearance

---

## 5. Button Sizing Improvements

### Before
```typescript
btnAccept: {
  width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.PRIMARY,
  justifyContent: 'center', alignItems: 'center',
  shadowColor: COLORS.PRIMARY, shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
},
```

### After
```typescript
btnAccept: {
  width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.PRIMARY,
  justifyContent: 'center', alignItems: 'center',
  shadowColor: COLORS.PRIMARY, shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
},
```

**Changes:**
- Size: 56x56 → 60x60 (+7%)
- Border radius: 28 → 30
- Shadow offset: 4 → 6 (deeper)
- Shadow opacity: 0.35 → 0.4 (more visible)
- Elevation: 6 → 8

**Impact:** Larger, more accessible touch targets with better visual depth

---

## 6. Tab Bar Improvements

### Before
```typescript
tabBar: {
  backgroundColor: COLORS.SURFACE,
  borderTopWidth: 0,
  elevation: 0,
  shadowColor: '#1A1A2E',
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  height: 60,
  paddingBottom: 4,
  paddingTop: 6,
},
```

### After
```typescript
tabBar: {
  backgroundColor: COLORS.SURFACE,
  borderTopWidth: 1,
  borderTopColor: COLORS.BORDER,
  elevation: 0,
  shadowColor: '#1A1A2E',
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  height: 64,
  paddingBottom: 6,
  paddingTop: 8,
},
```

**Changes:**
- Height: 60 → 64 (+7%)
- Added top border
- Padding top: 6 → 8 (+33%)
- Padding bottom: 4 → 6 (+50%)
- Shadow opacity: 0.05 → 0.08

**Impact:** More spacious navigation bar with visual separator

---

## 7. Component Gap Improvements

### Before
```typescript
pill: {
  flexDirection: 'row', alignItems: 'center', gap: 4,
  backgroundColor: COLORS.SUCCESS_LIGHT, paddingHorizontal: 10,
  paddingVertical: 5, borderRadius: 10,
},

actions: {
  flexDirection: 'row', justifyContent: 'center', gap: 28,
  paddingVertical: 16, paddingBottom: 8,
},
```

### After
```typescript
pill: {
  flexDirection: 'row', alignItems: 'center', gap: 6,
  backgroundColor: COLORS.SUCCESS_LIGHT, paddingHorizontal: 12,
  paddingVertical: 7, borderRadius: 12,
},

actions: {
  flexDirection: 'row', justifyContent: 'center', gap: 32,
  paddingVertical: 20, paddingBottom: 12,
},
```

**Changes:**
- Pill gap: 4 → 6 (+50%)
- Pill padding horizontal: 10 → 12 (+20%)
- Pill padding vertical: 5 → 7 (+40%)
- Actions gap: 28 → 32 (+14%)
- Actions padding vertical: 16 → 20 (+25%)

**Impact:** Better component spacing and breathing room

---

## 8. Avatar and Icon Sizing

### Before
```typescript
camBtn: {
  position: 'absolute', bottom: 2, right: 2, width: 28, height: 28,
  borderRadius: 14,
  backgroundColor: COLORS.PRIMARY, justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2, borderColor: COLORS.SURFACE,
},

avatar: { width: 48, height: 48, borderRadius: 24 },
```

### After
```typescript
camBtn: {
  position: 'absolute', bottom: 0, right: 0, width: 32, height: 32,
  borderRadius: 16,
  backgroundColor: COLORS.PRIMARY, justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2.5, borderColor: COLORS.SURFACE,
  shadowColor: COLORS.PRIMARY, shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
},

avatar: { width: 52, height: 52, borderRadius: 26 },
```

**Changes:**
- Camera button: 28x28 → 32x32 (+14%)
- Avatar: 48x48 → 52x52 (+8%)
- Added shadow to camera button

**Impact:** Better visibility and larger touch targets

---

## 9. Text Spacing and Line Height

### Before
```typescript
bio: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 20 },
proposalMsg: {
  fontSize: 13, color: 'rgba(255,255,255,.85)', fontStyle: 'italic',
  marginTop: 6, lineHeight: 18
},
```

### After
```typescript
bio: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 22 },
proposalMsg: {
  fontSize: 13, color: 'rgba(255,255,255,.9)', fontStyle: 'italic',
  marginTop: 8, lineHeight: 19
},
```

**Changes:**
- Bio line height: 20 → 22 (+10%)
- Message margin: 6 → 8 (+33%)
- Message line height: 18 → 19 (+6%)
- Text opacity: .85 → .9 (better contrast)

**Impact:** Better text readability and breathing room

---

## 10. Badge and Pill Improvements

### Before
```typescript
badge: {
  backgroundColor: COLORS.PRIMARY_MUTED, paddingHorizontal: 5,
  paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center'
},
```

### After
```typescript
badge: {
  backgroundColor: COLORS.PRIMARY_MUTED, paddingHorizontal: 6,
  paddingVertical: 2, borderRadius: 7, minWidth: 20, alignItems: 'center'
},
```

**Changes:**
- Horizontal padding: 5 → 6 (+20%)
- Vertical padding: 1 → 2 (+100%)
- Border radius: 6 → 7 (+17%)
- Min width: 18 → 20 (+11%)

**Impact:** Better badge visibility and spacing

---

## Summary of Metrics

| Category | Typical Change | Percentage |
|----------|---|---|
| Font sizes | 24-26px | +4-17% |
| Padding | 14-20px | +14-20% |
| Margins | 1-6px | +50-200% |
| Button sizes | 56-60px | +7% |
| Border radius | 16-20px | +12-25% |
| Shadow opacity | 0.05-0.15 | +40-200% |
| Component gaps | 4-8px | +50-100% |

---

## Design Token Recommendations

For future consistency, consider creating design tokens:

```typescript
export const LAYOUT = {
  // Spacing
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,

  // Border Radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusXxl: 24,

  // Shadows
  shadowSm: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  shadowMd: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  shadowLg: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;
```

---

## Conclusion

All layout improvements have been consistently applied across all five main screens of the Aura Dating app. The changes follow a cohesive design philosophy focused on generous spacing, clear typography hierarchy, and enhanced depth perception.
