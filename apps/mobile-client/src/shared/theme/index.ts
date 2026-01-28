import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { colors } from './colors';

const fontConfig = {
  displayLarge: { fontFamily: 'System', fontSize: 57, fontWeight: '400' as const, letterSpacing: 0 },
  displayMedium: { fontFamily: 'System', fontSize: 45, fontWeight: '400' as const, letterSpacing: 0 },
  displaySmall: { fontFamily: 'System', fontSize: 36, fontWeight: '400' as const, letterSpacing: 0 },
  headlineLarge: { fontFamily: 'System', fontSize: 32, fontWeight: '400' as const, letterSpacing: 0 },
  headlineMedium: { fontFamily: 'System', fontSize: 28, fontWeight: '400' as const, letterSpacing: 0 },
  headlineSmall: { fontFamily: 'System', fontSize: 24, fontWeight: '400' as const, letterSpacing: 0 },
  titleLarge: { fontFamily: 'System', fontSize: 22, fontWeight: '500' as const, letterSpacing: 0 },
  titleMedium: { fontFamily: 'System', fontSize: 16, fontWeight: '500' as const, letterSpacing: 0.15 },
  titleSmall: { fontFamily: 'System', fontSize: 14, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelLarge: { fontFamily: 'System', fontSize: 14, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelMedium: { fontFamily: 'System', fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.5 },
  labelSmall: { fontFamily: 'System', fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },
  bodyLarge: { fontFamily: 'System', fontSize: 16, fontWeight: '400' as const, letterSpacing: 0.15 },
  bodyMedium: { fontFamily: 'System', fontSize: 14, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontFamily: 'System', fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.4 },
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryLight,
    tertiary: colors.accent,
    tertiaryContainer: colors.accentLight,
    surface: colors.white,
    surfaceVariant: colors.gray100,
    surfaceDisabled: colors.gray200,
    background: colors.background,
    error: colors.error,
    errorContainer: colors.errorLight,
    onPrimary: colors.white,
    onPrimaryContainer: colors.primaryDark,
    onSecondary: colors.white,
    onSecondaryContainer: colors.secondaryDark,
    onTertiary: colors.white,
    onTertiaryContainer: colors.accentDark,
    onSurface: colors.text,
    onSurfaceVariant: colors.textSecondary,
    onSurfaceDisabled: colors.textTertiary,
    onError: colors.white,
    onErrorContainer: colors.errorDark,
    onBackground: colors.text,
    outline: colors.border,
    outlineVariant: colors.borderLight,
    inverseSurface: colors.gray800,
    inverseOnSurface: colors.white,
    inversePrimary: colors.primaryLight,
    shadow: colors.black,
    scrim: colors.overlay,
    backdrop: colors.overlayLight,
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: 12,
};

export { colors };
export type AppTheme = typeof theme;
