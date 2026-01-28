import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  Text,
  Button,
  TextInput,
  ActivityIndicator,
  Card,
  Chip,
  Avatar,
  Divider,
  HelperText,
  Searchbar,
  Portal,
  Modal,
  RadioButton,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, addDays, isBefore, startOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { appointmentsApi, clientsApi, staffApi, servicesApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type CreateAppointmentRouteProp = RouteProp<RootStackParamList, 'CreateAppointment'>;
type CreateAppointmentNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateAppointment'>;

interface Client {
  _id: string;
  info: {
    name: string;
    phone?: string;
    email?: string;
  };
  isVip?: boolean;
}

interface Staff {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  isActive: boolean;
  services: { _id: string }[];
}

interface Service {
  _id: string;
  name: string;
  duration: number;
  price: number;
  discountedPrice?: number;
  isActive: boolean;
  staffIds: string[];
}

type Step = 'client' | 'service' | 'staff' | 'datetime' | 'confirm';

export const CreateAppointmentScreen: React.FC = () => {
  const navigation = useNavigation<CreateAppointmentNavigationProp>();
  const route = useRoute<CreateAppointmentRouteProp>();
  const queryClient = useQueryClient();
  const currentBusiness = useCurrentBusiness();

  // Steps
  const [currentStep, setCurrentStep] = useState<Step>('client');

  // Client selection
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  // Service selection
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  // Staff selection
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  // Date/Time selection
  const [selectedDate, setSelectedDate] = useState<Date>(
    route.params?.date ? parseISO(route.params.date) : new Date()
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');

  // Fetch clients
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', currentBusiness?.businessId, clientSearch],
    queryFn: () => clientsApi.list({ q: clientSearch || undefined, limit: 20 }),
    enabled: !!currentBusiness && currentStep === 'client',
  });

  const clients: Client[] = clientsData?.data?.data?.clients || [];

  // Fetch services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', currentBusiness?.businessId],
    queryFn: () => servicesApi.list(),
    enabled: !!currentBusiness,
  });

  const services: Service[] = useMemo(
    () => (servicesData?.data?.data?.services || []).filter((s: Service) => s.isActive),
    [servicesData]
  );

  // Fetch staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', currentBusiness?.businessId],
    queryFn: () => staffApi.list(),
    enabled: !!currentBusiness,
  });

  const allStaff: Staff[] = useMemo(
    () => (staffData?.data?.data?.staff || []).filter((s: Staff) => s.isActive),
    [staffData]
  );

  // Filter staff based on selected services
  const availableStaff = useMemo(() => {
    if (selectedServices.length === 0) return allStaff;
    const selectedServiceIds = selectedServices.map(s => s._id);
    return allStaff.filter(staff =>
      selectedServiceIds.every(serviceId =>
        staff.services.some(s => s._id === serviceId)
      )
    );
  }, [allStaff, selectedServices]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // Generate next 14 days
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    let totalDuration = 0;
    let totalPrice = 0;
    selectedServices.forEach(service => {
      totalDuration += service.duration;
      totalPrice += service.discountedPrice || service.price;
    });
    return { duration: totalDuration, price: totalPrice };
  }, [selectedServices]);

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => appointmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      navigation.goBack();
    },
  });

  // Handlers
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setIsNewClient(false);
    setCurrentStep('service');
  };

  const handleNewClient = () => {
    setIsNewClient(true);
    setSelectedClient(null);
  };

  const handleConfirmNewClient = () => {
    if (newClientName.trim() && newClientPhone.trim()) {
      setCurrentStep('service');
    }
  };

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s._id === service._id);
      if (exists) {
        return prev.filter(s => s._id !== service._id);
      }
      return [...prev, service];
    });
    // Reset staff if it's no longer compatible
    if (selectedStaff && !service.staffIds.includes(selectedStaff._id)) {
      setSelectedStaff(null);
    }
  };

  const handleSelectStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setCurrentStep('datetime');
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setCurrentStep('confirm');
  };

  const handleSubmit = () => {
    const appointmentData: any = {
      serviceIds: selectedServices.map(s => s._id),
      staffId: selectedStaff?._id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: selectedTime,
      notes: notes || undefined,
    };

    if (isNewClient) {
      appointmentData.clientName = newClientName;
      appointmentData.clientPhone = newClientPhone;
      if (newClientEmail) appointmentData.clientEmail = newClientEmail;
    } else if (selectedClient) {
      appointmentData.clientId = selectedClient._id;
    }

    createMutation.mutate(appointmentData);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'client':
        return isNewClient ? (newClientName.trim().length > 0 && newClientPhone.trim().length > 0) : !!selectedClient;
      case 'service':
        return selectedServices.length > 0;
      case 'staff':
        return !!selectedStaff;
      case 'datetime':
        return !!selectedTime;
      default:
        return true;
    }
  };

  const goBack = () => {
    const steps: Step[] = ['client', 'service', 'staff', 'datetime', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      navigation.goBack();
    }
  };

  const goNext = () => {
    const steps: Step[] = ['client', 'service', 'staff', 'datetime', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      if (currentStep === 'client' && isNewClient) {
        handleConfirmNewClient();
      } else {
        setCurrentStep(steps[currentIndex + 1]);
      }
    }
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = [
      { key: 'client', label: 'Cliente', icon: 'account' },
      { key: 'service', label: 'Servicio', icon: 'tag' },
      { key: 'staff', label: 'Profesional', icon: 'account-tie' },
      { key: 'datetime', label: 'Fecha/Hora', icon: 'calendar-clock' },
      { key: 'confirm', label: 'Confirmar', icon: 'check-circle' },
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <TouchableOpacity
              style={[
                styles.stepDot,
                index <= currentIndex && styles.stepDotActive,
              ]}
              onPress={() => index < currentIndex && setCurrentStep(step.key as Step)}
              disabled={index >= currentIndex}
            >
              <Icon
                name={step.icon}
                size={16}
                color={index <= currentIndex ? colors.textOnPrimary : colors.textTertiary}
              />
            </TouchableOpacity>
            {index < steps.length - 1 && (
              <View style={[styles.stepLine, index < currentIndex && styles.stepLineActive]} />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  // Render client step
  const renderClientStep = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Seleccionar Cliente
      </Text>

      {!isNewClient ? (
        <>
          <Searchbar
            placeholder="Buscar por nombre o teléfono..."
            value={clientSearch}
            onChangeText={setClientSearch}
            style={styles.searchbar}
          />

          <TouchableOpacity style={styles.newClientButton} onPress={handleNewClient}>
            <Icon name="account-plus" size={24} color={colors.primary} />
            <Text variant="bodyLarge" style={styles.newClientText}>
              Nuevo cliente (sin registro)
            </Text>
          </TouchableOpacity>

          {clientsLoading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <ScrollView style={styles.clientList}>
              {clients.map(client => (
                <TouchableOpacity
                  key={client._id}
                  style={[
                    styles.clientItem,
                    selectedClient?._id === client._id && styles.clientItemSelected,
                  ]}
                  onPress={() => handleSelectClient(client)}
                >
                  <Avatar.Text
                    size={40}
                    label={client.info.name.charAt(0).toUpperCase()}
                    style={{ backgroundColor: colors.primary + '30' }}
                    labelStyle={{ color: colors.primary }}
                  />
                  <View style={styles.clientInfo}>
                    <View style={styles.clientNameRow}>
                      <Text variant="titleMedium">{client.info.name}</Text>
                      {client.isVip && (
                        <Icon name="star" size={16} color="#F59E0B" style={styles.vipIcon} />
                      )}
                    </View>
                    {client.info.phone && (
                      <Text variant="bodySmall" style={styles.clientPhone}>
                        {client.info.phone}
                      </Text>
                    )}
                  </View>
                  <Icon name="chevron-right" size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              {clients.length === 0 && clientSearch && (
                <Text variant="bodyMedium" style={styles.noResults}>
                  No se encontraron clientes
                </Text>
              )}
            </ScrollView>
          )}
        </>
      ) : (
        <View style={styles.newClientForm}>
          <TouchableOpacity style={styles.backToSearch} onPress={() => setIsNewClient(false)}>
            <Icon name="arrow-left" size={20} color={colors.primary} />
            <Text variant="bodyMedium" style={styles.backToSearchText}>
              Volver a buscar
            </Text>
          </TouchableOpacity>

          <TextInput
            label="Nombre del cliente *"
            value={newClientName}
            onChangeText={setNewClientName}
            style={styles.input}
            mode="outlined"
          />
          <TextInput
            label="Teléfono *"
            value={newClientPhone}
            onChangeText={setNewClientPhone}
            style={styles.input}
            mode="outlined"
            keyboardType="phone-pad"
          />
          <TextInput
            label="Email (opcional)"
            value={newClientEmail}
            onChangeText={setNewClientEmail}
            style={styles.input}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      )}
    </View>
  );

  // Render service step
  const renderServiceStep = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Seleccionar Servicios
      </Text>

      {servicesLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <ScrollView style={styles.serviceList}>
          {services.map(service => {
            const isSelected = selectedServices.some(s => s._id === service._id);
            return (
              <TouchableOpacity
                key={service._id}
                style={[styles.serviceItem, isSelected && styles.serviceItemSelected]}
                onPress={() => toggleService(service)}
              >
                <View style={styles.serviceCheckbox}>
                  <Icon
                    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text variant="titleMedium">{service.name}</Text>
                  <View style={styles.serviceDetails}>
                    <View style={styles.serviceDetail}>
                      <Icon name="clock-outline" size={14} color={colors.textSecondary} />
                      <Text variant="bodySmall" style={styles.serviceDetailText}>
                        {service.duration} min
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.servicePrice}>
                  {service.discountedPrice ? (
                    <>
                      <Text variant="bodySmall" style={styles.originalPrice}>
                        ${service.price}
                      </Text>
                      <Text variant="titleMedium" style={styles.discountedPrice}>
                        ${service.discountedPrice}
                      </Text>
                    </>
                  ) : (
                    <Text variant="titleMedium" style={styles.price}>
                      ${service.price}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {selectedServices.length > 0 && (
        <View style={styles.totalBar}>
          <View>
            <Text variant="bodySmall" style={styles.totalLabel}>
              {selectedServices.length} servicio(s) - {totals.duration} min
            </Text>
            <Text variant="titleLarge" style={styles.totalPrice}>
              Total: ${totals.price}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  // Render staff step
  const renderStaffStep = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Seleccionar Profesional
      </Text>

      {staffLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <ScrollView style={styles.staffList}>
          {availableStaff.map(staff => (
            <TouchableOpacity
              key={staff._id}
              style={[
                styles.staffItem,
                selectedStaff?._id === staff._id && styles.staffItemSelected,
              ]}
              onPress={() => handleSelectStaff(staff)}
            >
              {staff.profile.avatar ? (
                <Avatar.Image size={48} source={{ uri: staff.profile.avatar }} />
              ) : (
                <Avatar.Text
                  size={48}
                  label={`${staff.profile.firstName.charAt(0)}${staff.profile.lastName.charAt(0)}`}
                  style={{ backgroundColor: colors.secondary + '30' }}
                  labelStyle={{ color: colors.secondary }}
                />
              )}
              <View style={styles.staffInfo}>
                <Text variant="titleMedium">
                  {staff.profile.firstName} {staff.profile.lastName}
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
          {availableStaff.length === 0 && (
            <Text variant="bodyMedium" style={styles.noResults}>
              No hay profesionales disponibles para los servicios seleccionados
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );

  // Render datetime step
  const renderDateTimeStep = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Fecha y Hora
      </Text>

      <Text variant="titleMedium" style={styles.sectionLabel}>
        Seleccionar fecha
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
        {availableDates.map(date => {
          const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[styles.dateItem, isSelected && styles.dateItemSelected]}
              onPress={() => {
                setSelectedDate(date);
                setSelectedTime(null);
              }}
            >
              <Text
                variant="labelSmall"
                style={[styles.dateDayName, isSelected && styles.dateTextSelected]}
              >
                {isToday ? 'Hoy' : format(date, 'EEE', { locale: es })}
              </Text>
              <Text
                variant="titleLarge"
                style={[styles.dateDayNumber, isSelected && styles.dateTextSelected]}
              >
                {format(date, 'd')}
              </Text>
              <Text
                variant="labelSmall"
                style={[styles.dateMonth, isSelected && styles.dateTextSelected]}
              >
                {format(date, 'MMM', { locale: es })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Divider style={styles.divider} />

      <Text variant="titleMedium" style={styles.sectionLabel}>
        Seleccionar hora
      </Text>
      <View style={styles.timeGrid}>
        {timeSlots.map(time => {
          const isSelected = selectedTime === time;
          return (
            <TouchableOpacity
              key={time}
              style={[styles.timeItem, isSelected && styles.timeItemSelected]}
              onPress={() => handleSelectTime(time)}
            >
              <Text
                variant="bodyMedium"
                style={[styles.timeText, isSelected && styles.timeTextSelected]}
              >
                {time}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Render confirm step
  const renderConfirmStep = () => (
    <ScrollView style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Confirmar Turno
      </Text>

      <Card style={styles.confirmCard}>
        <Card.Content>
          {/* Client */}
          <View style={styles.confirmSection}>
            <View style={styles.confirmIcon}>
              <Icon name="account" size={24} color={colors.primary} />
            </View>
            <View style={styles.confirmInfo}>
              <Text variant="labelMedium" style={styles.confirmLabel}>
                Cliente
              </Text>
              <Text variant="titleMedium">
                {isNewClient ? newClientName : selectedClient?.info.name}
              </Text>
              <Text variant="bodySmall" style={styles.confirmSubtext}>
                {isNewClient ? newClientPhone : selectedClient?.info.phone}
              </Text>
            </View>
          </View>

          <Divider style={styles.confirmDivider} />

          {/* Services */}
          <View style={styles.confirmSection}>
            <View style={styles.confirmIcon}>
              <Icon name="tag" size={24} color={colors.primary} />
            </View>
            <View style={styles.confirmInfo}>
              <Text variant="labelMedium" style={styles.confirmLabel}>
                Servicios
              </Text>
              {selectedServices.map(service => (
                <View key={service._id} style={styles.confirmServiceRow}>
                  <Text variant="bodyMedium">{service.name}</Text>
                  <Text variant="bodyMedium" style={styles.confirmServicePrice}>
                    ${service.discountedPrice || service.price}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Divider style={styles.confirmDivider} />

          {/* Staff */}
          <View style={styles.confirmSection}>
            <View style={styles.confirmIcon}>
              <Icon name="account-tie" size={24} color={colors.primary} />
            </View>
            <View style={styles.confirmInfo}>
              <Text variant="labelMedium" style={styles.confirmLabel}>
                Profesional
              </Text>
              <Text variant="titleMedium">
                {selectedStaff?.profile.firstName} {selectedStaff?.profile.lastName}
              </Text>
            </View>
          </View>

          <Divider style={styles.confirmDivider} />

          {/* DateTime */}
          <View style={styles.confirmSection}>
            <View style={styles.confirmIcon}>
              <Icon name="calendar-clock" size={24} color={colors.primary} />
            </View>
            <View style={styles.confirmInfo}>
              <Text variant="labelMedium" style={styles.confirmLabel}>
                Fecha y Hora
              </Text>
              <Text variant="titleMedium">
                {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
              </Text>
              <Text variant="bodyMedium" style={styles.confirmSubtext}>
                {selectedTime} - Duración: {totals.duration} min
              </Text>
            </View>
          </View>

          <Divider style={styles.confirmDivider} />

          {/* Total */}
          <View style={styles.confirmTotal}>
            <Text variant="titleMedium">Total</Text>
            <Text variant="headlineMedium" style={styles.confirmTotalPrice}>
              ${totals.price}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <TextInput
        label="Notas (opcional)"
        value={notes}
        onChangeText={setNotes}
        style={styles.notesInput}
        mode="outlined"
        multiline
        numberOfLines={3}
      />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text variant="titleLarge" style={styles.headerTitle}>
          Nuevo Turno
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Content */}
      <View style={styles.content}>
        {currentStep === 'client' && renderClientStep()}
        {currentStep === 'service' && renderServiceStep()}
        {currentStep === 'staff' && renderStaffStep()}
        {currentStep === 'datetime' && renderDateTimeStep()}
        {currentStep === 'confirm' && renderConfirmStep()}
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {currentStep === 'confirm' ? (
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
            style={styles.confirmButton}
            contentStyle={styles.confirmButtonContent}
          >
            Confirmar Turno
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={goNext}
            disabled={!canProceed()}
            style={styles.nextButton}
            contentStyle={styles.nextButtonContent}
          >
            Continuar
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: spacing.md,
  },
  stepTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  searchbar: {
    backgroundColor: colors.surfaceVariant,
    marginBottom: spacing.md,
  },
  newClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  newClientText: {
    marginLeft: spacing.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  clientList: {
    flex: 1,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  clientItemSelected: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  clientInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vipIcon: {
    marginLeft: spacing.xs,
  },
  clientPhone: {
    color: colors.textSecondary,
  },
  noResults: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  newClientForm: {
    flex: 1,
  },
  backToSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backToSearchText: {
    marginLeft: spacing.xs,
    color: colors.primary,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  loader: {
    marginTop: spacing.xl,
  },
  serviceList: {
    flex: 1,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  serviceItemSelected: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  serviceCheckbox: {
    marginRight: spacing.md,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceDetails: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  serviceDetailText: {
    marginLeft: 4,
    color: colors.textSecondary,
  },
  servicePrice: {
    alignItems: 'flex-end',
  },
  price: {
    fontWeight: '600',
    color: colors.primary,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  discountedPrice: {
    fontWeight: '600',
    color: colors.success,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  totalLabel: {
    color: colors.textSecondary,
  },
  totalPrice: {
    fontWeight: '700',
    color: colors.primary,
  },
  staffList: {
    flex: 1,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  staffItemSelected: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  staffInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  dateScroll: {
    marginBottom: spacing.md,
  },
  dateItem: {
    width: 64,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    marginRight: spacing.sm,
  },
  dateItemSelected: {
    backgroundColor: colors.primary,
  },
  dateDayName: {
    textTransform: 'capitalize',
    color: colors.textSecondary,
  },
  dateDayNumber: {
    fontWeight: '700',
  },
  dateMonth: {
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  dateTextSelected: {
    color: colors.textOnPrimary,
  },
  divider: {
    marginVertical: spacing.md,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  timeItemSelected: {
    backgroundColor: colors.primary,
  },
  timeText: {
    color: colors.text,
  },
  timeTextSelected: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  confirmCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  confirmSection: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  confirmIcon: {
    width: 40,
    alignItems: 'center',
    marginTop: 2,
  },
  confirmInfo: {
    flex: 1,
  },
  confirmLabel: {
    color: colors.textSecondary,
    marginBottom: 2,
  },
  confirmSubtext: {
    color: colors.textSecondary,
  },
  confirmDivider: {
    marginVertical: spacing.sm,
  },
  confirmServiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  confirmServicePrice: {
    color: colors.textSecondary,
  },
  confirmTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  confirmTotalPrice: {
    fontWeight: '700',
    color: colors.primary,
  },
  notesInput: {
    backgroundColor: colors.background,
  },
  bottomActions: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    borderRadius: 8,
  },
  nextButtonContent: {
    paddingVertical: spacing.xs,
  },
  confirmButton: {
    borderRadius: 8,
  },
  confirmButtonContent: {
    paddingVertical: spacing.xs,
  },
});

export default CreateAppointmentScreen;
