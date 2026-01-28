import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { AuthStackParamList } from '../../navigation/types';
import { authApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'PhoneLogin'>;

const phoneSchema = z.object({
  phone: z
    .string()
    .min(8, 'El teléfono debe tener al menos 8 dígitos')
    .regex(/^[\d\s\-\+\(\)]+$/, 'Ingresá un número de teléfono válido'),
});

type PhoneFormData = z.infer<typeof phoneSchema>;

export default function PhoneLoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: '',
    },
  });

  const onSubmit = async (data: PhoneFormData) => {
    try {
      setIsLoading(true);
      const response = await authApi.loginWithPhone({ phone: data.phone });
      const { verificationId } = response.data.data;

      navigation.navigate('VerifyOtp', {
        phone: data.phone,
        verificationId,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Error al enviar el código';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Ingresar con teléfono</Text>
          <Text style={styles.subtitle}>
            Te enviaremos un código de verificación por SMS
          </Text>
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <Icon name="cellphone" size={48} color={colors.primary} />
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Número de teléfono"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                mode="outlined"
                keyboardType="phone-pad"
                error={!!errors.phone}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                left={<TextInput.Icon icon="phone-outline" />}
                placeholder="+54 11 1234-5678"
              />
            )}
          />
          {errors.phone && (
            <Text style={styles.errorText}>{errors.phone.message}</Text>
          )}

          <Text style={styles.infoText}>
            Al continuar, aceptás recibir un SMS con el código de verificación.
            Pueden aplicarse tarifas de tu operador.
          </Text>

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={isLoading}
            style={styles.submitButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Enviar código
          </Button>
        </View>

        {/* Other Options */}
        <View style={styles.otherOptions}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.optionLink}>Ingresar con email</Text>
          </TouchableOpacity>
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
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 24,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    gap: 8,
  },
  input: {
    backgroundColor: colors.white,
  },
  inputOutline: {
    borderRadius: 12,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: -4,
    marginLeft: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginTop: 24,
  },
  buttonContent: {
    height: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  otherOptions: {
    alignItems: 'center',
    marginTop: 32,
  },
  optionLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});
