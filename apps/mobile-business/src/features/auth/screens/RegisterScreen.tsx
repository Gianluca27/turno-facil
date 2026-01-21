import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { RootStackParamList } from '../../../app/navigation/RootNavigator';
import { useAuthStore } from '../../../shared/stores/authStore';
import { authApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';

const registerSchema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
  businessName: z.string().min(2, 'Nombre del negocio requerido'),
  businessType: z.string().min(2, 'Tipo de negocio requerido'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      businessName: '',
      businessType: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authApi.register({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      businessName: data.businessName,
      businessType: data.businessType,
    }),
    onSuccess: (response) => {
      const { user, tokens } = response.data.data;
      login(user, tokens);
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Registrar Negocio
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Crea tu cuenta y comienza a gestionar tus turnos
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Datos Personales
          </Text>

          <View style={styles.row}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <TextInput
                    label="Nombre"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    error={!!errors.firstName}
                  />
                  {errors.firstName && (
                    <HelperText type="error">{errors.firstName.message}</HelperText>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <TextInput
                    label="Apellido"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    error={!!errors.lastName}
                  />
                  {errors.lastName && (
                    <HelperText type="error">{errors.lastName.message}</HelperText>
                  )}
                </View>
              )}
            />
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label="Email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  mode="outlined"
                  error={!!errors.email}
                />
                {errors.email && (
                  <HelperText type="error">{errors.email.message}</HelperText>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label="Teléfono (opcional)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="phone-pad"
                  mode="outlined"
                />
              </View>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Datos del Negocio
          </Text>

          <Controller
            control={control}
            name="businessName"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label="Nombre del negocio"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  mode="outlined"
                  error={!!errors.businessName}
                />
                {errors.businessName && (
                  <HelperText type="error">{errors.businessName.message}</HelperText>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="businessType"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label="Tipo de negocio (ej: barbería, spa)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  mode="outlined"
                  error={!!errors.businessType}
                />
                {errors.businessType && (
                  <HelperText type="error">{errors.businessType.message}</HelperText>
                )}
              </View>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Contraseña
          </Text>

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label="Contraseña"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPassword}
                  mode="outlined"
                  error={!!errors.password}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                />
                {errors.password && (
                  <HelperText type="error">{errors.password.message}</HelperText>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label="Confirmar contraseña"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPassword}
                  mode="outlined"
                  error={!!errors.confirmPassword}
                />
                {errors.confirmPassword && (
                  <HelperText type="error">{errors.confirmPassword.message}</HelperText>
                )}
              </View>
            )}
          />
        </View>

        {registerMutation.isError && (
          <HelperText type="error" style={styles.errorText}>
            {(registerMutation.error as any)?.response?.data?.error?.message ||
              'Error al registrar. Intenta nuevamente.'}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={registerMutation.isPending}
          disabled={registerMutation.isPending}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Crear Cuenta
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          Ya tengo cuenta - Iniciar sesión
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  button: {
    marginTop: spacing.md,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  backButton: {
    marginTop: spacing.sm,
  },
  errorText: {
    textAlign: 'center',
  },
});
