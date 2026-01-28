import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  HelperText,
  Switch,
  Avatar,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { servicesApi, staffApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type EditServiceRouteProp = RouteProp<RootStackParamList, 'EditService'>;
type EditServiceNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditService'>;

interface Staff {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  isActive: boolean;
}

interface Service {
  _id: string;
  name: string;
  description?: string;
  category: string;
  duration: number;
  price: number;
  discountedPrice?: number;
  isActive: boolean;
  requiresDeposit: boolean;
  depositAmount?: number;
  maxConcurrentBookings: number;
  staffIds: string[];
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];

const CATEGORIES = [
  'Corte',
  'Color',
  'Tratamiento',
  'Peinado',
  'Manicura',
  'Pedicura',
  'Maquillaje',
  'Depilación',
  'Masajes',
  'Otros',
];

export const EditServiceScreen: React.FC = () => {
  const navigation = useNavigation<EditServiceNavigationProp>();
  const route = useRoute<EditServiceRouteProp>();
  const queryClient = useQueryClient();
  const currentBusiness = useCurrentBusiness();
  const { serviceId } = route.params;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [maxConcurrentBookings, setMaxConcurrentBookings] = useState('1');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch service
  const { data: serviceData, isLoading: serviceLoading } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.get(serviceId),
  });

  const service: Service | undefined = serviceData?.data?.data?.service;

  // Initialize form
  useEffect(() => {
    if (service && !isInitialized) {
      setName(service.name);
      setDescription(service.description || '');
      if (CATEGORIES.includes(service.category)) {
        setCategory(service.category);
      } else {
        setShowCustomCategory(true);
        setCustomCategory(service.category);
      }
      setDuration(service.duration);
      setPrice(service.price.toString());
      setIsActive(service.isActive);
      setRequiresDeposit(service.requiresDeposit);
      setDepositAmount(service.depositAmount?.toString() || '');
      setMaxConcurrentBookings(service.maxConcurrentBookings.toString());
      setSelectedStaff(service.staffIds);
      setIsInitialized(true);
    }
  }, [service, isInitialized]);

  // Fetch staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', currentBusiness?.businessId],
    queryFn: () => staffApi.list(),
    enabled: !!currentBusiness,
  });

  const staff: Staff[] = useMemo(
    () => (staffData?.data?.data?.staff || []).filter((s: Staff) => s.isActive),
    [staffData]
  );

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => servicesApi.update(serviceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
      navigation.goBack();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar el servicio';
      setErrors({ submit: message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => servicesApi.delete(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo eliminar el servicio');
    },
  });

  const toggleStaff = (staffId: string) => {
    setSelectedStaff(prev => {
      if (prev.includes(staffId)) {
        return prev.filter(id => id !== staffId);
      }
      return [...prev, staffId];
    });
  };

  const selectAllStaff = () => {
    setSelectedStaff(staff.map(s => s._id));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (!category && !customCategory) {
      newErrors.category = 'La categoría es requerida';
    }
    if (!price || parseFloat(price) <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }
    if (requiresDeposit && (!depositAmount || parseFloat(depositAmount) <= 0)) {
      newErrors.depositAmount = 'El monto de seña es requerido';
    }
    if (requiresDeposit && parseFloat(depositAmount) > parseFloat(price)) {
      newErrors.depositAmount = 'La seña no puede ser mayor al precio';
    }
    if (selectedStaff.length === 0) {
      newErrors.staff = 'Selecciona al menos un profesional';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: any = {
      name: name.trim(),
      category: showCustomCategory ? customCategory.trim() : category,
      duration,
      price: parseFloat(price),
      staffIds: selectedStaff,
      maxConcurrentBookings: parseInt(maxConcurrentBookings, 10),
      isActive,
      requiresDeposit,
    };

    if (description.trim()) {
      data.description = description.trim();
    } else {
      data.description = null;
    }

    if (requiresDeposit) {
      data.depositAmount = parseFloat(depositAmount);
    } else {
      data.depositAmount = null;
    }

    updateMutation.mutate(data);
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Servicio',
      '¿Estás seguro que deseas eliminar este servicio? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  if (serviceLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={64} color={colors.error} />
        <Text variant="titleMedium" style={styles.errorText}>
          Servicio no encontrado
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Volver
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Active Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusInfo}>
            <Icon
              name={isActive ? 'check-circle' : 'pause-circle'}
              size={24}
              color={isActive ? colors.success : colors.textSecondary}
            />
            <Text variant="bodyLarge" style={styles.statusText}>
              {isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            color={colors.primary}
          />
        </View>

        {/* Basic Info */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Información del Servicio
        </Text>

        <TextInput
          label="Nombre del servicio *"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
          }}
          style={styles.input}
          mode="outlined"
          error={!!errors.name}
        />
        {errors.name && <HelperText type="error">{errors.name}</HelperText>}

        <TextInput
          label="Descripción (opcional)"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
          mode="outlined"
          multiline
          numberOfLines={3}
        />

        {/* Category */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Categoría *
        </Text>

        {!showCustomCategory ? (
          <>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => {
                    setCategory(cat);
                    if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                  }}
                >
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.categoryText,
                      category === cat && styles.categoryTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              mode="text"
              icon="plus"
              onPress={() => setShowCustomCategory(true)}
              style={styles.customCategoryButton}
            >
              Categoría personalizada
            </Button>
          </>
        ) : (
          <>
            <TextInput
              label="Categoría personalizada"
              value={customCategory}
              onChangeText={(text) => {
                setCustomCategory(text);
                if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
              }}
              style={styles.input}
              mode="outlined"
              error={!!errors.category}
            />
            <Button
              mode="text"
              onPress={() => {
                setShowCustomCategory(false);
                setCustomCategory('');
              }}
              style={styles.customCategoryButton}
            >
              Usar categorías predefinidas
            </Button>
          </>
        )}
        {errors.category && <HelperText type="error">{errors.category}</HelperText>}

        {/* Duration */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Duración *
        </Text>
        <View style={styles.durationGrid}>
          {DURATION_OPTIONS.map(mins => (
            <TouchableOpacity
              key={mins}
              style={[
                styles.durationChip,
                duration === mins && styles.durationChipSelected,
              ]}
              onPress={() => setDuration(mins)}
            >
              <Text
                variant="bodyMedium"
                style={[
                  styles.durationText,
                  duration === mins && styles.durationTextSelected,
                ]}
              >
                {formatDuration(mins)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Precio *
        </Text>
        <TextInput
          label="Precio"
          value={price}
          onChangeText={(text) => {
            setPrice(text.replace(/[^0-9.]/g, ''));
            if (errors.price) setErrors(prev => ({ ...prev, price: '' }));
          }}
          style={styles.input}
          mode="outlined"
          keyboardType="decimal-pad"
          left={<TextInput.Affix text="$" />}
          error={!!errors.price}
        />
        {errors.price && <HelperText type="error">{errors.price}</HelperText>}

        {/* Deposit */}
        <View style={styles.depositRow}>
          <View style={styles.depositInfo}>
            <Text variant="titleMedium">Requiere Seña</Text>
            <Text variant="bodySmall" style={styles.depositHint}>
              El cliente debe pagar un anticipo para reservar
            </Text>
          </View>
          <Switch
            value={requiresDeposit}
            onValueChange={setRequiresDeposit}
            color={colors.primary}
          />
        </View>

        {requiresDeposit && (
          <>
            <TextInput
              label="Monto de seña"
              value={depositAmount}
              onChangeText={(text) => {
                setDepositAmount(text.replace(/[^0-9.]/g, ''));
                if (errors.depositAmount) setErrors(prev => ({ ...prev, depositAmount: '' }));
              }}
              style={styles.input}
              mode="outlined"
              keyboardType="decimal-pad"
              left={<TextInput.Affix text="$" />}
              error={!!errors.depositAmount}
            />
            {errors.depositAmount && <HelperText type="error">{errors.depositAmount}</HelperText>}
          </>
        )}

        {/* Concurrent Bookings */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Reservas Simultáneas
        </Text>
        <Text variant="bodySmall" style={styles.concurrentHint}>
          Cantidad máxima de clientes que pueden reservar este servicio al mismo tiempo
        </Text>
        <View style={styles.concurrentRow}>
          <TouchableOpacity
            style={styles.concurrentButton}
            onPress={() => setMaxConcurrentBookings(prev => Math.max(1, parseInt(prev, 10) - 1).toString())}
          >
            <Icon name="minus" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text variant="titleLarge" style={styles.concurrentValue}>
            {maxConcurrentBookings}
          </Text>
          <TouchableOpacity
            style={styles.concurrentButton}
            onPress={() => setMaxConcurrentBookings(prev => (parseInt(prev, 10) + 1).toString())}
          >
            <Icon name="plus" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Staff Assignment */}
        <View style={styles.staffHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Profesionales Asignados *
          </Text>
          <Button mode="text" compact onPress={selectAllStaff}>
            Seleccionar todos
          </Button>
        </View>

        {errors.staff && (
          <HelperText type="error" style={styles.staffError}>
            {errors.staff}
          </HelperText>
        )}

        {staffLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <View style={styles.staffGrid}>
            {staff.map(member => {
              const isSelected = selectedStaff.includes(member._id);
              return (
                <TouchableOpacity
                  key={member._id}
                  style={[styles.staffItem, isSelected && styles.staffItemSelected]}
                  onPress={() => toggleStaff(member._id)}
                >
                  {member.profile.avatar ? (
                    <Avatar.Image size={40} source={{ uri: member.profile.avatar }} />
                  ) : (
                    <Avatar.Text
                      size={40}
                      label={`${member.profile.firstName.charAt(0)}${member.profile.lastName.charAt(0)}`}
                      style={{ backgroundColor: isSelected ? colors.primary : colors.primary + '30' }}
                      labelStyle={{ color: isSelected ? colors.textOnPrimary : colors.primary }}
                    />
                  )}
                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    style={[styles.staffName, isSelected && styles.staffNameSelected]}
                  >
                    {member.profile.firstName}
                  </Text>
                  {isSelected && (
                    <View style={styles.staffCheck}>
                      <Icon name="check" size={12} color={colors.textOnPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Delete Button */}
        <Button
          mode="outlined"
          icon="delete"
          onPress={handleDelete}
          loading={deleteMutation.isPending}
          textColor={colors.error}
          style={styles.deleteButton}
        >
          Eliminar Servicio
        </Button>

        {errors.submit && (
          <HelperText type="error" style={styles.submitError}>
            {errors.submit}
          </HelperText>
        )}
      </ScrollView>

      {/* Bottom Actions */}
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
          onPress={handleSubmit}
          loading={updateMutation.isPending}
          disabled={updateMutation.isPending}
          style={styles.saveButton}
        >
          Guardar Cambios
        </Button>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.textSecondary,
    marginVertical: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontWeight: '500',
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  categoryText: {
    color: colors.textSecondary,
  },
  categoryTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  customCategoryButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 70,
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationText: {
    color: colors.text,
  },
  durationTextSelected: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  depositRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  depositInfo: {
    flex: 1,
  },
  depositHint: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  concurrentHint: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  concurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  concurrentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  concurrentValue: {
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  staffError: {
    marginTop: -spacing.sm,
  },
  loader: {
    marginTop: spacing.lg,
  },
  staffGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  staffItem: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    width: 80,
    position: 'relative',
  },
  staffItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  staffName: {
    marginTop: spacing.xs,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  staffNameSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  staffCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    marginTop: spacing.xl,
    borderColor: colors.error,
  },
  submitError: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: spacing.md,
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

export default EditServiceScreen;
