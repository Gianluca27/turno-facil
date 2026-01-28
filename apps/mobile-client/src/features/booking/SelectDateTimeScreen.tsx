import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DateData } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { BookingStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<BookingStackParamList, 'SelectDateTime'>;
type RouteProps = RouteProp<BookingStackParamList, 'SelectDateTime'>;

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function SelectDateTimeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { businessId, serviceIds, staffId } = route.params;

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Fetch availability
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['availability', businessId, selectedDate, serviceIds, staffId],
    queryFn: () =>
      businessApi.getAvailability(businessId, {
        date: selectedDate,
        serviceIds,
        staffId,
      }),
    enabled: !!selectedDate,
  });

  const slots = data?.data?.data?.slots || [];

  // Group slots by morning, afternoon, evening
  const groupedSlots = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];

    slots.forEach((slot: { time: string; available: boolean }) => {
      if (!slot.available) return;

      const hour = parseInt(slot.time.split(':')[0], 10);
      if (hour < 12) {
        morning.push(slot.time);
      } else if (hour < 18) {
        afternoon.push(slot.time);
      } else {
        evening.push(slot.time);
      }
    });

    return { morning, afternoon, evening };
  }, [slots]);

  const hasSlots = groupedSlots.morning.length > 0 ||
    groupedSlots.afternoon.length > 0 ||
    groupedSlots.evening.length > 0;

  // Calendar marked dates
  const markedDates = useMemo(() => {
    return {
      [selectedDate]: {
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: colors.white,
      },
    };
  }, [selectedDate]);

  const handleDateSelect = (date: DateData) => {
    setSelectedDate(date.dateString);
    setSelectedTime(null);
  };

  const handleContinue = () => {
    if (!selectedTime) return;

    navigation.navigate('BookingConfirmation', {
      businessId,
      serviceIds,
      staffId,
      date: selectedDate,
      startTime: selectedTime,
    });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.stepText}>Paso 3 de 4</Text>
          <Text style={styles.title}>Elegí fecha y hora</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.white,
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.gray300,
              dotColor: colors.primary,
              selectedDotColor: colors.white,
              arrowColor: colors.primary,
              monthTextColor: colors.text,
              textDayFontWeight: '400',
              textMonthFontWeight: '600',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 13,
            }}
            firstDay={1}
            enableSwipeMonths
          />
        </View>

        {/* Selected Date Header */}
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{formatDateHeader(selectedDate)}</Text>
        </View>

        {/* Time Slots */}
        {isLoading || isFetching ? (
          <View style={styles.loadingSlots}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando horarios disponibles...</Text>
          </View>
        ) : !hasSlots ? (
          <View style={styles.noSlots}>
            <Icon name="calendar-remove" size={48} color={colors.gray300} />
            <Text style={styles.noSlotsText}>
              No hay turnos disponibles para este día
            </Text>
            <Text style={styles.noSlotsSubtext}>
              Probá seleccionando otra fecha
            </Text>
          </View>
        ) : (
          <View style={styles.slotsContainer}>
            {groupedSlots.morning.length > 0 && (
              <View style={styles.slotGroup}>
                <View style={styles.slotGroupHeader}>
                  <Icon name="weather-sunny" size={20} color={colors.star} />
                  <Text style={styles.slotGroupTitle}>Mañana</Text>
                </View>
                <View style={styles.slotsGrid}>
                  {groupedSlots.morning.map((time) => (
                    <TimeSlot key={time} time={time} />
                  ))}
                </View>
              </View>
            )}

            {groupedSlots.afternoon.length > 0 && (
              <View style={styles.slotGroup}>
                <View style={styles.slotGroupHeader}>
                  <Icon name="white-balance-sunny" size={20} color={colors.warning} />
                  <Text style={styles.slotGroupTitle}>Tarde</Text>
                </View>
                <View style={styles.slotsGrid}>
                  {groupedSlots.afternoon.map((time) => (
                    <TimeSlot key={time} time={time} />
                  ))}
                </View>
              </View>
            )}

            {groupedSlots.evening.length > 0 && (
              <View style={styles.slotGroup}>
                <View style={styles.slotGroupHeader}>
                  <Icon name="weather-night" size={20} color={colors.primary} />
                  <Text style={styles.slotGroupTitle}>Noche</Text>
                </View>
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
          onPress={handleContinue}
          disabled={!selectedTime}
          style={[styles.continueButton, !selectedTime && styles.continueButtonDisabled]}
          contentStyle={styles.continueButtonContent}
          labelStyle={styles.continueButtonLabel}
        >
          {selectedTime ? `Continuar - ${selectedTime} hs` : 'Seleccioná un horario'}
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
  },
  calendarContainer: {
    backgroundColor: colors.white,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  noSlotsSubtext: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  slotsContainer: {
    padding: 16,
  },
  slotGroup: {
    marginBottom: 24,
  },
  slotGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotGroupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
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
  continueButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  continueButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  continueButtonContent: {
    height: 52,
  },
  continueButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
