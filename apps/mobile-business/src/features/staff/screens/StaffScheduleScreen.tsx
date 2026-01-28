import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  Text,
  Button,
  ActivityIndicator,
  Switch,
  Divider,
  Card,
  Portal,
  Modal,
  IconButton,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { staffApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type StaffScheduleRouteProp = RouteProp<RootStackParamList, 'StaffSchedule'>;

interface ScheduleSlot {
  start: string;
  end: string;
}

interface DaySchedule {
  dayOfWeek: number;
  isWorking: boolean;
  shifts: ScheduleSlot[];
}

interface Staff {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
  };
  schedule: DaySchedule[];
}

const DAYS_OF_WEEK = [
  { index: 1, name: 'Lunes', short: 'Lun' },
  { index: 2, name: 'Martes', short: 'Mar' },
  { index: 3, name: 'Miércoles', short: 'Mié' },
  { index: 4, name: 'Jueves', short: 'Jue' },
  { index: 5, name: 'Viernes', short: 'Vie' },
  { index: 6, name: 'Sábado', short: 'Sáb' },
  { index: 0, name: 'Domingo', short: 'Dom' },
];

const TIME_OPTIONS = (() => {
  const options: string[] = [];
  for (let hour = 6; hour <= 23; hour++) {
    options.push(`${hour.toString().padStart(2, '0')}:00`);
    options.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return options;
})();

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS_OF_WEEK.map(day => ({
  dayOfWeek: day.index,
  isWorking: day.index >= 1 && day.index <= 5, // Mon-Fri by default
  shifts: [{ start: '09:00', end: '18:00' }],
}));

export const StaffScheduleScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<StaffScheduleRouteProp>();
  const queryClient = useQueryClient();
  const { staffId } = route.params;

  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [editingShift, setEditingShift] = useState<{ dayIndex: number; shiftIndex: number; field: 'start' | 'end' } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch staff
  const { data: staffData, isLoading } = useQuery({
    queryKey: ['staff', staffId],
    queryFn: () => staffApi.get(staffId),
  });

  const staff: Staff | undefined = staffData?.data?.data?.staff;

  // Initialize schedule from staff data
  useEffect(() => {
    if (staff?.schedule && staff.schedule.length > 0) {
      // Sort schedule by day of week
      const sortedSchedule = [...staff.schedule].sort((a, b) => {
        const aOrder = DAYS_OF_WEEK.findIndex(d => d.index === a.dayOfWeek);
        const bOrder = DAYS_OF_WEEK.findIndex(d => d.index === b.dayOfWeek);
        return aOrder - bOrder;
      });
      setSchedule(sortedSchedule);
    }
  }, [staff]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (newSchedule: DaySchedule[]) => staffApi.updateSchedule(staffId, { schedule: newSchedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', staffId] });
      setHasChanges(false);
      navigation.goBack();
    },
  });

  const toggleDay = (dayIndex: number) => {
    setSchedule(prev => {
      const newSchedule = prev.map(day => {
        if (day.dayOfWeek === dayIndex) {
          return {
            ...day,
            isWorking: !day.isWorking,
            shifts: day.shifts.length > 0 ? day.shifts : [{ start: '09:00', end: '18:00' }],
          };
        }
        return day;
      });
      return newSchedule;
    });
    setHasChanges(true);
  };

  const addShift = (dayIndex: number) => {
    setSchedule(prev => {
      const newSchedule = prev.map(day => {
        if (day.dayOfWeek === dayIndex) {
          const lastShift = day.shifts[day.shifts.length - 1];
          const newStart = lastShift ? addHours(lastShift.end, 1) : '09:00';
          const newEnd = addHours(newStart, 4);
          return {
            ...day,
            shifts: [...day.shifts, { start: newStart, end: newEnd }],
          };
        }
        return day;
      });
      return newSchedule;
    });
    setHasChanges(true);
  };

  const removeShift = (dayIndex: number, shiftIndex: number) => {
    setSchedule(prev => {
      const newSchedule = prev.map(day => {
        if (day.dayOfWeek === dayIndex && day.shifts.length > 1) {
          return {
            ...day,
            shifts: day.shifts.filter((_, i) => i !== shiftIndex),
          };
        }
        return day;
      });
      return newSchedule;
    });
    setHasChanges(true);
  };

  const openTimeSelector = (dayIndex: number, shiftIndex: number, field: 'start' | 'end') => {
    setEditingShift({ dayIndex, shiftIndex, field });
    setShowTimeModal(true);
  };

  const selectTime = (time: string) => {
    if (!editingShift) return;

    setSchedule(prev => {
      const newSchedule = prev.map(day => {
        if (day.dayOfWeek === editingShift.dayIndex) {
          const newShifts = day.shifts.map((shift, i) => {
            if (i === editingShift.shiftIndex) {
              return { ...shift, [editingShift.field]: time };
            }
            return shift;
          });
          return { ...day, shifts: newShifts };
        }
        return day;
      });
      return newSchedule;
    });
    setHasChanges(true);
    setShowTimeModal(false);
    setEditingShift(null);
  };

  const copyToAllDays = (dayIndex: number) => {
    setSchedule(prev => {
      const sourceDay = prev.find(d => d.dayOfWeek === dayIndex);
      if (!sourceDay) return prev;

      return prev.map(day => ({
        ...day,
        isWorking: sourceDay.isWorking,
        shifts: [...sourceDay.shifts],
      }));
    });
    setHasChanges(true);
  };

  const copyToWeekdays = (dayIndex: number) => {
    setSchedule(prev => {
      const sourceDay = prev.find(d => d.dayOfWeek === dayIndex);
      if (!sourceDay) return prev;

      return prev.map(day => {
        if (day.dayOfWeek >= 1 && day.dayOfWeek <= 5) {
          return {
            ...day,
            isWorking: sourceDay.isWorking,
            shifts: [...sourceDay.shifts],
          };
        }
        return day;
      });
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(schedule);
  };

  const addHours = (time: string, hours: number): string => {
    const [h, m] = time.split(':').map(Number);
    let newHour = h + hours;
    if (newHour >= 24) newHour = 23;
    return `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getDaySchedule = (dayIndex: number): DaySchedule | undefined => {
    return schedule.find(s => s.dayOfWeek === dayIndex);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.headerTitle}>
            Horario de {staff?.profile.firstName}
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            Configura los días y horarios de trabajo
          </Text>
        </View>

        {DAYS_OF_WEEK.map(day => {
          const daySchedule = getDaySchedule(day.index);
          const isWorking = daySchedule?.isWorking || false;
          const shifts = daySchedule?.shifts || [];

          return (
            <Card key={day.index} style={[styles.dayCard, !isWorking && styles.dayCardInactive]}>
              <Card.Content>
                {/* Day Header */}
                <View style={styles.dayHeader}>
                  <View style={styles.dayInfo}>
                    <Text
                      variant="titleMedium"
                      style={[styles.dayName, !isWorking && styles.dayNameInactive]}
                    >
                      {day.name}
                    </Text>
                    {isWorking && shifts.length > 0 && (
                      <Text variant="bodySmall" style={styles.dayHours}>
                        {shifts.map(s => `${s.start} - ${s.end}`).join(' | ')}
                      </Text>
                    )}
                  </View>
                  <Switch
                    value={isWorking}
                    onValueChange={() => toggleDay(day.index)}
                    color={colors.primary}
                  />
                </View>

                {/* Shifts */}
                {isWorking && (
                  <View style={styles.shiftsContainer}>
                    {shifts.map((shift, shiftIndex) => (
                      <View key={shiftIndex} style={styles.shiftRow}>
                        <Text variant="labelMedium" style={styles.shiftLabel}>
                          Turno {shiftIndex + 1}
                        </Text>
                        <View style={styles.shiftTimes}>
                          <TouchableOpacity
                            style={styles.timeButton}
                            onPress={() => openTimeSelector(day.index, shiftIndex, 'start')}
                          >
                            <Text variant="bodyLarge">{shift.start}</Text>
                          </TouchableOpacity>
                          <Text variant="bodyMedium" style={styles.timeSeparator}>-</Text>
                          <TouchableOpacity
                            style={styles.timeButton}
                            onPress={() => openTimeSelector(day.index, shiftIndex, 'end')}
                          >
                            <Text variant="bodyLarge">{shift.end}</Text>
                          </TouchableOpacity>
                          {shifts.length > 1 && (
                            <IconButton
                              icon="delete-outline"
                              size={20}
                              onPress={() => removeShift(day.index, shiftIndex)}
                              iconColor={colors.error}
                            />
                          )}
                        </View>
                      </View>
                    ))}

                    <View style={styles.shiftActions}>
                      <Button
                        mode="text"
                        icon="plus"
                        compact
                        onPress={() => addShift(day.index)}
                      >
                        Agregar turno
                      </Button>
                      {selectedDay !== day.index ? (
                        <Button
                          mode="text"
                          icon="content-copy"
                          compact
                          onPress={() => setSelectedDay(day.index)}
                        >
                          Copiar
                        </Button>
                      ) : (
                        <View style={styles.copyOptions}>
                          <Button
                            mode="text"
                            compact
                            onPress={() => {
                              copyToWeekdays(day.index);
                              setSelectedDay(null);
                            }}
                          >
                            Lun-Vie
                          </Button>
                          <Button
                            mode="text"
                            compact
                            onPress={() => {
                              copyToAllDays(day.index);
                              setSelectedDay(null);
                            }}
                          >
                            Todos
                          </Button>
                          <Button
                            mode="text"
                            compact
                            onPress={() => setSelectedDay(null)}
                          >
                            Cancelar
                          </Button>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {/* Time Selector Modal */}
      <Portal>
        <Modal
          visible={showTimeModal}
          onDismiss={() => {
            setShowTimeModal(false);
            setEditingShift(null);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Seleccionar Hora
          </Text>
          <ScrollView style={styles.timeList}>
            {TIME_OPTIONS.map(time => (
              <TouchableOpacity
                key={time}
                style={styles.timeOption}
                onPress={() => selectTime(time)}
              >
                <Text variant="bodyLarge">{time}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Save Button */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        >
          Cancelar
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={updateMutation.isPending}
          disabled={!hasChanges || updateMutation.isPending}
          style={styles.saveButton}
        >
          Guardar Horario
        </Button>
      </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontWeight: '600',
  },
  headerSubtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  dayCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  dayCardInactive: {
    opacity: 0.7,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontWeight: '600',
  },
  dayNameInactive: {
    color: colors.textSecondary,
  },
  dayHours: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  shiftsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shiftRow: {
    marginBottom: spacing.sm,
  },
  shiftLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  shiftTimes: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    backgroundColor: colors.surfaceVariant,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  timeSeparator: {
    marginHorizontal: spacing.sm,
    color: colors.textSecondary,
  },
  shiftActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  copyOptions: {
    flexDirection: 'row',
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    borderRadius: 12,
    maxHeight: '70%',
  },
  modalTitle: {
    fontWeight: '600',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeList: {
    maxHeight: 400,
  },
  timeOption: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});

export default StaffScheduleScreen;
