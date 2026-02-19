import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  Searchbar,
  ActivityIndicator,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { financesApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo', icon: 'cash' },
  { value: 'card', label: 'Tarjeta', icon: 'credit-card' },
  { value: 'mercadopago', label: 'MercadoPago', icon: 'cellphone' },
  { value: 'transfer', label: 'Transferencia', icon: 'bank-transfer' },
] as const;

interface PendingAppointment {
  _id: string;
  clientInfo: { name: string; phone?: string; email?: string };
  staffInfo: { name: string };
  services: { name: string; price: number; duration: number }[];
  date: string;
  startTime: string;
  endTime: string;
  pricing: {
    subtotal: number;
    discount: number;
    deposit: number;
    depositPaid: boolean;
    total: number;
    finalTotal: number;
  };
  status: string;
}

export const CollectPaymentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const currentBusiness = useCurrentBusiness();
  const queryClient = useQueryClient();

  const preSelectedId = route.params?.appointmentId;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<PendingAppointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [tip, setTip] = useState('');

  const { data: pendingData, isLoading, refetch } = useQuery({
    queryKey: ['pending-appointments', currentBusiness?.businessId],
    queryFn: () => financesApi.getPendingAppointments(),
    enabled: !!currentBusiness,
  });

  const appointments: PendingAppointment[] = pendingData?.data?.data?.appointments || [];

  // Auto-select if navigated with an appointmentId
  React.useEffect(() => {
    if (preSelectedId && appointments.length > 0 && !selectedAppointment) {
      const found = appointments.find((a) => a._id === preSelectedId);
      if (found) setSelectedAppointment(found);
    }
  }, [preSelectedId, appointments, selectedAppointment]);

  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments;
    const q = searchQuery.toLowerCase();
    return appointments.filter(
      (a) =>
        a.clientInfo.name.toLowerCase().includes(q) ||
        a.services.some((s) => s.name.toLowerCase().includes(q)) ||
        a.staffInfo.name.toLowerCase().includes(q),
    );
  }, [appointments, searchQuery]);

  const checkoutMutation = useMutation({
    mutationFn: (data: { appointmentId: string; paymentMethod: string; tip: number }) =>
      financesApi.checkout(data.appointmentId, { paymentMethod: data.paymentMethod, tip: data.tip }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finances-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-appointments'] });
      Alert.alert('Pago registrado', 'El cobro se realiz\u00f3 exitosamente.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo procesar el cobro');
    },
  });

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

  const handleCollect = () => {
    if (!selectedAppointment) return;

    const tipAmount = parseFloat(tip) || 0;
    const totalToPay = selectedAppointment.pricing.finalTotal
      - (selectedAppointment.pricing.depositPaid ? selectedAppointment.pricing.deposit : 0)
      + tipAmount;

    Alert.alert(
      'Confirmar cobro',
      `Cliente: ${selectedAppointment.clientInfo.name}\nTotal a cobrar: ${formatCurrency(totalToPay)}\nM\u00e9todo: ${PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cobrar',
          onPress: () => {
            checkoutMutation.mutate({
              appointmentId: selectedAppointment._id,
              paymentMethod,
              tip: tipAmount,
            });
          },
        },
      ],
    );
  };

  const renderAppointmentCard = ({ item }: { item: PendingAppointment }) => {
    const isSelected = selectedAppointment?._id === item._id;
    const appointmentDate = new Date(item.date);

    return (
      <Card
        style={[styles.appointmentCard, isSelected && styles.selectedCard]}
        onPress={() => setSelectedAppointment(isSelected ? null : item)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.clientInfo}>
              <Text variant="titleSmall" style={styles.clientName}>
                {item.clientInfo.name}
              </Text>
              <Text variant="bodySmall" style={styles.dateText}>
                {format(appointmentDate, "d 'de' MMM", { locale: es })} \u00b7 {item.startTime} - {item.endTime}
              </Text>
            </View>
            <Text variant="titleMedium" style={styles.priceText}>
              {formatCurrency(item.pricing.finalTotal)}
            </Text>
          </View>

          <View style={styles.servicesRow}>
            {item.services.map((service, idx) => (
              <Chip key={idx} compact style={styles.serviceChip} textStyle={styles.serviceChipText}>
                {service.name}
              </Chip>
            ))}
          </View>

          <View style={styles.staffRow}>
            <Icon name="account" size={14} color={colors.textSecondary} />
            <Text variant="bodySmall" style={styles.staffName}>
              {item.staffInfo.name}
            </Text>
            {item.pricing.depositPaid && (
              <Chip compact style={styles.depositChip} textStyle={styles.depositChipText}>
                Se\u00f1a: {formatCurrency(item.pricing.deposit)}
              </Chip>
            )}
          </View>

          {isSelected && (
            <Icon name="check-circle" size={24} color={colors.primary} style={styles.checkIcon} />
          )}
        </Card.Content>
      </Card>
    );
  };

  // Payment details view when appointment is selected
  if (selectedAppointment) {
    const tipAmount = parseFloat(tip) || 0;
    const depositCredit = selectedAppointment.pricing.depositPaid
      ? selectedAppointment.pricing.deposit
      : 0;
    const remaining = selectedAppointment.pricing.finalTotal - depositCredit + tipAmount;

    return (
      <View style={styles.container}>
        <View style={styles.selectedHeader}>
          <Button
            mode="text"
            icon="arrow-left"
            onPress={() => setSelectedAppointment(null)}
            compact
          >
            Volver a la lista
          </Button>
        </View>

        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {/* Client & Service Summary */}
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Detalle del turno
                  </Text>
                  <View style={styles.detailRow}>
                    <Icon name="account" size={20} color={colors.textSecondary} />
                    <Text variant="bodyMedium" style={styles.detailText}>
                      {selectedAppointment.clientInfo.name}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="calendar" size={20} color={colors.textSecondary} />
                    <Text variant="bodyMedium" style={styles.detailText}>
                      {format(new Date(selectedAppointment.date), "EEEE d 'de' MMMM", { locale: es })} \u00b7 {selectedAppointment.startTime}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="account-hard-hat" size={20} color={colors.textSecondary} />
                    <Text variant="bodyMedium" style={styles.detailText}>
                      {selectedAppointment.staffInfo.name}
                    </Text>
                  </View>

                  <Divider style={styles.divider} />

                  {selectedAppointment.services.map((service, idx) => (
                    <View key={idx} style={styles.serviceDetailRow}>
                      <Text variant="bodyMedium">{service.name}</Text>
                      <Text variant="bodyMedium" style={styles.servicePrice}>
                        {formatCurrency(service.price)}
                      </Text>
                    </View>
                  ))}

                  <Divider style={styles.divider} />

                  <View style={styles.pricingRow}>
                    <Text variant="bodyMedium">Subtotal</Text>
                    <Text variant="bodyMedium">{formatCurrency(selectedAppointment.pricing.subtotal)}</Text>
                  </View>
                  {selectedAppointment.pricing.discount > 0 && (
                    <View style={styles.pricingRow}>
                      <Text variant="bodyMedium" style={{ color: colors.success }}>Descuento</Text>
                      <Text variant="bodyMedium" style={{ color: colors.success }}>
                        -{formatCurrency(selectedAppointment.pricing.discount)}
                      </Text>
                    </View>
                  )}
                  {depositCredit > 0 && (
                    <View style={styles.pricingRow}>
                      <Text variant="bodyMedium" style={{ color: colors.info }}>Se\u00f1a abonada</Text>
                      <Text variant="bodyMedium" style={{ color: colors.info }}>
                        -{formatCurrency(depositCredit)}
                      </Text>
                    </View>
                  )}
                  {tipAmount > 0 && (
                    <View style={styles.pricingRow}>
                      <Text variant="bodyMedium">Propina</Text>
                      <Text variant="bodyMedium">+{formatCurrency(tipAmount)}</Text>
                    </View>
                  )}
                  <Divider style={styles.divider} />
                  <View style={styles.pricingRow}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>A cobrar</Text>
                    <Text variant="titleLarge" style={styles.totalPrice}>
                      {formatCurrency(remaining)}
                    </Text>
                  </View>
                </Card.Content>
              </Card>

              {/* Payment method */}
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    M\u00e9todo de pago
                  </Text>
                  <View style={styles.paymentGrid}>
                    {PAYMENT_METHODS.map((method) => (
                      <Button
                        key={method.value}
                        mode={paymentMethod === method.value ? 'contained' : 'outlined'}
                        icon={method.icon}
                        onPress={() => setPaymentMethod(method.value)}
                        style={styles.paymentButton}
                        compact
                      >
                        {method.label}
                      </Button>
                    ))}
                  </View>
                </Card.Content>
              </Card>

              {/* Tip */}
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Propina (opcional)
                  </Text>
                  <View style={styles.tipRow}>
                    {[0, 100, 200, 500].map((amount) => (
                      <Chip
                        key={amount}
                        selected={tip === (amount === 0 ? '' : String(amount))}
                        onPress={() => setTip(amount === 0 ? '' : String(amount))}
                        style={styles.tipChip}
                      >
                        {amount === 0 ? 'Sin propina' : formatCurrency(amount)}
                      </Chip>
                    ))}
                  </View>
                </Card.Content>
              </Card>
            </>
          }
          contentContainerStyle={styles.scrollContent}
        />

        {/* Collect button */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleCollect}
            loading={checkoutMutation.isPending}
            disabled={checkoutMutation.isPending}
            style={styles.collectButton}
            icon="cash-register"
            contentStyle={styles.collectButtonContent}
          >
            Cobrar {formatCurrency(remaining)}
          </Button>
        </View>
      </View>
    );
  }

  // Appointment list view
  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar cliente o servicio..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item._id}
          renderItem={renderAppointmentCard}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="calendar-check" size={64} color={colors.textTertiary} />
              <Text variant="titleMedium" style={styles.emptyTitle}>
                Sin turnos pendientes de cobro
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtitle}>
                Los turnos completados o en proceso aparecer\u00e1n aqu\u00ed para cobrar
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  searchbar: {
    margin: spacing.md,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.xl * 2,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  selectedHeader: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  appointmentCard: {
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  selectedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontWeight: '600',
  },
  dateText: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceText: {
    fontWeight: '700',
    color: colors.success,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  serviceChip: {
    backgroundColor: colors.surfaceVariant,
    height: 28,
  },
  serviceChipText: {
    fontSize: 12,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  staffName: {
    color: colors.textSecondary,
    flex: 1,
  },
  depositChip: {
    backgroundColor: colors.infoLight,
    height: 24,
  },
  depositChipText: {
    fontSize: 11,
    color: colors.info,
  },
  checkIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  card: {
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailText: {
    flex: 1,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  serviceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  servicePrice: {
    fontWeight: '500',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  totalPrice: {
    fontWeight: '700',
    color: colors.success,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentButton: {
    flex: 1,
    minWidth: '45%',
  },
  tipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tipChip: {
    marginBottom: spacing.xs,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  collectButton: {
    backgroundColor: colors.success,
  },
  collectButtonContent: {
    paddingVertical: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default CollectPaymentScreen;
