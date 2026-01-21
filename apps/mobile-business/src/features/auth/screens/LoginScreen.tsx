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

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) => authApi.login(data.email, data.password),
    onSuccess: (response) => {
      const { user, tokens } = response.data.data;
      login(user, tokens);
    },
    onError: (error: any) => {
      console.error('Login error:', error);
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
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
          <Text variant="displaySmall" style={styles.title}>
            TurnoFácil
          </Text>
          <Text variant="titleMedium" style={styles.subtitle}>
            Para Negocios
          </Text>
        </View>

        <View style={styles.form}>
          <Text variant="headlineSmall" style={styles.formTitle}>
            Iniciar Sesión
          </Text>

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
                  autoComplete="email"
                  mode="outlined"
                  error={!!errors.email}
                  left={<TextInput.Icon icon="email-outline" />}
                />
                {errors.email && (
                  <HelperText type="error">{errors.email.message}</HelperText>
                )}
              </View>
            )}
          />

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
                  autoCapitalize="none"
                  mode="outlined"
                  error={!!errors.password}
                  left={<TextInput.Icon icon="lock-outline" />}
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

          {loginMutation.isError && (
            <HelperText type="error" style={styles.errorText}>
              {(loginMutation.error as any)?.response?.data?.error?.message ||
                'Error al iniciar sesión. Verifica tus credenciales.'}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={loginMutation.isPending}
            disabled={loginMutation.isPending}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Iniciar Sesión
          </Button>

          <Button
            mode="text"
            onPress={() => {}}
            style={styles.forgotButton}
          >
            ¿Olvidaste tu contraseña?
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            ¿No tenés cuenta?
          </Text>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate('Register')}
            style={styles.registerButton}
          >
            Registrar mi negocio
          </Button>
        </View>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.primary,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    marginBottom: spacing.xl,
  },
  formTitle: {
    marginBottom: spacing.lg,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.md,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  forgotButton: {
    marginTop: spacing.sm,
  },
  errorText: {
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  registerButton: {
    borderRadius: 8,
  },
});
