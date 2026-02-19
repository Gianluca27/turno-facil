import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, RadioButton, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { BookingStackParamList } from '../../navigation/types';
import { bookingApi, userApi } from '../../services/api';
import { useBookingStore } from '../../shared/stores/bookingStore';

type NavigationProp = NativeStackNavigationProp<BookingStackParamList, 'Payment'>;
type RouteProps = RouteProp<BookingStackParamList, 'Payment'>;

interface PaymentMethod {
  _id: string;
  type: 'card' | 'mercadopago';
  last4: string;
  brand: string;
  isDefault: boolean;
}

export default function PaymentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { appointmentId } = route.params;
  const { pricing: bookingPricing } = useBookingStore();

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'now' | 'later'>('now');

  // Fetch payment info
  const { data: paymentData, isLoading: isLoadingPayment } = useQuery({
    queryKey: ['payment-info', appointmentId],
    queryFn: () => bookingApi.getPaymentInfo(appointmentId),
  });

  // Fetch user payment methods
  const { data: methodsData, isLoading: isLoadingMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => userApi.getPaymentMethods(),
  });

  const paymentInfo = paymentData?.data?.data?.paymentInfo;
  const paymentMethods: PaymentMethod[] = methodsData?.data?.data?.paymentMethods || [];

  // Set default payment method
  React.useEffect(() => {
    if (paymentMethods.length > 0 && !selectedMethod) {
      const defaultMethod = paymentMethods.find((m) => m.isDefault);
      setSelectedMethod(defaultMethod?._id || paymentMethods[0]._id);
    }
  }, [paymentMethods, selectedMethod]);

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: () =>
      bookingApi.processPayment(appointmentId, {
        paymentMethodId: selectedMethod || undefined,
        method: paymentType === 'later' ? 'cash' : 'card',
      }),
    onSuccess: () => {
      navigation.navigate('BookingSuccess', { appointmentId });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al procesar el pago';
      Alert.alert('Error', message);
    },
  });

  const getCardIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return 'credit-card';
      case 'mastercard':
        return 'credit-card';
      case 'amex':
        return 'credit-card';
      default:
        return 'credit-card-outline';
    }
  };

  if (isLoadingPayment || isLoadingMethods) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando opciones de pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Pago</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total a pagar</Text>
          <Text style={styles.amountValue}>
            ${paymentInfo?.total?.toLocaleString() || '0'}
          </Text>
          {paymentInfo?.requiresDeposit && (
            <View style={styles.depositInfo}>
              <Icon name="information-outline" size={16} color={colors.primary} />
              <Text style={styles.depositText}>
                Se requiere una seña de ${paymentInfo.depositAmount?.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>¿Cuándo querés pagar?</Text>

          <TouchableOpacity
            style={[styles.optionCard, paymentType === 'now' && styles.optionCardSelected]}
            onPress={() => setPaymentType('now')}
          >
            <View style={styles.optionContent}>
              <View style={[styles.optionIcon, { backgroundColor: colors.successLight + '30' }]}>
                <Icon name="lightning-bolt" size={24} color={colors.success} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Pagar ahora</Text>
                <Text style={styles.optionDescription}>
                  Pagá con tarjeta de crédito/débito o MercadoPago
                </Text>
              </View>
            </View>
            <RadioButton
              value="now"
              status={paymentType === 'now' ? 'checked' : 'unchecked'}
              onPress={() => setPaymentType('now')}
              color={colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, paymentType === 'later' && styles.optionCardSelected]}
            onPress={() => setPaymentType('later')}
          >
            <View style={styles.optionContent}>
              <View style={[styles.optionIcon, { backgroundColor: colors.primaryLight + '30' }]}>
                <Icon name="store" size={24} color={colors.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Pagar en el local</Text>
                <Text style={styles.optionDescription}>
                  Efectivo, tarjeta o transferencia al finalizar el servicio
                </Text>
              </View>
            </View>
            <RadioButton
              value="later"
              status={paymentType === 'later' ? 'checked' : 'unchecked'}
              onPress={() => setPaymentType('later')}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Payment Methods (only if paying now) */}
        {paymentType === 'now' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Método de pago</Text>

            {paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method._id}
                  style={[
                    styles.methodCard,
                    selectedMethod === method._id && styles.methodCardSelected,
                  ]}
                  onPress={() => setSelectedMethod(method._id)}
                >
                  <View style={styles.methodContent}>
                    <Icon name={getCardIcon(method.brand)} size={28} color={colors.text} />
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodBrand}>
                        {method.brand} •••• {method.last4}
                      </Text>
                      {method.isDefault && (
                        <Text style={styles.methodDefault}>Predeterminada</Text>
                      )}
                    </View>
                  </View>
                  <RadioButton
                    value={method._id}
                    status={selectedMethod === method._id ? 'checked' : 'unchecked'}
                    onPress={() => setSelectedMethod(method._id)}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noMethods}>
                <Icon name="credit-card-plus-outline" size={48} color={colors.gray300} />
                <Text style={styles.noMethodsText}>No tenés métodos de pago guardados</Text>
                <Button
                  mode="outlined"
                  onPress={() => {
                    // Navigate to add payment method
                  }}
                  style={styles.addMethodButton}
                >
                  Agregar tarjeta
                </Button>
              </View>
            )}

            {/* MercadoPago Option */}
            <TouchableOpacity
              style={[
                styles.methodCard,
                selectedMethod === 'mercadopago' && styles.methodCardSelected,
              ]}
              onPress={() => setSelectedMethod('mercadopago')}
            >
              <View style={styles.methodContent}>
                <View style={styles.mpLogo}>
                  <Text style={styles.mpText}>MP</Text>
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodBrand}>MercadoPago</Text>
                  <Text style={styles.methodDescription}>
                    Pagá con tu cuenta de MercadoPago
                  </Text>
                </View>
              </View>
              <RadioButton
                value="mercadopago"
                status={selectedMethod === 'mercadopago' ? 'checked' : 'unchecked'}
                onPress={() => setSelectedMethod('mercadopago')}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Icon name="shield-check" size={20} color={colors.success} />
          <Text style={styles.securityText}>
            Tus datos están protegidos con encriptación de extremo a extremo
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          mode="contained"
          onPress={() => paymentMutation.mutate()}
          loading={paymentMutation.isPending}
          disabled={paymentMutation.isPending || (paymentType === 'now' && !selectedMethod)}
          style={styles.payButton}
          contentStyle={styles.payButtonContent}
          labelStyle={styles.payButtonLabel}
        >
          {paymentType === 'later'
            ? 'Confirmar reserva'
            : `Pagar seña $${(paymentInfo?.depositAmount || bookingPricing.deposit || 0).toLocaleString()}`}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  amountCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
  },
  depositInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  depositText: {
    fontSize: 13,
    color: colors.primary,
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '10',
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: colors.primary,
  },
  methodContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodInfo: {
    marginLeft: 12,
    flex: 1,
  },
  methodBrand: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  methodDefault: {
    fontSize: 12,
    color: colors.success,
    marginTop: 2,
  },
  methodDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mpLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#00B1EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mpText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  noMethods: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noMethodsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 16,
  },
  addMethodButton: {
    borderRadius: 8,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight + '20',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  securityText: {
    fontSize: 13,
    color: colors.success,
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 24,
  },
  payButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  payButtonContent: {
    height: 52,
  },
  payButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
