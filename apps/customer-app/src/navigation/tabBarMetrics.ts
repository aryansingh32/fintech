import { spacing } from '@/theme/theme';

/**
 * Shared with any screen that needs to keep content (a FAB, a scroll
 * view's bottom padding) clear of the floating tab bar - kept in its own
 * module rather than exported from MainTabsNavigator.tsx so those screens
 * don't have to import the navigator itself (that created a require cycle:
 * MainTabsNavigator -> SupportListScreen -> MainTabsNavigator, which left
 * TAB_BAR_CLEARANCE undefined at SupportListScreen's module-init time).
 */
export const BAR_HEIGHT = 72;
export const TAB_BAR_CLEARANCE = BAR_HEIGHT + spacing.xl;
