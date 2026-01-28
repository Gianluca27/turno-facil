import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Chip, FAB, ActivityIndicator, Portal, Modal, Button, SegmentedButtons } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { appointmentsApi } from '../../../services/api';
import { colors, spacing, getStatusColor, getStatusLabel } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type ViewMode = 'day' | 'week' | 'list';

interface Appointment {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  clientInfo: {
    name: string;
    phone?: string;
  };
  services: Array<{
    name: string;
    price: number;
  }>;
  staffInfo: {
    name: string;
  };
}

export const CalendarScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentBusiness = useCurrentBusiness();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', currentBusiness?.businessId, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => appointmentsApi.list({ date: format(selectedDate, 'yyyy-MM-dd') }),
    enabled: !!currentBusiness,
  });

  const appointments: Appointment[] = data?.data?.data?.appointments || [];

  const appointmentsByHour = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    appointments.forEach((apt) => {
      const hour = apt.startTime.split(':')[0];
      if (!grouped[hour]) grouped[hour] = [];
      grouped[hour].push(apt);
    });
    return grouped;
  }, [appointments]);

  const hours = Array.from({ length: 12 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}`);

  const navigateDate = (direction: number) => {
    setSelectedDate((prev) => addDays(prev, direction));
  };

  const renderDayView = () => (
    <ScrollView style={styles.dayView}>
      {hours.map((hour) => {
        const hourAppointments = appointmentsByHour[hour] || [];
        return (
          <View key={hour} style={styles.hourRow}>
            <View style={styles.hourLabel}>
              <Text variant="bodySmall" style={styles.hourText}>
                {hour}:00
              </Text>
            </View>
            <View style={styles.hourContent}>
              {hourAppointments.length > 0 ? (
                hourAppointments.map((apt) => (
                  <TouchableOpacity
                    key={apt._id}
                    style={[
                      styles.appointmentBlock,
                      { borderLeftColor: getStatusColor(apt.status) },
                    ]}
                    onPress={() => setSelectedAppointment(apt)}
                  >
                    <View style={styles.appointmentBlockHeader}>
                      <Text variant="labelMedium" style={styles.appointmentTime}>
                        {apt.startTime} - {apt.endTime}
                      </Text>
                      <Chip
                        compact
                        style={[
                          styles.miniChip,
                          { backgroundColor: getStatusColor(apt.status) + '20' },
                        ]}
                        textStyle={{ color: getStatusColor(apt.status), fontSize: 10 }}
                      >
                        {getStatusLabel(apt.status)}
                      </Chip>
                    </View>
                    <Text variant="bodyMedium" numberOfLines={1} style={styles.appointmentClient}>
                      {apt.clientInfo?.name}
                    </Text>
                    <Text variant="bodySmall" style={styles.appointmentService} numberOfLines={1}>
                      {apt.services?.map((s) => s.name).join(', ')}
                    </Text>
                    <Text variant="bodySmall" style={styles.appointmentStaff}>
                      {apt.staffInfo?.name}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptySlot} />
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderWeekView = () => (
    <View style={styles.weekView}>
      <View style={styles.weekHeader}>
        {weekDays.map((day) => (
          <TouchableOpacity
            key={day.toISOString()}
            style={[
              styles.weekDayHeader,
              isSameDay(day, selectedDate) && styles.selectedWeekDay,
            ]}
            onPress={() => setSelectedDate(day)}
          >
            <Text variant="labelSmall" style={styles.weekDayName}>
              {format(day, 'EEE', { locale: es })}
            </Text>
            <Text
              variant="titleMedium"
              style={[
                styles.weekDayNumber,
                isSameDay(day, selectedDate) && styles.selectedWeekDayText,
              ]}
            >
              {format(day, 'd')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {renderDayView()}
    </View>
  );

  const renderListView = () => (
    <ScrollView style={styles.listView}>
      {appointments.length > 0 ? (
        appointments.map((apt) => (
          <Card
            key={apt._id}
            style={styles.listCard}
            onPress={() => setSelectedAppointment(apt)}
          >
            <Card.Content style={styles.listCardContent}>
              <View style={styles.listCardTime}>
                <Text variant="titleLarge" style={styles.listTimeText}>
                  {apt.startTime}
                </Text>
                <Text variant="bodySmall" style={styles.listEndTime}>
                  {apt.endTime}
                </Text>
              </View>
              <View style={styles.listCardInfo}>
                <Text variant="titleMedium" numberOfLines={1}>
                  {apt.clientInfo?.name}
                </Text>
                <Text variant="bodyMedium" style={styles.listServiceText} numberOfLines={1}>
                  {apt.services?.map((s) => s.name).join(', ')}
                </Text>
                <Text variant="bodySmall" style={styles.listStaffText}>
                  {apt.staffInfo?.name}
                </Text>
              </View>
              <Chip
                style={[
                  styles.statusChip,
                  { backgroundColor: getStatusColor(apt.status) + '20' },
                ]}
                textStyle={{ color: getStatusColor(apt.status), fontSize: 11 }}
                compact
              >
                {getStatusLabel(apt.status)}
              </Chip>
            </Card.Content>
          </Card>
        ))
      ) : (
        <View style={styles.emptyList}>
          <Icon name="calendar-blank" size={64} color={colors.textTertiary} />
          <Text variant="bodyLarge" style={styles.emptyText}>
            No hay turnos para este día
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderAppointmentModal = () => (
    <Portal>
      <Modal
        visible={!!selectedAppointment}
        onDismiss={() => setSelectedAppointment(null)}
        contentContainerStyle={styles.modalContainer}
      >
        {selectedAppointment && (
          <>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Detalle del Turno
              </Text>
              <Chip
                style={[
                  styles.statusChip,
                  { backgroundColor: getStatusColor(selectedAppointment.status) + '20' },
                ]}
                textStyle={{ color: getStatusColor(selectedAppointment.status) }}
              >
                {getStatusLabel(selectedAppointment.status)}
              </Chip>
            </View>

            <View style={styles.modalSection}>
              <View style={styles.modalRow}>
                <Icon name="clock-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.modalRowText}>
                  {selectedAppointment.startTime} - {selectedAppointment.endTime}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Icon name="account-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.modalRowText}>
                  {selectedAppointment.clientInfo?.name}
                </Text>
              </View>
              {selectedAppointment.clientInfo?.phone && (
                <View style={styles.modalRow}>
                  <Icon name="phone-outline" size={20} color={colors.textSecondary} />
                  <Text variant="bodyLarge" style={styles.modalRowText}>
                    {selectedAppointment.clientInfo.phone}
                  </Text>
                </View>
              )}
              <View style={styles.modalRow}>
                <Icon name="tag-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.modalRowText}>
                  {selectedAppointment.services?.map((s) => s.name).join(', ')}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Icon name="account-tie-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.modalRowText}>
                  {selectedAppointment.staffInfo?.name}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Icon name="cash" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.modalRowText}>
                  ${selectedAppointment.services?.reduce((sum, s) => sum + s.price, 0)}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setSelectedAppointment(null)}
                style={styles.modalButton}
              >
                Cerrar
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  const appointmentId = selectedAppointment._id;
                  setSelectedAppointment(null);
                  navigation.navigate('AppointmentDetail', { appointmentId });
                }}
                style={styles.modalButton}
              >
                Ver Detalle
              </Button>
            </View>
          </>
        )}
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
      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => navigateDate(-1)} style={styles.navButton}>
          <Icon name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSelectedDate(new Date())}>
          <Text variant="titleMedium" style={styles.dateText}>
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigateDate(1)} style={styles.navButton}>
          <Icon name="chevron-right" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <SegmentedButtons
        value={viewMode}
        onValueChange={(value) => setViewMode(value as ViewMode)}
        buttons={[
          { value: 'day', label: 'Día', icon: 'view-day' },
          { value: 'week', label: 'Semana', icon: 'view-week' },
          { value: 'list', label: 'Lista', icon: 'view-list' },
        ]}
        style={styles.segmentedButtons}
      />

      {/* Content */}
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'list' && renderListView()}

      {/* Appointment Detail Modal */}
      {renderAppointmentModal()}

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateAppointment', { date: format(selectedDate, 'yyyy-MM-dd') })}
      />
    </View>
  );
};

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
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navButton: {
    padding: spacing.xs,
  },
  dateText: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  segmentedButtons: {
    margin: spacing.md,
  },
  dayView: {
    flex: 1,
  },
  hourRow: {
    flexDirection: 'row',
    minHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hourLabel: {
    width: 60,
    paddingTop: spacing.xs,
    paddingLeft: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  hourText: {
    color: colors.textSecondary,
  },
  hourContent: {
    flex: 1,
    padding: spacing.xs,
  },
  emptySlot: {
    flex: 1,
  },
  appointmentBlock: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 4,
  },
  appointmentBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  appointmentTime: {
    color: colors.primary,
    fontWeight: '600',
  },
  miniChip: {
    height: 20,
  },
  appointmentClient: {
    fontWeight: '500',
  },
  appointmentService: {
    color: colors.textSecondary,
  },
  appointmentStaff: {
    color: colors.textTertiary,
    marginTop: 2,
  },
  weekView: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  selectedWeekDay: {
    backgroundColor: colors.primary + '10',
  },
  weekDayName: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  weekDayNumber: {
    fontWeight: '600',
  },
  selectedWeekDayText: {
    color: colors.primary,
  },
  listView: {
    flex: 1,
    padding: spacing.md,
  },
  listCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  listCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listCardTime: {
    marginRight: spacing.md,
    alignItems: 'center',
  },
  listTimeText: {
    fontWeight: '600',
    color: colors.primary,
  },
  listEndTime: {
    color: colors.textSecondary,
  },
  listCardInfo: {
    flex: 1,
  },
  listServiceText: {
    color: colors.textSecondary,
  },
  listStaffText: {
    color: colors.textTertiary,
    marginTop: 2,
  },
  statusChip: {
    marginLeft: spacing.sm,
  },
  emptyList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl * 2,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontWeight: '600',
  },
  modalSection: {
    marginBottom: spacing.lg,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalRowText: {
    marginLeft: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalButton: {
    minWidth: 100,
  },
});
