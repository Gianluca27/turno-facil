import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import {
  Text,
  Card,
  SegmentedButtons,
  ActivityIndicator,
  Chip,
  Divider,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

import { analyticsApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

type Period = 'week' | 'month' | 'year';

interface AnalyticsData {
  overview: {
    totalRevenue: number;
    revenueGrowth: number;
    totalAppointments: number;
    appointmentsGrowth: number;
    newClients: number;
    clientsGrowth: number;
    averageRating: number;
    totalReviews: number;
  };
  topServices: {
    serviceId: string;
    name: string;
    count: number;
    revenue: number;
  }[];
  topStaff: {
    staffId: string;
    name: string;
    appointments: number;
    revenue: number;
    rating?: number;
  }[];
  appointmentsByDay: {
    date: string;
    count: number;
    revenue: number;
  }[];
  clientSegments: {
    segment: string;
    count: number;
    percentage: number;
  }[];
  peakHours: {
    hour: number;
    count: number;
  }[];
}

const { width } = Dimensions.get('window');

export const AnalyticsScreen: React.FC = () => {
  const currentBusiness = useCurrentBusiness();
  const [period, setPeriod] = useState<Period>('month');

  const getDateRange = () => {
    const today = new Date();
    switch (period) {
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
      case 'year':
        return {
          from: format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'),
          to: format(new Date(today.getFullYear(), 11, 31), 'yyyy-MM-dd'),
        };
    }
  };

  const dateRange = getDateRange();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics', currentBusiness?.businessId, dateRange],
    queryFn: () => analyticsApi.getOverview(dateRange.from, dateRange.to),
    enabled: !!currentBusiness,
  });

  const analytics: AnalyticsData = data?.data?.data || {
    overview: {
      totalRevenue: 0,
      revenueGrowth: 0,
      totalAppointments: 0,
      appointmentsGrowth: 0,
      newClients: 0,
      clientsGrowth: 0,
      averageRating: 0,
      totalReviews: 0,
    },
    topServices: [],
    topStaff: [],
    appointmentsByDay: [],
    clientSegments: [],
    peakHours: [],
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  const renderGrowthIndicator = (growth: number) => {
    const isPositive = growth >= 0;
    return (
      <View style={[styles.growthIndicator, { backgroundColor: (isPositive ? colors.success : colors.error) + '20' }]}>
        <Icon
          name={isPositive ? 'trending-up' : 'trending-down'}
          size={14}
          color={isPositive ? colors.success : colors.error}
        />
        <Text style={[styles.growthText, { color: isPositive ? colors.success : colors.error }]}>
          {isPositive ? '+' : ''}{growth.toFixed(1)}%
        </Text>
      </View>
    );
  };

  const renderOverviewCards = () => (
    <View style={styles.overviewContainer}>
      <View style={styles.overviewRow}>
        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewContent}>
            <View style={styles.overviewHeader}>
              <Icon name="cash-multiple" size={24} color={colors.success} />
              {renderGrowthIndicator(analytics.overview.revenueGrowth)}
            </View>
            <Text variant="headlineMedium" style={styles.overviewValue}>
              {formatCurrency(analytics.overview.totalRevenue)}
            </Text>
            <Text variant="labelMedium" style={styles.overviewLabel}>
              Ingresos
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewContent}>
            <View style={styles.overviewHeader}>
              <Icon name="calendar-check" size={24} color={colors.primary} />
              {renderGrowthIndicator(analytics.overview.appointmentsGrowth)}
            </View>
            <Text variant="headlineMedium" style={styles.overviewValue}>
              {analytics.overview.totalAppointments}
            </Text>
            <Text variant="labelMedium" style={styles.overviewLabel}>
              Turnos
            </Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.overviewRow}>
        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewContent}>
            <View style={styles.overviewHeader}>
              <Icon name="account-plus" size={24} color={colors.secondary} />
              {renderGrowthIndicator(analytics.overview.clientsGrowth)}
            </View>
            <Text variant="headlineMedium" style={styles.overviewValue}>
              {analytics.overview.newClients}
            </Text>
            <Text variant="labelMedium" style={styles.overviewLabel}>
              Nuevos Clientes
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewContent}>
            <View style={styles.overviewHeader}>
              <Icon name="star" size={24} color="#F59E0B" />
            </View>
            <View style={styles.ratingRow}>
              <Text variant="headlineMedium" style={styles.overviewValue}>
                {analytics.overview.averageRating.toFixed(1)}
              </Text>
              <Icon name="star" size={20} color="#F59E0B" />
            </View>
            <Text variant="labelMedium" style={styles.overviewLabel}>
              ({analytics.overview.totalReviews} reseñas)
            </Text>
          </Card.Content>
        </Card>
      </View>
    </View>
  );

  const renderTopServices = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Servicios más Populares
        </Text>
        {analytics.topServices.length > 0 ? (
          analytics.topServices.slice(0, 5).map((service, index) => (
            <View key={service.serviceId} style={styles.rankingItem}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.rankingInfo}>
                <Text variant="bodyMedium" numberOfLines={1} style={styles.rankingName}>
                  {service.name}
                </Text>
                <Text variant="bodySmall" style={styles.rankingSubtext}>
                  {service.count} turnos
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.rankingValue}>
                {formatCurrency(service.revenue)}
              </Text>
            </View>
          ))
        ) : (
          <Text variant="bodyMedium" style={styles.noDataText}>
            Sin datos suficientes
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderTopStaff = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Top Empleados
        </Text>
        {analytics.topStaff.length > 0 ? (
          analytics.topStaff.slice(0, 5).map((staff, index) => (
            <View key={staff.staffId} style={styles.rankingItem}>
              <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#F59E0B' : colors.primary }]}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.rankingInfo}>
                <Text variant="bodyMedium" numberOfLines={1} style={styles.rankingName}>
                  {staff.name}
                </Text>
                <View style={styles.staffStats}>
                  <Text variant="bodySmall" style={styles.rankingSubtext}>
                    {staff.appointments} turnos
                  </Text>
                  {staff.rating && (
                    <View style={styles.staffRating}>
                      <Icon name="star" size={12} color="#F59E0B" />
                      <Text variant="bodySmall" style={styles.rankingSubtext}>
                        {staff.rating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Text variant="bodyMedium" style={styles.rankingValue}>
                {formatCurrency(staff.revenue)}
              </Text>
            </View>
          ))
        ) : (
          <Text variant="bodyMedium" style={styles.noDataText}>
            Sin datos suficientes
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderClientSegments = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Segmentos de Clientes
        </Text>
        {analytics.clientSegments.length > 0 ? (
          <View style={styles.segmentsContainer}>
            {analytics.clientSegments.map((segment) => (
              <View key={segment.segment} style={styles.segmentItem}>
                <View style={styles.segmentInfo}>
                  <Text variant="bodyMedium" style={styles.segmentName}>
                    {segment.segment === 'new' ? 'Nuevos' :
                     segment.segment === 'returning' ? 'Recurrentes' :
                     segment.segment === 'vip' ? 'VIP' :
                     segment.segment === 'inactive' ? 'Inactivos' : segment.segment}
                  </Text>
                  <Text variant="headlineSmall" style={styles.segmentCount}>
                    {segment.count}
                  </Text>
                </View>
                <View style={styles.segmentBar}>
                  <View
                    style={[
                      styles.segmentBarFill,
                      {
                        width: `${segment.percentage}%`,
                        backgroundColor:
                          segment.segment === 'new' ? colors.primary :
                          segment.segment === 'returning' ? colors.success :
                          segment.segment === 'vip' ? '#F59E0B' : colors.textSecondary,
                      },
                    ]}
                  />
                </View>
                <Text variant="labelSmall" style={styles.segmentPercentage}>
                  {segment.percentage.toFixed(0)}%
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="bodyMedium" style={styles.noDataText}>
            Sin datos suficientes
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderPeakHours = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Horarios Pico
        </Text>
        {analytics.peakHours.length > 0 ? (
          <View style={styles.peakHoursContainer}>
            {analytics.peakHours.slice(0, 12).map((hour) => {
              const maxCount = Math.max(...analytics.peakHours.map((h) => h.count));
              const heightPercentage = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
              return (
                <View key={hour.hour} style={styles.peakHourItem}>
                  <View style={styles.peakHourBarContainer}>
                    <View
                      style={[
                        styles.peakHourBar,
                        {
                          height: `${Math.max(heightPercentage, 5)}%`,
                          backgroundColor: heightPercentage > 70 ? colors.error :
                                          heightPercentage > 40 ? colors.warning : colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text variant="labelSmall" style={styles.peakHourLabel}>
                    {hour.hour}h
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text variant="bodyMedium" style={styles.noDataText}>
            Sin datos suficientes
          </Text>
        )}
      </Card.Content>
    </Card>
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
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
            { value: 'year', label: 'Año' },
          ]}
          style={styles.segmentedButtons}
        />

        {renderOverviewCards()}
        {renderTopServices()}
        {renderTopStaff()}
        {renderClientSegments()}
        {renderPeakHours()}
      </ScrollView>
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
    paddingBottom: spacing.xl * 2,
  },
  segmentedButtons: {
    marginBottom: spacing.md,
  },
  overviewContainer: {
    marginBottom: spacing.md,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overviewContent: {
    alignItems: 'flex-start',
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  growthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  overviewValue: {
    fontWeight: '700',
    color: colors.text,
  },
  overviewLabel: {
    color: colors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  rankText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 12,
  },
  rankingInfo: {
    flex: 1,
  },
  rankingName: {
    fontWeight: '500',
  },
  rankingSubtext: {
    color: colors.textSecondary,
  },
  rankingValue: {
    fontWeight: '600',
    color: colors.success,
  },
  staffStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  staffRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  noDataText: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  segmentsContainer: {
    gap: spacing.sm,
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  segmentInfo: {
    width: 100,
  },
  segmentName: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  segmentCount: {
    fontWeight: '700',
  },
  segmentBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
  },
  segmentBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  segmentPercentage: {
    width: 40,
    textAlign: 'right',
    color: colors.textSecondary,
  },
  peakHoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
    alignItems: 'flex-end',
  },
  peakHourItem: {
    alignItems: 'center',
    flex: 1,
  },
  peakHourBarContainer: {
    height: 80,
    width: '80%',
    justifyContent: 'flex-end',
  },
  peakHourBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  peakHourLabel: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
});

export default AnalyticsScreen;
