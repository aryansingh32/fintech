/**
 * SPTC Finance Business design tokens - "Ink & Lime": bold monochrome
 * surfaces (near-black cards/icon tiles, white ground) with a single lime
 * accent for calls-to-action and emphasis, matching the reference fintech
 * UI. Kept as plain objects (no styling library) so the app can style with
 * StyleSheet.create everywhere.
 */
export const colors = {
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F0F3',
  border: '#EBEBEF',
  divider: '#EFEFF2',

  textPrimary: '#111114',
  textSecondary: '#93939C',
  textInverse: '#FFFFFF',
  textInverseSecondary: 'rgba(255,255,255,0.6)',

  ink: '#0B0B0C',
  inkSoft: '#1C1C1F',

  accent: '#D7FF3E',
  accentPressed: '#C2EA26',
  accentText: '#12140A',
  accentSoft: '#F3FBD6',

  brand: '#0B0B0C',
  brandDark: '#000000',
  brandSoft: '#F0F0F3',

  statusPaid: '#1CA958',
  statusPaidSoft: '#E4F8ED',
  statusUpcoming: '#3D7BFF',
  statusUpcomingSoft: '#EAF1FF',
  statusDue: '#C17F00',
  statusDueSoft: '#FBF1DA',
  statusOverdue: '#E0333F',
  statusOverdueSoft: '#FCE7E9',
  statusPending: '#8A5CF6',
  statusPendingSoft: '#F1EBFE',
  statusSuccess: '#1CA958',
  statusFailed: '#E0333F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 28,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0B0B0C',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#0B0B0C',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

const fontFamily = {
  regular: 'Manrope_500Medium',
  medium: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;

export const typography = {
  display: { fontSize: 34, fontFamily: fontFamily.extraBold, letterSpacing: -0.5 },
  h1: { fontSize: 26, fontFamily: fontFamily.extraBold, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontFamily: fontFamily.bold },
  body: { fontSize: 15, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 15, fontFamily: fontFamily.bold },
  caption: { fontSize: 13, fontFamily: fontFamily.regular },
  captionStrong: { fontSize: 13, fontFamily: fontFamily.bold },
  numeric: { fontSize: 40, fontFamily: fontFamily.extraBold, letterSpacing: -1 },
  button: { fontSize: 16, fontFamily: fontFamily.bold },
};
