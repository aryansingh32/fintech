/**
 * SPTC Finance design tokens - "Liquid Glass": frosted translucent surfaces
 * over a near-white backdrop, in the spirit of iOS's glass material. Fully
 * black-and-white/monochrome (no hue) so the app reads as a clean native
 * iOS surface; the Business app keeps its own lime/ink system so the two
 * apps are still unmistakable at a glance via typography/layout instead of
 * color. Kept as plain objects (no styling library) so the app can style
 * with StyleSheet.create everywhere.
 */
export const colors = {
  background: '#FAFAFA',
  surface: 'rgba(255,255,255,0.65)',
  surfaceSolid: '#FFFFFF',
  surfaceMuted: 'rgba(0,0,0,0.04)',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.12)',
  divider: 'rgba(17,17,20,0.08)',

  textPrimary: '#111114',
  textSecondary: '#6E6E76',
  textInverse: '#FFFFFF',
  textInverseSecondary: 'rgba(255,255,255,0.72)',

  ink: '#111114',

  accentStart: '#2A2A30',
  accentEnd: '#000000',
  accent: '#111114',
  accentPressed: '#000000',
  accentText: '#FFFFFF',
  accentSoft: 'rgba(17,17,20,0.06)',

  blobBlue: 'rgba(0,0,0,0.035)',
  blobViolet: 'rgba(0,0,0,0.025)',
  blobMint: 'rgba(0,0,0,0.02)',

  brand: '#111114',
  brandDark: '#000000',
  brandSoft: 'rgba(17,17,20,0.06)',

  statusPaid: '#1CA958',
  statusPaidSoft: 'rgba(28,169,88,0.12)',
  statusUpcoming: '#3D7BFF',
  statusUpcomingSoft: 'rgba(61,123,255,0.12)',
  statusDue: '#C17F00',
  statusDueSoft: 'rgba(193,127,0,0.12)',
  statusOverdue: '#E0333F',
  statusOverdueSoft: 'rgba(224,51,63,0.12)',
  statusPending: '#8A5CF6',
  statusPendingSoft: 'rgba(138,92,246,0.12)',
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
  sm: 12,
  md: 18,
  lg: 28,
  xl: 32,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
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
  h1: { fontSize: 26, fontFamily: fontFamily.bold, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontFamily: fontFamily.bold },
  body: { fontSize: 15, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 15, fontFamily: fontFamily.bold },
  caption: { fontSize: 13, fontFamily: fontFamily.regular },
  captionStrong: { fontSize: 13, fontFamily: fontFamily.bold },
  numeric: { fontSize: 40, fontFamily: fontFamily.extraBold, letterSpacing: -1 },
  button: { fontSize: 16, fontFamily: fontFamily.bold },
};
