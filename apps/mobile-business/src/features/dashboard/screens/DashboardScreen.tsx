import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { dashboardApi } from '../../../services/api';
import { colors, spacing, getStatusColor, getStatusLabel } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

export const DashboardScreen: React.FC = () => {
  const currentBusiness = useCurrentBusiness();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['dashboard', currentBusiness?.businessId],
    queryFn: () => dashboardApi.getOverview(),
    enabled: !!currentBusiness,
  });

  const dashboard = data?.data?.data;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Today's Summary */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Resumen de Hoy
          </Text>
          <Text variant="bodySmall" style={styles.dateText}>
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Icon name="calendar-check" size={24} color={colors.primary} />
              <Text variant="headlineMedium" style={styles.statNumber}>
                {dashboard?.today?.total || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Turnos
              </Text>
            </View>

            <View style={styles.statItem}>
              <Icon name="check-circle" size={24} color={colors.success} />
              <Text variant="headlineMedium" style={styles.statNumber}>
                {dashboard?.today?.completed || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Completados
              </Text>
            </View>

            <View style={styles.statItem}>
              <Icon name="clock-outline" size={24} color={colors.warning} />
              <Text variant="headlineMedium" style={styles.statNumber}>
                {dashboard?.today?.pending || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Pendientes
              </Text>
            </View>

            <View style={styles.statItem}>
              <Icon name="cash" size={24} color={colors.secondary} />
              <Text variant="headlineMedium" style={styles.statNumber}>
                ${dashboard?.today?.revenue || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Ingresos
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Upcoming Appointments */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Próximos Turnos
          </Text>
          <Button mode="text" compact>
            Ver todos
          </Button>
        </View>

        {dashboard?.upcoming?.length > 0 ? (
          dashboard.upcoming.map((appointment: any) => (
            <Card key={appointment._id} style={styles.appointmentCard}>
              <Card.Content style={styles.appointmentContent}>
                <View style={styles.appointmentTime}>
                  <Text variant="titleLarge" style={styles.timeText}>
                    {appointment.startTime}
                  </Text>
                  <Text variant="bodySmall" style={styles.endTimeText}>
                    - {appointment.endTime}
                  </Text>
                </View>

                <View style={styles.appointmentInfo}>
                  <Text variant="titleMedium" numberOfLines={1}>
                    {appointment.clientInfo?.name}
                  </Text>
                  <Text variant="bodyMedium" style={styles.serviceText} numberOfLines={1}>
                    {appointment.services?.map((s: any) => s.name).join(', ')}
                  </Text>
                  <Text variant="bodySmall" style={styles.staffText}>
                    {appointment.staffInfo?.name}
                  </Text>
                </View>

                <Chip
                  style={[
                    styles.statusChip,
                    { backgroundColor: getStatusColor(appointment.status) + '20' },
                  ]}
                  textStyle={{ color: getStatusColor(appointment.status), fontSize: 11 }}
                  compact
                >
                  {getStatusLabel(appointment.status)}
                </Chip>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Icon name="calendar-blank" size={48} color={colors.textTertiary} />
              <Text variant="bodyMedium" style={styles.emptyText}>
                No hay turnos próximos
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Acciones Rápidas
        </Text>

        <View style={styles.actionsGrid}>
          <Button
            mode="outlined"
            icon="plus"
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            onPress={() => {}}
          >
            Nuevo Turno
          </Button>

          <Button
            mode="outlined"
            icon="account-plus"
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            onPress={() => {}}
          >
            Nuevo Cliente
          </Button>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  content: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  cardTitle: {
    fontWeight: '600',
  },
  dateText: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  statLabel: {
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
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
  appointmentCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appointmentTime: {
    marginRight: spacing.md,
    alignItems: 'center',
  },
  timeText: {
    fontWeight: '600',
    color: colors.primary,
  },
  endTimeText: {
    color: colors.textSecondary,
  },
  appointmentInfo: {
    flex: 1,
  },
  serviceText: {
    color: colors.textSecondary,
  },
  staffText: {
    color: colors.textTertiary,
    marginTop: 2,
  },
  statusChip: {
    marginLeft: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.background,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  actionButtonContent: {
    paddingVertical: spacing.sm,
  },
});
