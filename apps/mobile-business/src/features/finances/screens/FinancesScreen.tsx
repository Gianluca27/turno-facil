import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import {
  Text,
  Card,
  SegmentedButtons,
  ActivityIndicator,
  Chip,
  Divider,
  FAB,
  Portal,
  Modal,
  Button,
  List,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';

import { financesApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

type Period = 'today' | 'week' | 'month';

interface Transaction {
  _id: string;
  type: 'payment' | 'sale' | 'refund' | 'deposit' | 'expense';
  amount: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  description?: string;
  clientName?: string;
  createdAt: string;
}

interface FinanceSummary {
  totalRevenue: number;
  totalTransactions: number;
  averageTicket: number;
  paymentMethods: { method: string; amount: number; count: number }[];
  revenueByDay: { date: string; amount: number }[];
}

const PAYMENT_METHODS: Record<string, { label: string; icon: string }> = {
  cash: { label: 'Efectivo', icon: 'cash' },
  card: { label: 'Tarjeta', icon: 'credit-card' },
  mercadopago: { label: 'MercadoPago', icon: 'cellphone' },
  transfer: { label: 'Transferencia', icon: 'bank-transfer' },
  other: { label: 'Otro', icon: 'dots-horizontal' },
};

const TRANSACTION_TYPES: Record<string, { label: string; color: string }> = {
  payment: { label: 'Pago', color: colors.success },
  sale: { label: 'Venta', color: colors.success },
  refund: { label: 'Reembolso', color: colors.error },
  deposit: { label: 'Depósito', color: colors.primary },
  expense: { label: 'Gasto', color: colors.warning },
};

export const FinancesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const currentBusiness = useCurrentBusiness();
  const [period, setPeriod] = useState<Period>('today');
  const [showPOSModal, setShowPOSModal] = useState(false);

  const getDateRange = () => {
    const today = new Date();
    switch (period) {
      case 'today':
        return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'week':
        return {
          from: format(startOfWeek(today, { locale: es }), 'yyyy-MM-dd'),
          to: format(endOfWeek(today, { locale: es }), 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          from: format(startOfMonth(today), 'yyyy-MM-dd'),
          to: format(endOfMonth(today), 'yyyy-MM-dd'),
        };
    }
  };

  const dateRange = getDateRange();

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['finances-summary', currentBusiness?.businessId, dateRange],
    queryFn: () => financesApi.getSummary(dateRange.from, dateRange.to),
    enabled: !!currentBusiness,
  });

  const { data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['finances-transactions', currentBusiness?.businessId, dateRange],
    queryFn: () => financesApi.getTransactions({ ...dateRange, limit: 10 }),
    enabled: !!currentBusiness,
  });

  const summary: FinanceSummary = summaryData?.data?.data || {
    totalRevenue: 0,
    totalTransactions: 0,
    averageTicket: 0,
    paymentMethods: [],
    revenueByDay: [],
  };

  const transactions: Transaction[] = transactionsData?.data?.data?.transactions || [];

  const isLoading = summaryLoading || transactionsLoading;

  const refetch = () => {
    refetchSummary();
    refetchTransactions();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <Card style={styles.mainSummaryCard}>
        <Card.Content>
          <View style={styles.mainSummaryHeader}>
            <Icon name="cash-multiple" size={32} color={colors.success} />
            <Text variant="labelLarge" style={styles.summaryLabel}>
              Ingresos Totales
            </Text>
          </View>
          <Text variant="displaySmall" style={styles.summaryAmount}>
            {formatCurrency(summary.totalRevenue)}
          </Text>
          <Text variant="bodySmall" style={styles.periodText}>
            {period === 'today' ? 'Hoy' : period === 'week' ? 'Esta semana' : 'Este mes'}
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Icon name="receipt" size={24} color={colors.primary} />
            <Text variant="headlineSmall" style={styles.statNumber}>
              {summary.totalTransactions}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>
              Transacciones
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Icon name="chart-line" size={24} color={colors.secondary} />
            <Text variant="headlineSmall" style={styles.statNumber}>
              {formatCurrency(summary.averageTicket)}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>
              Ticket Promedio
            </Text>
          </Card.Content>
        </Card>
      </View>
    </View>
  );

  const renderPaymentMethods = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Métodos de Pago
        </Text>
        {summary.paymentMethods.length > 0 ? (
          summary.paymentMethods.map((method) => {
            const methodInfo = PAYMENT_METHODS[method.method] || PAYMENT_METHODS.other;
            const percentage = summary.totalRevenue > 0
              ? ((method.amount / summary.totalRevenue) * 100).toFixed(0)
              : 0;
            return (
              <View key={method.method} style={styles.methodRow}>
                <View style={styles.methodInfo}>
                  <Icon name={methodInfo.icon} size={20} color={colors.textSecondary} />
                  <Text variant="bodyMedium" style={styles.methodName}>
                    {methodInfo.label}
                  </Text>
                </View>
                <View style={styles.methodStats}>
                  <Text variant="bodySmall" style={styles.methodPercentage}>
                    {percentage}%
                  </Text>
                  <Text variant="bodyMedium" style={styles.methodAmount}>
                    {formatCurrency(method.amount)}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text variant="bodyMedium" style={styles.noDataText}>
            Sin datos para este período
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderRecentTransactions = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Últimas Transacciones
          </Text>
          <Button
            mode="text"
            compact
            onPress={() => navigation.navigate('TransactionHistory')}
          >
            Ver todas
          </Button>
        </View>

        {transactions.length > 0 ? (
          transactions.map((transaction, index) => {
            const typeInfo = TRANSACTION_TYPES[transaction.type] || TRANSACTION_TYPES.payment;
            const isNegative = ['refund', 'expense'].includes(transaction.type);
            return (
              <View key={transaction._id}>
                {index > 0 && <Divider style={styles.transactionDivider} />}
                <View style={styles.transactionRow}>
                  <View style={[styles.transactionIcon, { backgroundColor: typeInfo.color + '20' }]}>
                    <Icon
                      name={isNegative ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={typeInfo.color}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text variant="bodyMedium" numberOfLines={1}>
                      {transaction.clientName || transaction.description || typeInfo.label}
                    </Text>
                    <Text variant="bodySmall" style={styles.transactionTime}>
                      {format(new Date(transaction.createdAt), "HH:mm 'hs'", { locale: es })}
                    </Text>
                  </View>
                  <Text
                    variant="bodyMedium"
                    style={[styles.transactionAmount, { color: typeInfo.color }]}
                  >
                    {isNegative ? '-' : '+'}{formatCurrency(transaction.amount)}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text variant="bodyMedium" style={styles.noDataText}>
            Sin transacciones para este período
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderPOSModal = () => (
    <Portal>
      <Modal
        visible={showPOSModal}
        onDismiss={() => setShowPOSModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          Punto de Venta
        </Text>
        <Text variant="bodyMedium" style={styles.modalSubtitle}>
          ¿Qué acción deseas realizar?
        </Text>

        <List.Item
          title="Nueva Venta"
          description="Registrar una venta de productos o servicios"
          left={(props) => <List.Icon {...props} icon="cart-plus" color={colors.success} />}
          onPress={() => {
            setShowPOSModal(false);
            navigation.navigate('NewSale');
          }}
          style={styles.modalItem}
        />
        <List.Item
          title="Cobrar Turno"
          description="Cobrar un turno completado"
          left={(props) => <List.Icon {...props} icon="calendar-check" color={colors.primary} />}
          onPress={() => {
            setShowPOSModal(false);
            navigation.navigate('CollectPayment');
          }}
          style={styles.modalItem}
        />
        <List.Item
          title="Registrar Gasto"
          description="Agregar un gasto del negocio"
          left={(props) => <List.Icon {...props} icon="cash-minus" color={colors.warning} />}
          onPress={() => {
            setShowPOSModal(false);
            navigation.navigate('RegisterExpense');
          }}
          style={styles.modalItem}
        />
        <List.Item
          title="Apertura/Cierre de Caja"
          description="Gestionar la caja registradora"
          left={(props) => <List.Icon {...props} icon="cash-register" color={colors.secondary} />}
          onPress={() => {
            setShowPOSModal(false);
            navigation.navigate('CashRegister');
          }}
          style={styles.modalItem}
        />

        <Button
          mode="outlined"
          onPress={() => setShowPOSModal(false)}
          style={styles.modalCancelButton}
        >
          Cancelar
        </Button>
      </Modal>
    </Portal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        contentContainerStyle={styles.scrollContent}
      >
        <SegmentedButtons
          value={period}
          onValueChange={(value) => setPeriod(value as Period)}
          buttons={[
            { value: 'today', label: 'Hoy' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
          ]}
          style={styles.segmentedButtons}
        />

        {renderSummaryCards()}
        {renderPaymentMethods()}
        {renderRecentTransactions()}

        <Card style={styles.quickActionsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Acciones Rápidas
            </Text>
            <View style={styles.quickActionsGrid}>
              <Button
                mode="outlined"
                icon="file-chart"
                onPress={() => navigation.navigate('FinanceReports')}
                style={styles.quickActionButton}
              >
                Reportes
              </Button>
              <Button
                mode="outlined"
                icon="history"
                onPress={() => navigation.navigate('TransactionHistory')}
                style={styles.quickActionButton}
              >
                Historial
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {renderPOSModal()}

      <FAB
        icon="cash-register"
        style={styles.fab}
        onPress={() => setShowPOSModal(true)}
        label="POS"
      />
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  segmentedButtons: {
    marginBottom: spacing.md,
  },
  summaryContainer: {
    marginBottom: spacing.md,
  },
  mainSummaryCard: {
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  mainSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    color: colors.textSecondary,
  },
  summaryAmount: {
    fontWeight: '700',
    color: colors.success,
  },
  periodText: {
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statNumber: {
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  statLabel: {
    color: colors.textSecondary,
  },
  sectionCard: {
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodName: {
    color: colors.text,
  },
  methodStats: {
    alignItems: 'flex-end',
  },
  methodPercentage: {
    color: colors.textSecondary,
  },
  methodAmount: {
    fontWeight: '600',
  },
  noDataText: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  transactionDivider: {
    marginVertical: spacing.xs,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTime: {
    color: colors.textSecondary,
  },
  transactionAmount: {
    fontWeight: '600',
  },
  quickActionsCard: {
    backgroundColor: colors.background,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    borderRadius: 12,
    padding: spacing.lg,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalItem: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  modalCancelButton: {
    marginTop: spacing.sm,
  },
});

export default FinancesScreen;
