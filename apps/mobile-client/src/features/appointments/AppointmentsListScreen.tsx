import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, SegmentedButtons, ActivityIndicator, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { AppointmentsStackParamList } from '../../navigation/types';
import { appointmentsApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<AppointmentsStackParamList, 'AppointmentsList'>;

type TabValue = 'upcoming' | 'past' | 'cancelled';

interface Appointment {
  _id: string;
  businessInfo: {
    name: string;
    logo?: string;
  };
  staffInfo?: {
    name: string;
  };
  services: Array<{ name: string; duration: number; price: number }>;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  pricing: {
    total: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pendiente', color: colors.warning, icon: 'clock-outline' },
  confirmed: { label: 'Confirmado', color: colors.success, icon: 'check-circle' },
  checked_in: { label: 'En espera', color: colors.primary, icon: 'account-check' },
  in_progress: { label: 'En curso', color: colors.primary, icon: 'progress-clock' },
  completed: { label: 'Completado', color: colors.success, icon: 'check-all' },
  cancelled: { label: 'Cancelado', color: colors.error, icon: 'cancel' },
  no_show: { label: 'No asistió', color: colors.error, icon: 'account-remove' },
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function AppointmentsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch appointments based on active tab
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', activeTab],
    queryFn: () => {
      switch (activeTab) {
        case 'upcoming':
          return appointmentsApi.getUpcoming();
        case 'past':
          return appointmentsApi.getPast();
        case 'cancelled':
          return appointmentsApi.getCancelled();
        default:
          return appointmentsApi.getUpcoming();
      }
    },
  });

  const appointments: Appointment[] = data?.data?.data?.items || [];

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const month = MONTHS_ES[date.getMonth()];
    const weekday = WEEKDAYS_ES[date.getDay()];
    return { day, month, weekday };
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const isTomorrow = (dateStr: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dateStr === tomorrow.toISOString().split('T')[0];
  };

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    const { day, month, weekday } = formatDate(item.date);
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const servicesText = item.services.map((s) => s.name).join(', ');
    const totalDuration = item.services.reduce((sum, s) => sum + s.duration, 0);

    return (
      <TouchableOpacity
        style={styles.appointmentCard}
        onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item._id })}
        activeOpacity={0.7}
      >
        <View style={styles.dateContainer}>
          {isToday(item.date) ? (
            <View style={[styles.dateBadge, styles.todayBadge]}>
              <Text style={styles.todayText}>Hoy</Text>
            </View>
          ) : isTomorrow(item.date) ? (
            <View style={[styles.dateBadge, styles.tomorrowBadge]}>
              <Text style={styles.tomorrowText}>Mañana</Text>
            </View>
          ) : (
            <View style={styles.dateBadge}>
              <Text style={styles.dateWeekday}>{weekday}</Text>
              <Text style={styles.dateDay}>{day}</Text>
              <Text style={styles.dateMonth}>{month}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.businessName} numberOfLines={1}>
              {item.businessInfo.name}
            </Text>
            <Chip
              icon={() => (
                <Icon name={statusConfig.icon} size={14} color={statusConfig.color} />
              )}
              style={[styles.statusChip, { backgroundColor: statusConfig.color + '15' }]}
              textStyle={[styles.statusText, { color: statusConfig.color }]}
              compact
            >
              {statusConfig.label}
            </Chip>
          </View>

          <View style={styles.timeContainer}>
            <Icon name="clock-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.timeText}>
              {item.startTime} - {item.endTime} hs ({totalDuration} min)
            </Text>
          </View>

          <Text style={styles.servicesText} numberOfLines={1}>
            {servicesText}
          </Text>

          {item.staffInfo?.name && (
            <View style={styles.staffContainer}>
              <Icon name="account" size={16} color={colors.textSecondary} />
              <Text style={styles.staffText}>{item.staffInfo.name}</Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.priceText}>${item.pricing.total.toLocaleString()}</Text>
            <Icon name="chevron-right" size={24} color={colors.gray400} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon
        name={
          activeTab === 'upcoming'
            ? 'calendar-blank'
            : activeTab === 'past'
              ? 'history'
              : 'calendar-remove'
        }
        size={64}
        color={colors.gray300}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'upcoming'
          ? 'No tenés turnos próximos'
          : activeTab === 'past'
            ? 'No tenés turnos pasados'
            : 'No tenés turnos cancelados'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'upcoming'
          ? 'Explorá negocios y reservá tu primer turno'
          : 'Acá aparecerán tus turnos cuando reserves'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis Turnos</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabValue)}
          buttons={[
            { value: 'upcoming', label: 'Próximos', icon: 'calendar-clock' },
            { value: 'past', label: 'Pasados', icon: 'history' },
            { value: 'cancelled', label: 'Cancelados', icon: 'calendar-remove' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Appointments List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item._id}
          renderItem={renderAppointmentCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  segmentedButtons: {
    backgroundColor: colors.gray100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  appointmentCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dateContainer: {
    width: 72,
    backgroundColor: colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  dateBadge: {
    alignItems: 'center',
  },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tomorrowBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  todayText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  tomorrowText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  dateWeekday: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 28,
  },
  dateMonth: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusChip: {
    height: 24,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  servicesText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 6,
  },
  staffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  staffText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
