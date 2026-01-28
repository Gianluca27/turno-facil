import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import {
  Text,
  Button,
  Card,
  Chip,
  ActivityIndicator,
  Divider,
  Portal,
  Modal,
  TextInput,
  IconButton,
  Avatar,
  Menu,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { appointmentsApi } from '../../../services/api';
import { colors, spacing, getStatusColor, getStatusLabel } from '../../../shared/theme';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type AppointmentDetailRouteProp = RouteProp<RootStackParamList, 'AppointmentDetail'>;
type AppointmentDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AppointmentDetail'>;

interface Appointment {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  startDateTime: string;
  status: string;
  source: string;
  clientId?: string;
  clientInfo: {
    name: string;
    phone?: string;
    email?: string;
  };
  staffId: string;
  staffInfo: {
    name: string;
  };
  services: Array<{
    serviceId: string;
    name: string;
    duration: number;
    price: number;
    discount: number;
  }>;
  pricing: {
    subtotal: number;
    discount: number;
    discountCode?: string;
    deposit: number;
    depositPaid: boolean;
    total: number;
    tip: number;
    finalTotal: number;
  };
  payment: {
    status: string;
    method?: string;
    paidAmount: number;
    paidAt?: string;
  };
  notes: {
    client?: string;
    business?: string;
    staff?: string;
  };
  statusHistory: Array<{
    status: string;
    changedAt: string;
    changedBy?: string;
    reason?: string;
  }>;
  cancellation?: {
    cancelledAt: string;
    cancelledBy: string;
    reason?: string;
    refunded: boolean;
    refundAmount: number;
  };
  createdAt: string;
  staff?: {
    _id: string;
    profile: { firstName: string; lastName: string; avatar?: string };
  };
}

const SOURCE_LABELS: Record<string, string> = {
  app_client: 'App Cliente',
  app_business: 'App Negocio',
  manual: 'Manual',
  api: 'API',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
  refunded: 'Reembolsado',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  mercadopago: 'MercadoPago',
  transfer: 'Transferencia',
};

export const AppointmentDetailScreen: React.FC = () => {
  const navigation = useNavigation<AppointmentDetailNavigationProp>();
  const route = useRoute<AppointmentDetailRouteProp>();
  const queryClient = useQueryClient();
  const { appointmentId } = route.params;

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  // Fetch appointment
  const { data, isLoading, error } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => appointmentsApi.get(appointmentId),
  });

  const appointment: Appointment | undefined = data?.data?.data?.appointment;

  // Mutations
  const confirmMutation = useMutation({
    mutationFn: () => appointmentsApi.confirm(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: () => appointmentsApi.checkIn(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const startMutation = useMutation({
    mutationFn: () => appointmentsApi.start(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => appointmentsApi.complete(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => appointmentsApi.cancel(appointmentId, reason),
    onSuccess: () => {
      setShowCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: () => appointmentsApi.noShow(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleCall = () => {
    if (appointment?.clientInfo.phone) {
      Linking.openURL(`tel:${appointment.clientInfo.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (appointment?.clientInfo.phone) {
      const phone = appointment.clientInfo.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}`);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Turno',
      '¿Estás seguro que deseas cancelar este turno?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', style: 'destructive', onPress: () => setShowCancelModal(true) },
      ]
    );
  };

  const handleNoShow = () => {
    Alert.alert(
      'Marcar como No Asistió',
      '¿El cliente no se presentó a su turno?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => noShowMutation.mutate() },
      ]
    );
  };

  const getAvailableActions = () => {
    if (!appointment) return [];

    const actions: { label: string; icon: string; onPress: () => void; color?: string }[] = [];

    switch (appointment.status) {
      case 'pending':
        actions.push({
          label: 'Confirmar',
          icon: 'check',
          onPress: () => confirmMutation.mutate(),
        });
        actions.push({
          label: 'Cancelar',
          icon: 'close',
          onPress: handleCancel,
          color: colors.error,
        });
        break;
      case 'confirmed':
        actions.push({
          label: 'Check-in',
          icon: 'account-check',
          onPress: () => checkInMutation.mutate(),
        });
        actions.push({
          label: 'No Asistió',
          icon: 'account-off',
          onPress: handleNoShow,
          color: colors.warning,
        });
        actions.push({
          label: 'Cancelar',
          icon: 'close',
          onPress: handleCancel,
          color: colors.error,
        });
        break;
      case 'checked_in':
        actions.push({
          label: 'Iniciar',
          icon: 'play',
          onPress: () => startMutation.mutate(),
        });
        actions.push({
          label: 'No Asistió',
          icon: 'account-off',
          onPress: handleNoShow,
          color: colors.warning,
        });
        break;
      case 'in_progress':
        actions.push({
          label: 'Completar',
          icon: 'check-circle',
          onPress: () => completeMutation.mutate(),
        });
        break;
    }

    return actions;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !appointment) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={64} color={colors.error} />
        <Text variant="titleMedium" style={styles.errorText}>
          No se pudo cargar el turno
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Volver
        </Button>
      </View>
    );
  }

  const actions = getAvailableActions();
  const isPast = ['completed', 'cancelled', 'no_show'].includes(appointment.status);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Status Header */}
        <View
          style={[
            styles.statusHeader,
            { backgroundColor: getStatusColor(appointment.status) + '15' },
          ]}
        >
          <Chip
            style={[
              styles.statusChip,
              { backgroundColor: getStatusColor(appointment.status) },
            ]}
            textStyle={styles.statusChipText}
          >
            {getStatusLabel(appointment.status)}
          </Chip>
          <Text variant="headlineSmall" style={styles.dateTimeText}>
            {format(parseISO(appointment.startDateTime), "EEEE d 'de' MMMM", { locale: es })}
          </Text>
          <Text variant="displaySmall" style={styles.timeText}>
            {appointment.startTime} - {appointment.endTime}
          </Text>
        </View>

        {/* Client Info */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="account" size={20} color={colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Cliente
              </Text>
            </View>
            <View style={styles.clientRow}>
              <Avatar.Text
                size={48}
                label={appointment.clientInfo.name.charAt(0).toUpperCase()}
                style={{ backgroundColor: colors.primary + '30' }}
                labelStyle={{ color: colors.primary }}
              />
              <View style={styles.clientInfo}>
                <Text variant="titleMedium">{appointment.clientInfo.name}</Text>
                {appointment.clientInfo.phone && (
                  <Text variant="bodyMedium" style={styles.clientSubtext}>
                    {appointment.clientInfo.phone}
                  </Text>
                )}
                {appointment.clientInfo.email && (
                  <Text variant="bodySmall" style={styles.clientSubtext}>
                    {appointment.clientInfo.email}
                  </Text>
                )}
              </View>
              <View style={styles.clientActions}>
                {appointment.clientInfo.phone && (
                  <>
                    <IconButton
                      icon="phone"
                      mode="contained-tonal"
                      size={20}
                      onPress={handleCall}
                    />
                    <IconButton
                      icon="whatsapp"
                      mode="contained-tonal"
                      size={20}
                      onPress={handleWhatsApp}
                      iconColor="#25D366"
                    />
                  </>
                )}
              </View>
            </View>
            {appointment.clientId && (
              <Button
                mode="text"
                icon="account-details"
                onPress={() => navigation.navigate('ClientDetail', { clientId: appointment.clientId! })}
                style={styles.viewClientButton}
              >
                Ver perfil del cliente
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Services */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="tag" size={20} color={colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Servicios
              </Text>
            </View>
            {appointment.services.map((service, index) => (
              <View key={service.serviceId} style={styles.serviceRow}>
                <View style={styles.serviceInfo}>
                  <Text variant="bodyLarge">{service.name}</Text>
                  <Text variant="bodySmall" style={styles.serviceDuration}>
                    {service.duration} min
                  </Text>
                </View>
                <View style={styles.servicePriceContainer}>
                  {service.discount > 0 && (
                    <Text variant="bodySmall" style={styles.serviceOriginalPrice}>
                      ${service.price + service.discount}
                    </Text>
                  )}
                  <Text variant="titleMedium" style={styles.servicePrice}>
                    ${service.price}
                  </Text>
                </View>
              </View>
            ))}
            <Divider style={styles.divider} />
            <View style={styles.pricingRow}>
              <Text variant="bodyMedium">Subtotal</Text>
              <Text variant="bodyMedium">${appointment.pricing.subtotal}</Text>
            </View>
            {appointment.pricing.discount > 0 && (
              <View style={styles.pricingRow}>
                <Text variant="bodyMedium" style={styles.discountText}>
                  Descuento {appointment.pricing.discountCode && `(${appointment.pricing.discountCode})`}
                </Text>
                <Text variant="bodyMedium" style={styles.discountText}>
                  -${appointment.pricing.discount}
                </Text>
              </View>
            )}
            <View style={styles.pricingRow}>
              <Text variant="titleMedium" style={styles.totalLabel}>Total</Text>
              <Text variant="titleLarge" style={styles.totalAmount}>
                ${appointment.pricing.total}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Staff */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="account-tie" size={20} color={colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Profesional
              </Text>
            </View>
            <View style={styles.staffRow}>
              {appointment.staff?.profile.avatar ? (
                <Avatar.Image size={40} source={{ uri: appointment.staff.profile.avatar }} />
              ) : (
                <Avatar.Text
                  size={40}
                  label={appointment.staffInfo.name.split(' ').map(n => n.charAt(0)).join('')}
                  style={{ backgroundColor: colors.secondary + '30' }}
                  labelStyle={{ color: colors.secondary }}
                />
              )}
              <Text variant="bodyLarge" style={styles.staffName}>
                {appointment.staffInfo.name}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Payment */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="cash" size={20} color={colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Pago
              </Text>
            </View>
            <View style={styles.paymentRow}>
              <Text variant="bodyMedium">Estado</Text>
              <Chip
                compact
                style={[
                  styles.paymentChip,
                  {
                    backgroundColor:
                      appointment.payment.status === 'paid'
                        ? colors.successLight
                        : appointment.payment.status === 'refunded'
                        ? colors.errorLight
                        : colors.warningLight,
                  },
                ]}
                textStyle={{
                  color:
                    appointment.payment.status === 'paid'
                      ? colors.success
                      : appointment.payment.status === 'refunded'
                      ? colors.error
                      : colors.warning,
                  fontSize: 12,
                }}
              >
                {PAYMENT_STATUS_LABELS[appointment.payment.status]}
              </Chip>
            </View>
            {appointment.payment.method && (
              <View style={styles.paymentRow}>
                <Text variant="bodyMedium">Método</Text>
                <Text variant="bodyMedium">
                  {PAYMENT_METHOD_LABELS[appointment.payment.method] || appointment.payment.method}
                </Text>
              </View>
            )}
            {appointment.payment.paidAmount > 0 && (
              <View style={styles.paymentRow}>
                <Text variant="bodyMedium">Monto pagado</Text>
                <Text variant="bodyMedium">${appointment.payment.paidAmount}</Text>
              </View>
            )}
            {appointment.pricing.deposit > 0 && (
              <View style={styles.paymentRow}>
                <Text variant="bodyMedium">Seña</Text>
                <View style={styles.depositStatus}>
                  <Text variant="bodyMedium">${appointment.pricing.deposit}</Text>
                  <Icon
                    name={appointment.pricing.depositPaid ? 'check-circle' : 'clock-outline'}
                    size={16}
                    color={appointment.pricing.depositPaid ? colors.success : colors.warning}
                    style={styles.depositIcon}
                  />
                </View>
              </View>
            )}
            {!isPast && appointment.payment.status !== 'paid' && (
              <Button
                mode="contained"
                icon="cash-register"
                onPress={() => navigation.navigate('CollectPayment', { appointmentId })}
                style={styles.collectButton}
              >
                Cobrar
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Notes */}
        {(appointment.notes.client || appointment.notes.business || appointment.notes.staff) && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <Icon name="note-text" size={20} color={colors.primary} />
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Notas
                </Text>
              </View>
              {appointment.notes.client && (
                <View style={styles.noteItem}>
                  <Text variant="labelMedium" style={styles.noteLabel}>
                    Del cliente:
                  </Text>
                  <Text variant="bodyMedium">{appointment.notes.client}</Text>
                </View>
              )}
              {appointment.notes.business && (
                <View style={styles.noteItem}>
                  <Text variant="labelMedium" style={styles.noteLabel}>
                    Del negocio:
                  </Text>
                  <Text variant="bodyMedium">{appointment.notes.business}</Text>
                </View>
              )}
              {appointment.notes.staff && (
                <View style={styles.noteItem}>
                  <Text variant="labelMedium" style={styles.noteLabel}>
                    Del profesional:
                  </Text>
                  <Text variant="bodyMedium">{appointment.notes.staff}</Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Cancellation Info */}
        {appointment.cancellation && (
          <Card style={[styles.card, styles.cancellationCard]}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <Icon name="cancel" size={20} color={colors.error} />
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.error }]}>
                  Cancelación
                </Text>
              </View>
              <View style={styles.cancellationRow}>
                <Text variant="bodyMedium">Cancelado por</Text>
                <Text variant="bodyMedium">
                  {appointment.cancellation.cancelledBy === 'client' ? 'Cliente' : 'Negocio'}
                </Text>
              </View>
              <View style={styles.cancellationRow}>
                <Text variant="bodyMedium">Fecha</Text>
                <Text variant="bodyMedium">
                  {format(parseISO(appointment.cancellation.cancelledAt), "d/M/yyyy HH:mm")}
                </Text>
              </View>
              {appointment.cancellation.reason && (
                <View style={styles.cancellationRow}>
                  <Text variant="bodyMedium">Motivo</Text>
                  <Text variant="bodyMedium" style={styles.cancellationReason}>
                    {appointment.cancellation.reason}
                  </Text>
                </View>
              )}
              {appointment.cancellation.refunded && (
                <View style={styles.cancellationRow}>
                  <Text variant="bodyMedium">Reembolso</Text>
                  <Text variant="bodyMedium" style={styles.refundAmount}>
                    ${appointment.cancellation.refundAmount}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Info Footer */}
        <View style={styles.infoFooter}>
          <View style={styles.infoItem}>
            <Text variant="labelSmall" style={styles.infoLabel}>Fuente</Text>
            <Text variant="bodySmall">{SOURCE_LABELS[appointment.source] || appointment.source}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text variant="labelSmall" style={styles.infoLabel}>Creado</Text>
            <Text variant="bodySmall">
              {format(parseISO(appointment.createdAt), "d/M/yyyy HH:mm")}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      {actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {actions.slice(0, 2).map((action, index) => (
            <Button
              key={index}
              mode={index === 0 ? 'contained' : 'outlined'}
              icon={action.icon}
              onPress={action.onPress}
              style={[styles.actionButton, index > 0 && { borderColor: action.color || colors.primary }]}
              textColor={index > 0 ? action.color || colors.primary : undefined}
              buttonColor={index === 0 ? action.color || colors.primary : undefined}
              loading={
                confirmMutation.isPending ||
                checkInMutation.isPending ||
                startMutation.isPending ||
                completeMutation.isPending
              }
            >
              {action.label}
            </Button>
          ))}
          {actions.length > 2 && (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  mode="contained-tonal"
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              {actions.slice(2).map((action, index) => (
                <Menu.Item
                  key={index}
                  leadingIcon={action.icon}
                  onPress={() => {
                    setMenuVisible(false);
                    action.onPress();
                  }}
                  title={action.label}
                  titleStyle={action.color ? { color: action.color } : undefined}
                />
              ))}
            </Menu>
          )}
        </View>
      )}

      {/* Cancel Modal */}
      <Portal>
        <Modal
          visible={showCancelModal}
          onDismiss={() => setShowCancelModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Cancelar Turno
          </Text>
          <TextInput
            label="Motivo de cancelación (opcional)"
            value={cancelReason}
            onChangeText={setCancelReason}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.cancelInput}
          />
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowCancelModal(false)}
              style={styles.modalButton}
            >
              Volver
            </Button>
            <Button
              mode="contained"
              onPress={() => cancelMutation.mutate(cancelReason || undefined)}
              loading={cancelMutation.isPending}
              buttonColor={colors.error}
              style={styles.modalButton}
            >
              Confirmar Cancelación
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
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
    padding: spacing.lg,
  },
  errorText: {
    color: colors.textSecondary,
    marginVertical: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  statusHeader: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  statusChip: {
    marginBottom: spacing.sm,
  },
  statusChipText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  dateTimeText: {
    textTransform: 'capitalize',
    marginBottom: spacing.xs,
  },
  timeText: {
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  clientSubtext: {
    color: colors.textSecondary,
  },
  clientActions: {
    flexDirection: 'row',
  },
  viewClientButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceDuration: {
    color: colors.textSecondary,
  },
  servicePriceContainer: {
    alignItems: 'flex-end',
  },
  serviceOriginalPrice: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  servicePrice: {
    color: colors.primary,
    fontWeight: '600',
  },
  divider: {
    marginVertical: spacing.sm,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  discountText: {
    color: colors.success,
  },
  totalLabel: {
    fontWeight: '600',
  },
  totalAmount: {
    fontWeight: '700',
    color: colors.primary,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffName: {
    marginLeft: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  paymentChip: {
    height: 24,
  },
  depositStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  depositIcon: {
    marginLeft: spacing.xs,
  },
  collectButton: {
    marginTop: spacing.md,
  },
  noteItem: {
    marginBottom: spacing.sm,
  },
  noteLabel: {
    color: colors.textSecondary,
    marginBottom: 2,
  },
  cancellationCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  cancellationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  cancellationReason: {
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  refundAmount: {
    color: colors.success,
    fontWeight: '600',
  },
  infoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    color: colors.textTertiary,
    marginBottom: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  cancelInput: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

export default AppointmentDetailScreen;
