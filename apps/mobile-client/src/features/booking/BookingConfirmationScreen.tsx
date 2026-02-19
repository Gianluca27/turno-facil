import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, TextInput, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { BookingStackParamList } from '../../navigation/types';
import { bookingApi, promotionsApi } from '../../services/api';
import { useBookingStore } from '../../shared/stores/bookingStore';

type NavigationProp = NativeStackNavigationProp<BookingStackParamList, 'BookingConfirmation'>;
type RouteProps = RouteProp<BookingStackParamList, 'BookingConfirmation'>;

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function BookingConfirmationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { businessId, serviceIds, staffId, date, startTime } = route.params;
  const bookingStore = useBookingStore();

  const [notes, setNotes] = useState(bookingStore.notes);
  const [discountCode, setDiscountCode] = useState(bookingStore.discountCode);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(bookingStore.discountAmount);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  // Read from bookingStore (already populated by previous screens)
  const business = bookingStore.business;
  const selectedServices = bookingStore.services;
  const selectedStaff = bookingStore.staff;
  const noStaffPreference = bookingStore.noStaffPreference;
  const totalDuration = bookingStore.totalDuration();

  // Calculate price from backend
  const { data: priceData, isLoading: isLoadingPrice } = useQuery({
    queryKey: ['booking-price', businessId, serviceIds, appliedDiscount > 0 ? discountCode : ''],
    queryFn: () =>
      bookingApi.calculatePrice({
        businessId,
        serviceIds,
        discountCode: appliedDiscount > 0 ? discountCode : undefined,
      }),
  });

  const pricing = priceData?.data?.data || {
    subtotal: selectedServices.reduce((sum, s) => sum + s.price, 0),
    discount: appliedDiscount,
    total: selectedServices.reduce((sum, s) => sum + s.price, 0) - appliedDiscount,
    deposit: 0,
  };

  // Update store pricing when we get backend data
  React.useEffect(() => {
    if (priceData?.data?.data) {
      const p = priceData.data.data;
      bookingStore.setPricing({
        subtotal: p.subtotal,
        discount: p.discount || 0,
        total: p.total,
        deposit: p.deposit || 0,
      });
    }
  }, [priceData, bookingStore]);

  // Booking mutation
  const bookingMutation = useMutation({
    mutationFn: () =>
      bookingApi.create({
        businessId,
        serviceIds,
        ...(staffId ? { staffId } : {}),
        date,
        startTime,
        notes: notes || undefined,
        discountCode: appliedDiscount > 0 ? discountCode : undefined,
      }),
    onSuccess: (response) => {
      const appointmentId = response.data?.data?.appointment?._id;
      const requiresDeposit = response.data?.data?.requiresDeposit;

      bookingStore.setNotes(notes);
      bookingStore.setAppointmentId(appointmentId);

      if (requiresDeposit) {
        // Route to payment screen for deposit
        navigation.navigate('Payment', { appointmentId });
      } else {
        // Skip payment, go directly to success
        navigation.navigate('BookingSuccess', { appointmentId });
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la reserva';
      Alert.alert('Error', message);
    },
  });

  const handleValidateCode = async () => {
    if (!discountCode.trim()) return;

    setIsValidatingCode(true);
    try {
      const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
      const response = await promotionsApi.validateCode({
        code: discountCode,
        businessId,
        serviceIds,
        subtotal,
      });

      if (response.data?.data?.valid) {
        const discount = response.data.data.discount || response.data.data.discountAmount || 0;
        setAppliedDiscount(discount);
        bookingStore.setDiscount(discountCode, discount);
        Alert.alert('Código aplicado', 'El descuento fue aplicado correctamente');
      } else {
        Alert.alert('Código inválido', 'El código ingresado no es válido o no aplica');
        setAppliedDiscount(0);
        bookingStore.clearDiscount();
      }
    } catch {
      Alert.alert('Error', 'No se pudo validar el código');
      setAppliedDiscount(0);
      bookingStore.clearDiscount();
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleRemoveCode = () => {
    setDiscountCode('');
    setAppliedDiscount(0);
    bookingStore.clearDiscount();
  };

  const formatDate = () => {
    const d = new Date(date + 'T12:00:00');
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
    const day = d.getDate();
    const month = MONTHS_ES[d.getMonth()];
    return `${dayName} ${day} de ${month}`;
  };

  const staffName = noStaffPreference
    ? 'Sin preferencia'
    : selectedStaff?.displayName ||
      (selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName}` : 'Sin preferencia');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.stepText}>Paso 4 de 4</Text>
          <Text style={styles.title}>Confirmá tu reserva</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Business Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{business?.name}</Text>
          <View style={styles.infoRow}>
            <Icon name="map-marker-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              {business?.address}, {business?.city}
            </Text>
          </View>
          {business?.requireConfirmation && (
            <View style={styles.confirmationBadge}>
              <Icon name="clock-outline" size={14} color={colors.warning} />
              <Text style={styles.confirmationText}>
                Sujeto a confirmación del negocio
              </Text>
            </View>
          )}
        </View>

        {/* Date & Time */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fecha y hora</Text>
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeItem}>
              <Icon name="calendar" size={20} color={colors.primary} />
              <Text style={styles.dateTimeText}>{formatDate()}</Text>
            </View>
            <View style={styles.dateTimeItem}>
              <Icon name="clock-outline" size={20} color={colors.primary} />
              <Text style={styles.dateTimeText}>{startTime} hs</Text>
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Servicios seleccionados</Text>
          {selectedServices.map((service) => (
            <View key={service._id} style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDuration}>{service.duration} min</Text>
              </View>
              <Text style={styles.servicePrice}>${service.price.toLocaleString()}</Text>
            </View>
          ))}
          <Divider style={styles.divider} />
          <View style={styles.totalDuration}>
            <Text style={styles.totalDurationLabel}>Duración total</Text>
            <Text style={styles.totalDurationValue}>{totalDuration} min</Text>
          </View>
        </View>

        {/* Professional */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profesional</Text>
          <View style={styles.staffContainer}>
            <View style={styles.staffAvatar}>
              <Icon
                name={noStaffPreference ? 'account-group' : 'account'}
                size={24}
                color={colors.white}
              />
            </View>
            <View>
              <Text style={styles.staffName}>{staffName}</Text>
              {noStaffPreference && (
                <Text style={styles.staffNote}>
                  Se asignará el primer profesional disponible
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Cancellation Policy */}
        {business?.cancellationPolicy && (
          <View style={styles.policyCard}>
            <View style={styles.policyHeader}>
              <Icon name="shield-check-outline" size={20} color={colors.primary} />
              <Text style={styles.policyTitle}>Política de cancelación</Text>
            </View>
            {business.cancellationPolicy.allowCancellation ? (
              <>
                <Text style={styles.policyText}>
                  Cancelación gratuita hasta{' '}
                  <Text style={styles.policyHighlight}>
                    {business.cancellationPolicy.freeCancellationHours} horas
                  </Text>{' '}
                  antes del turno.
                </Text>
                {business.cancellationPolicy.penaltyPercentage > 0 && (
                  <Text style={styles.policyWarning}>
                    Cancelaciones tardías tienen un cargo del{' '}
                    {business.cancellationPolicy.penaltyPercentage}% sobre la seña.
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.policyWarning}>
                Este negocio no permite cancelaciones. Asegurate de poder asistir.
              </Text>
            )}
          </View>
        )}

        {/* Discount Code */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Código de descuento</Text>
          <View style={styles.discountContainer}>
            <TextInput
              value={discountCode}
              onChangeText={setDiscountCode}
              placeholder="Ingresá un código"
              mode="outlined"
              style={styles.discountInput}
              outlineStyle={styles.discountInputOutline}
              disabled={appliedDiscount > 0}
              autoCapitalize="characters"
            />
            <Button
              mode={appliedDiscount > 0 ? 'outlined' : 'contained'}
              onPress={appliedDiscount > 0 ? handleRemoveCode : handleValidateCode}
              loading={isValidatingCode}
              disabled={isValidatingCode || (!discountCode.trim() && !appliedDiscount)}
              style={styles.discountButton}
            >
              {appliedDiscount > 0 ? 'Quitar' : 'Aplicar'}
            </Button>
          </View>
          {appliedDiscount > 0 && (
            <View style={styles.discountApplied}>
              <Icon name="check-circle" size={16} color={colors.success} />
              <Text style={styles.discountAppliedText}>
                Descuento de ${appliedDiscount.toLocaleString()} aplicado
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notas (opcional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Agregá algún comentario o pedido especial..."
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.notesInput}
            outlineStyle={styles.notesInputOutline}
          />
        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingCard}>
          {isLoadingPrice ? (
            <View style={styles.pricingLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.pricingLoadingText}>Calculando precio...</Text>
            </View>
          ) : (
            <>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Subtotal</Text>
                <Text style={styles.pricingValue}>${pricing.subtotal?.toLocaleString()}</Text>
              </View>
              {pricing.discount > 0 && (
                <View style={styles.pricingRow}>
                  <Text style={styles.discountLabel}>Descuento</Text>
                  <Text style={styles.discountValue}>-${pricing.discount?.toLocaleString()}</Text>
                </View>
              )}
              <Divider style={styles.pricingDivider} />
              <View style={styles.pricingRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${pricing.total?.toLocaleString()}</Text>
              </View>
              {pricing.deposit > 0 && (
                <View style={styles.depositRow}>
                  <View style={styles.depositInfo}>
                    <Icon name="information-outline" size={16} color={colors.primary} />
                    <Text style={styles.depositLabel}>Seña requerida</Text>
                  </View>
                  <Text style={styles.depositValue}>${pricing.deposit?.toLocaleString()}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          mode="contained"
          onPress={() => bookingMutation.mutate()}
          loading={bookingMutation.isPending}
          disabled={bookingMutation.isPending || isLoadingPrice}
          style={styles.confirmButton}
          contentStyle={styles.confirmButtonContent}
          labelStyle={styles.confirmButtonLabel}
        >
          {pricing.deposit > 0
            ? `Reservar y pagar seña $${pricing.deposit?.toLocaleString()}`
            : 'Confirmar reserva'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerText: {
    flex: 1,
    marginLeft: 8,
  },
  stepText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  confirmationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  confirmationText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  serviceDuration: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    marginVertical: 12,
  },
  totalDuration: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalDurationLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  totalDurationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  staffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  staffNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Cancellation policy
  policyCard: {
    backgroundColor: colors.primaryLight + '12',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primaryLight + '30',
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  policyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  policyHighlight: {
    fontWeight: '600',
    color: colors.text,
  },
  policyWarning: {
    fontSize: 13,
    color: colors.warning,
    lineHeight: 20,
    marginTop: 4,
  },
  // Discount
  discountContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  discountInput: {
    flex: 1,
    backgroundColor: colors.white,
    height: 44,
  },
  discountInputOutline: {
    borderRadius: 8,
  },
  discountButton: {
    borderRadius: 8,
  },
  discountApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  discountAppliedText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '500',
  },
  // Notes
  notesInput: {
    backgroundColor: colors.white,
  },
  notesInputOutline: {
    borderRadius: 8,
  },
  // Pricing
  pricingCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pricingLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  pricingLoadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  pricingLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  pricingValue: {
    fontSize: 15,
    color: colors.text,
  },
  discountLabel: {
    fontSize: 15,
    color: colors.success,
  },
  discountValue: {
    fontSize: 15,
    color: colors.success,
    fontWeight: '500',
  },
  pricingDivider: {
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  depositInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  depositLabel: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  depositValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  // Bottom bar
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
  confirmButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  confirmButtonContent: {
    height: 52,
  },
  confirmButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
