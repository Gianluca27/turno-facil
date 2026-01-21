import { MD3LightTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  fontFamily: 'System',
};

export const colors = {
  // Primary
  primary: '#2563EB', // Blue
  primaryLight: '#60A5FA',
  primaryDark: '#1D4ED8',

  // Secondary
  secondary: '#7C3AED', // Purple
  secondaryLight: '#A78BFA',
  secondaryDark: '#5B21B6',

  // Neutrals
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceVariant: '#F1F5F9',

  // Text
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Appointment status colors
  statusPending: '#F59E0B',
  statusConfirmed: '#3B82F6',
  statusCheckedIn: '#8B5CF6',
  statusInProgress: '#6366F1',
  statusCompleted: '#10B981',
  statusCancelled: '#EF4444',
  statusNoShow: '#6B7280',

  // Shadows
  shadow: '#0F172A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryLight,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    error: colors.error,
    errorContainer: colors.errorLight,
    onPrimary: colors.textOnPrimary,
    onSecondary: colors.textOnPrimary,
    onBackground: colors.text,
    onSurface: colors.text,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
    outlineVariant: colors.borderLight,
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: borderRadius.md,
};

export type AppTheme = typeof theme;

// Status color mapping
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    pending: colors.statusPending,
    confirmed: colors.statusConfirmed,
    checked_in: colors.statusCheckedIn,
    in_progress: colors.statusInProgress,
    completed: colors.statusCompleted,
    cancelled: colors.statusCancelled,
    no_show: colors.statusNoShow,
  };
  return statusColors[status] || colors.textSecondary;
};

// Status label mapping
export const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    checked_in: 'En espera',
    in_progress: 'En proceso',
    completed: 'Completado',
    cancelled: 'Cancelado',
    no_show: 'No asistió',
  };
  return statusLabels[status] || status;
};
