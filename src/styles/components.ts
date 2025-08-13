import { StyleSheet } from 'react-native'
import { theme } from './theme'

export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  
  scrollContainer: {
    flex: 1,
  },
  
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  
  contentContainer: {
    flexGrow: 1,
    ...theme.layout.screenPadding,
  },
  
  // Header styles
  header: {
    ...theme.layout.headerPadding,
  },
  
  headerWithSubtitle: {
    ...theme.layout.headerPadding,
    paddingBottom: theme.spacing.xl,
  },
  
  // Card styles
  card: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    ...theme.layout.cardPadding,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  cardElevated: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.large,
  },
  
  cardInteractive: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.large,
  },
  
  // Feature card styles
  featureCard: {
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderAccent,
  },
  
  // Role specific cards
  parentCard: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primary,
  },
  
  studentCard: {
    backgroundColor: theme.colors.secondaryDark,
    borderColor: theme.colors.secondary,
  },
  
  // Button styles
  button: {
    backgroundColor: theme.colors.buttonPrimary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  
  buttonSecondary: {
    backgroundColor: theme.colors.buttonSecondary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  
  buttonTextSecondary: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  
  // Link button
  linkButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  
  linkButtonText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  
  // Input styles
  input: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  
  inputFocused: {
    borderColor: theme.colors.primary,
  },
  
  // Text styles
  title: theme.typography.titleLarge,
  titleMedium: theme.typography.titleMedium,
  titleSmall: theme.typography.titleSmall,
  
  subtitle: theme.typography.subtitleMedium,
  subtitleLarge: theme.typography.subtitleLarge,
  subtitleSmall: theme.typography.subtitleSmall,
  
  body: theme.typography.bodyMedium,
  bodyLarge: theme.typography.bodyLarge,
  bodySmall: theme.typography.bodySmall,
  
  label: theme.typography.label,
  caption: theme.typography.caption,
  
  // Status badge
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  
  // Empty state
  emptyContainer: {
    padding: theme.spacing.huge,
    alignItems: 'center',
  },
  
  emptyEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  
  emptyTitle: {
    ...theme.typography.titleSmall,
    marginBottom: theme.spacing.sm,
  },
  
  emptyText: {
    ...theme.typography.bodyMedium,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  
  // Loading state
  loadingContainer: {
    padding: theme.spacing.huge,
    alignItems: 'center',
  },
  
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  
  // Icon container
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.buttonBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  
  // Section styles
  section: {
    marginBottom: theme.spacing.xxxl,
  },
  
  sectionTitle: {
    ...theme.typography.subtitleLarge,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  
  sectionContent: {
    gap: theme.spacing.sm,
  },
  
  // List styles
  listItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    ...theme.layout.cardPadding,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  
  listItemContent: {
    flex: 1,
  },
  
  // Spacing utilities
  marginBottom: {
    marginBottom: theme.spacing.lg,
  },
  
  marginTop: {
    marginTop: theme.spacing.lg,
  },
  
  paddingHorizontal: {
    paddingHorizontal: theme.spacing.xl,
  },
  
  containerPadding: {
    paddingHorizontal: theme.spacing.xl,
  },
})

export const textStyles = StyleSheet.create({
  // Centered text
  textCenter: {
    textAlign: 'center',
  },
  
  // Text colors
  textPrimaryColor: {
    color: theme.colors.textPrimary,
  },
  
  textSecondary: {
    color: theme.colors.textSecondary,
  },
  
  textTertiary: {
    color: theme.colors.textTertiary,
  },
  
  textMuted: {
    color: theme.colors.textMuted,
  },
  
  textSuccess: {
    color: theme.colors.success,
  },
  
  textWarning: {
    color: theme.colors.warning,
  },
  
  textError: {
    color: theme.colors.error,
  },
  
  textPrimaryAccent: {
    color: theme.colors.primary,
  },
})