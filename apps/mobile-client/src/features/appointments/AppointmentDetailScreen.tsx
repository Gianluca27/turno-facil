import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Text, Button, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { AppointmentsStackParamList } from '../../navigation/types';
import { bookingApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<AppointmentsStackParamList, 'AppointmentDetail'>;
type RouteProps = RouteProp<AppointmentsStackParamList, 'AppointmentDetail'>;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pendiente de confirmación', color: colors.warning, icon: 'clock-outline' },
  confirmed: { label: 'Confirmado', color: colors.success, icon: 'check-circle' },
  checked_in: { label: 'En espera', color: colors.primary, icon: 'account-check' },
  in_progress: { label: 'En curso', color: colors.primary, icon: 'progress-clock' },
  completed: { label: 'Completado', color: colors.success, icon: 'check-all' },
  cancelled: { label: 'Cancelado', color: colors.error, icon: 'cancel' },
  no_show: { label: 'No asistió', color: colors.error, icon: 'account-remove' },
};

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function AppointmentDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { appointmentId } = route.params;
  const queryClient = useQueryClient();

  // Fetch appointment
  const { data, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => bookingApi.getById(appointmentId),
  });

  const appointment = data?.data?.data?.appointment;
  const statusConfig = appointment ? STATUS_CONFIG[appointment.status] : STATUS_CONFIG.pending;

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => bookingApi.cancel(appointmentId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      Alert.alert('Turno cancelado', 'Tu turno ha sido cancelado exitosamente');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al cancelar el turno';
      Alert.alert('Error', message);
    },
  });

  const handleCancel = () => {
    Alert.alert(
      'Cancelar turno',
      '¿Estás seguro de que querés cancelar este turno?',
      [
        { text: 'No, volver', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(undefined),
        },
      ]
    );
  };

  const handleReschedule = () => {
    navigation.navigate('RescheduleAppointment', { appointmentId });
  };

  const handleWriteReview = () => {
    navigation.navigate('WriteReview', { appointmentId });
  };

  const handleCall = () => {
    if (appointment?.businessInfo?.phone) {
      Linking.openURL(`tel:${appointment.businessInfo.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (appointment?.businessInfo?.whatsapp) {
      Linking.openURL(`https://wa.me/${appointment.businessInfo.whatsapp.replace(/\D/g, '')}`);
    }
  };

  const handleDirections = () => {
    if (appointment?.businessInfo?.location?.coordinates) {
      const [lng, lat] = appointment.businessInfo.location.coordinates;
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
    const day = d.getDate();
    const month = MONTHS_ES[d.getMonth()];
    const year = d.getFullYear();
    return `${dayName} ${day} de ${month} de ${year}`;
  };

  const canCancel = ['pending', 'confirmed'].includes(appointment?.status || '');
  const canReschedule = ['pending', 'confirmed'].includes(appointment?.status || '');
  const canReview = appointment?.status === 'completed' && !appointment?.review?.submitted;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color={colors.error} />
          <Text style={styles.errorText}>No se pudo cargar el turno</Text>
          <Button mode="outlined" onPress={() => navigation.goBack()}>
            Volver
          </Button>
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
        <Text style={styles.headerTitle}>Detalle del turno</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusConfig.color + '15' }]}>
          <Icon name={statusConfig.icon} size={24} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Business Info */}
        <View style={styles.card}>
          <Text style={styles.businessName}>{appointment.businessInfo?.name}</Text>
          <View style={styles.addressRow}>
            <Icon name="map-marker-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.addressText}>
              {appointment.businessInfo?.location?.address}
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={handleCall}>
              <Icon name="phone" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Llamar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={handleWhatsApp}>
              <Icon name="whatsapp" size={20} color={colors.success} />
              <Text style={styles.quickActionText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={handleDirections}>
              <Icon name="directions" size={20} color={colors.secondary} />
              <Text style={styles.quickActionText}>Cómo llegar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fecha y hora</Text>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeItem}>
              <Icon name="calendar" size={22} color={colors.primary} />
              <Text style={styles.dateTimeText}>{formatDate(appointment.date)}</Text>
            </View>
            <View style={styles.dateTimeItem}>
              <Icon name="clock-outline" size={22} color={colors.primary} />
              <Text style={styles.dateTimeText}>
                {appointment.startTime} - {appointment.endTime} hs
              </Text>
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Servicios</Text>
          {appointment.services?.map((service: any, index: number) => (
            <View key={index} style={styles.serviceRow}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDuration}>{service.duration} min</Text>
              </View>
              <Text style={styles.servicePrice}>${service.price?.toLocaleString()}</Text>
            </View>
          ))}
          <Divider style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              ${appointment.pricing?.total?.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Professional */}
        {appointment.staffInfo?.name && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profesional</Text>
            <View style={styles.staffRow}>
              <View style={styles.staffAvatar}>
                <Icon name="account" size={24} color={colors.white} />
              </View>
              <Text style={styles.staffName}>{appointment.staffInfo.name}</Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {appointment.notes?.client && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.notesText}>{appointment.notes.client}</Text>
          </View>
        )}

        {/* Payment Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pago</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Estado:</Text>
            <Chip
              style={[
                styles.paymentChip,
                {
                  backgroundColor:
                    appointment.payment?.status === 'paid'
                      ? colors.successLight + '30'
                      : colors.warningLight + '30',
                },
              ]}
              textStyle={{
                color:
                  appointment.payment?.status === 'paid' ? colors.success : colors.warning,
                fontSize: 12,
              }}
            >
              {appointment.payment?.status === 'paid' ? 'Pagado' : 'Pendiente'}
            </Chip>
          </View>
          {appointment.payment?.method && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Método:</Text>
              <Text style={styles.paymentValue}>
                {appointment.payment.method === 'card'
                  ? 'Tarjeta'
                  : appointment.payment.method === 'cash'
                    ? 'Efectivo'
                    : appointment.payment.method}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {canReview && (
            <Button
              mode="contained"
              onPress={handleWriteReview}
              style={styles.reviewButton}
              contentStyle={styles.buttonContent}
              icon="star"
            >
              Dejar reseña
            </Button>
          )}

          {canReschedule && (
            <Button
              mode="outlined"
              onPress={handleReschedule}
              style={styles.actionButton}
              contentStyle={styles.buttonContent}
              icon="calendar-edit"
            >
              Reprogramar
            </Button>
          )}

          {canCancel && (
            <Button
              mode="outlined"
              onPress={handleCancel}
              style={[styles.actionButton, styles.cancelButton]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.cancelButtonLabel}
              icon="close-circle"
              loading={cancelMutation.isPending}
            >
              Cancelar turno
            </Button>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  dateTimeRow: {
    gap: 12,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateTimeText: {
    fontSize: 15,
    color: colors.text,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    color: colors.text,
  },
  serviceDuration: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  divider: {
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  notesText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  paymentValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  paymentChip: {
    height: 26,
  },
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  reviewButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  actionButton: {
    borderRadius: 12,
    borderColor: colors.primary,
  },
  cancelButton: {
    borderColor: colors.error,
  },
  cancelButtonLabel: {
    color: colors.error,
  },
  buttonContent: {
    height: 48,
  },
});
