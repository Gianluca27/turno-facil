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
import { businessApi, bookingApi, promotionsApi } from '../../services/api';

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

  const [notes, setNotes] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  // Fetch business
  const { data: businessData } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessApi.getById(businessId),
  });

  // Fetch services
  const { data: servicesData } = useQuery({
    queryKey: ['business-services', businessId],
    queryFn: () => businessApi.getServices(businessId),
  });

  // Fetch staff
  const { data: staffData } = useQuery({
    queryKey: ['business-staff', businessId],
    queryFn: () => businessApi.getStaff(businessId),
    enabled: !!staffId,
  });

  // Calculate price
  const { data: priceData, isLoading: isLoadingPrice } = useQuery({
    queryKey: ['booking-price', businessId, serviceIds, discountCode],
    queryFn: () =>
      bookingApi.calculatePrice({
        businessId,
        serviceIds,
        discountCode: appliedDiscount > 0 ? discountCode : undefined,
      }),
  });

  const business = businessData?.data?.data?.business;
  const allServices = servicesData?.data?.data?.services || [];
  const selectedServices = allServices.filter((s: any) => serviceIds.includes(s._id));
  const allStaff = staffData?.data?.data?.staff || [];
  const selectedStaff = staffId ? allStaff.find((s: any) => s._id === staffId) : null;

  const pricing = priceData?.data?.data || {
    subtotal: selectedServices.reduce((sum: number, s: any) => sum + s.price, 0),
    discount: appliedDiscount,
    total: selectedServices.reduce((sum: number, s: any) => sum + s.price, 0) - appliedDiscount,
  };

  const totalDuration = selectedServices.reduce((sum: number, s: any) => sum + s.duration, 0);

  // Booking mutation
  const bookingMutation = useMutation({
    mutationFn: () =>
      bookingApi.create({
        businessId,
        services: serviceIds.map((id) => ({ serviceId: id })),
        staffId,
        date,
        startTime,
        notes: notes || undefined,
        discountCode: appliedDiscount > 0 ? discountCode : undefined,
      }),
    onSuccess: (response) => {
      const appointmentId = response.data?.data?.appointment?._id;
      navigation.navigate('BookingSuccess', { appointmentId });
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
      const response = await promotionsApi.validateCode({
        code: discountCode,
        businessId,
        serviceIds,
      });

      if (response.data?.data?.valid) {
        setAppliedDiscount(response.data.data.discount || 0);
        Alert.alert('Código aplicado', 'El descuento fue aplicado correctamente');
      } else {
        Alert.alert('Código inválido', 'El código ingresado no es válido o no aplica');
        setAppliedDiscount(0);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo validar el código');
      setAppliedDiscount(0);
    } finally {
      setIsValidatingCode(false);
    }
  };

  const formatDate = () => {
    const d = new Date(date + 'T12:00:00');
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
    const day = d.getDate();
    const month = MONTHS_ES[d.getMonth()];
    return `${dayName} ${day} de ${month}`;
  };

  const staffName = selectedStaff
    ? selectedStaff.profile?.displayName ||
      `${selectedStaff.profile?.firstName} ${selectedStaff.profile?.lastName}`
    : 'Sin preferencia';

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
              {business?.location?.address}, {business?.location?.city}
            </Text>
          </View>
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
          {selectedServices.map((service: any) => (
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
                name={selectedStaff ? 'account' : 'account-group'}
                size={24}
                color={colors.white}
              />
            </View>
            <Text style={styles.staffName}>{staffName}</Text>
          </View>
        </View>

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
            />
            <Button
              mode={appliedDiscount > 0 ? 'outlined' : 'contained'}
              onPress={appliedDiscount > 0 ? () => { setDiscountCode(''); setAppliedDiscount(0); } : handleValidateCode}
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
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          mode="contained"
          onPress={() => bookingMutation.mutate()}
          loading={bookingMutation.isPending}
          disabled={bookingMutation.isPending}
          style={styles.confirmButton}
          contentStyle={styles.confirmButtonContent}
          labelStyle={styles.confirmButtonLabel}
        >
          Confirmar reserva
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
  notesInput: {
    backgroundColor: colors.white,
  },
  notesInputOutline: {
    borderRadius: 8,
  },
  pricingCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
