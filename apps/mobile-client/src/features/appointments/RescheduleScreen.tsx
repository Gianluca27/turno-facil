import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, DateData } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { AppointmentsStackParamList } from '../../navigation/types';
import { bookingApi, businessApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<AppointmentsStackParamList, 'RescheduleAppointment'>;
type RouteProps = RouteProp<AppointmentsStackParamList, 'RescheduleAppointment'>;

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function RescheduleScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { appointmentId } = route.params;
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Fetch appointment details
  const { data: appointmentData, isLoading: isLoadingAppointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => bookingApi.getById(appointmentId),
  });

  const appointment = appointmentData?.data?.data?.appointment;

  // Fetch availability
  const { data: availabilityData, isLoading: isLoadingAvailability, isFetching } = useQuery({
    queryKey: ['availability-reschedule', appointment?.businessId, selectedDate, appointment?.services],
    queryFn: () =>
      businessApi.getAvailability(appointment.businessId, {
        date: selectedDate,
        serviceIds: appointment.services?.map((s: any) => s.serviceId) || [],
        staffId: appointment.staffId,
      }),
    enabled: !!appointment?.businessId && !!selectedDate,
  });

  const slots = availabilityData?.data?.data?.slots || [];

  // Group slots
  const groupedSlots = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];

    slots.forEach((slot: { time: string; available: boolean }) => {
      if (!slot.available) return;
      const hour = parseInt(slot.time.split(':')[0], 10);
      if (hour < 12) morning.push(slot.time);
      else if (hour < 18) afternoon.push(slot.time);
      else evening.push(slot.time);
    });

    return { morning, afternoon, evening };
  }, [slots]);

  const hasSlots = groupedSlots.morning.length > 0 ||
    groupedSlots.afternoon.length > 0 ||
    groupedSlots.evening.length > 0;

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: () =>
      bookingApi.reschedule(appointmentId, {
        date: selectedDate,
        startTime: selectedTime!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      Alert.alert(
        'Turno reprogramado',
        'Tu turno ha sido reprogramado exitosamente',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al reprogramar el turno';
      Alert.alert('Error', message);
    },
  });

  const markedDates = useMemo(() => ({
    [selectedDate]: {
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.white,
    },
  }), [selectedDate]);

  const handleDateSelect = (date: DateData) => {
    setSelectedDate(date.dateString);
    setSelectedTime(null);
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const month = MONTHS_ES[date.getMonth()];
    const weekday = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][date.getDay()];
    return `${weekday} ${day} de ${month}`;
  };

  const TimeSlot = ({ time }: { time: string }) => {
    const isSelected = selectedTime === time;
    return (
      <TouchableOpacity
        style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
        onPress={() => setSelectedTime(time)}
        activeOpacity={0.7}
      >
        <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextSelected]}>
          {time}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoadingAppointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={styles.title}>Reprogramar turno</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Appointment Info */}
        <View style={styles.currentInfo}>
          <Text style={styles.currentLabel}>Turno actual:</Text>
          <Text style={styles.currentValue}>
            {appointment?.date} a las {appointment?.startTime} hs
          </Text>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={selectedDate}
            minDate={today}
            maxDate={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            onDayPress={handleDateSelect}
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.white,
              calendarBackground: colors.white,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.white,
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.gray300,
              arrowColor: colors.primary,
              monthTextColor: colors.text,
            }}
            firstDay={1}
            enableSwipeMonths
          />
        </View>

        {/* Selected Date */}
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{formatDateHeader(selectedDate)}</Text>
        </View>

        {/* Time Slots */}
        {isLoadingAvailability || isFetching ? (
          <View style={styles.loadingSlots}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando horarios...</Text>
          </View>
        ) : !hasSlots ? (
          <View style={styles.noSlots}>
            <Icon name="calendar-remove" size={48} color={colors.gray300} />
            <Text style={styles.noSlotsText}>No hay horarios disponibles</Text>
          </View>
        ) : (
          <View style={styles.slotsContainer}>
            {groupedSlots.morning.length > 0 && (
              <View style={styles.slotGroup}>
                <Text style={styles.slotGroupTitle}>Mañana</Text>
                <View style={styles.slotsGrid}>
                  {groupedSlots.morning.map((time) => (
                    <TimeSlot key={time} time={time} />
                  ))}
                </View>
              </View>
            )}
            {groupedSlots.afternoon.length > 0 && (
              <View style={styles.slotGroup}>
                <Text style={styles.slotGroupTitle}>Tarde</Text>
                <View style={styles.slotsGrid}>
                  {groupedSlots.afternoon.map((time) => (
                    <TimeSlot key={time} time={time} />
                  ))}
                </View>
              </View>
            )}
            {groupedSlots.evening.length > 0 && (
              <View style={styles.slotGroup}>
                <Text style={styles.slotGroupTitle}>Noche</Text>
                <View style={styles.slotsGrid}>
                  {groupedSlots.evening.map((time) => (
                    <TimeSlot key={time} time={time} />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          mode="contained"
          onPress={() => rescheduleMutation.mutate()}
          disabled={!selectedTime || rescheduleMutation.isPending}
          loading={rescheduleMutation.isPending}
          style={[styles.confirmButton, !selectedTime && styles.confirmButtonDisabled]}
          contentStyle={styles.confirmButtonContent}
          labelStyle={styles.confirmButtonLabel}
        >
          {selectedTime ? `Confirmar - ${selectedTime} hs` : 'Seleccioná un horario'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  currentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight + '20',
    padding: 16,
    gap: 8,
  },
  currentLabel: {
    fontSize: 14,
    color: colors.warning,
  },
  currentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  calendarContainer: {
    backgroundColor: colors.white,
    paddingBottom: 16,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.gray50,
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  loadingSlots: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  noSlots: {
    padding: 40,
    alignItems: 'center',
  },
  noSlotsText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  slotsContainer: {
    padding: 16,
  },
  slotGroup: {
    marginBottom: 24,
  },
  slotGroupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    width: '22%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  timeSlotTextSelected: {
    color: colors.white,
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
  confirmButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  confirmButtonContent: {
    height: 52,
  },
  confirmButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
