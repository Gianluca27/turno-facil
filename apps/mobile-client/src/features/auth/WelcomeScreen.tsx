import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../shared/theme';
import { AuthStackParamList } from '../../navigation/types';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo and Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>TurnoFácil</Text>
          </View>
          <Text style={styles.tagline}>
            Reservá turnos en tus lugares favoritos de forma fácil y rápida
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.featureIconText}>📅</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Reservá al instante</Text>
              <Text style={styles.featureDescription}>
                Encontrá disponibilidad y reservá en segundos
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: colors.secondaryLight }]}>
              <Text style={styles.featureIconText}>🔔</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Recordatorios</Text>
              <Text style={styles.featureDescription}>
                Nunca más te olvides de un turno
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: colors.accentLight }]}>
              <Text style={styles.featureIconText}>⭐</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Descubrí lugares</Text>
              <Text style={styles.featureDescription}>
                Explorá negocios cerca tuyo con las mejores reseñas
              </Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonsSection}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Register')}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Crear cuenta
          </Button>

          <Button
            mode="outlined"
            onPress={() => navigation.navigate('Login')}
            style={styles.secondaryButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.secondaryButtonLabel}
          >
            Ya tengo cuenta
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('PhoneLogin')}
            style={styles.textButton}
            labelStyle={styles.textButtonLabel}
          >
            Ingresar con número de teléfono
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  featuresSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIconText: {
    fontSize: 24,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  buttonsSection: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    borderRadius: 12,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  textButton: {
    marginTop: 4,
  },
  buttonContent: {
    height: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  textButtonLabel: {
    fontSize: 14,
    color: colors.primary,
  },
});
