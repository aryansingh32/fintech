/**
 * SPTC Finance design tokens - modern consumer-fintech look (blueprint #45):
 * deep indigo brand, generous spacing, status color communicates state and
 * nothing else (never decorative). Kept as plain objects (no styling
 * library) so both apps share the exact same values without a dependency.
 */
export const colors = {
  background: '#F7F8FC',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F8',
  border: '#E3E7F1',
  textPrimary: '#101322',
  textSecondary: '#5B6178',
  textInverse: '#FFFFFF',

  brand: '#2C3FE0',
  brandDark: '#1B2A9E',
  brandSoft: '#E9EBFC',

  statusPaid: '#12A454',
  statusPaidSoft: '#E4F8ED',
  statusUpcoming: '#2C6BE0',
  statusUpcomingSoft: '#E9F1FD',
  statusDue: '#B8860B',
  statusDueSoft: '#FBF1DA',
  statusOverdue: '#D62839',
  statusOverdueSoft: '#FCE7E9',
  statusPending: '#8A5CF6',
  statusPendingSoft: '#F1EBFE',
  statusSuccess: '#12A454',
  statusFailed: '#D62839',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const },
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  captionStrong: { fontSize: 13, fontWeight: '600' as const },
};
