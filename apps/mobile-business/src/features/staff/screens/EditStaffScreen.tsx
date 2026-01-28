import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  HelperText,
  SegmentedButtons,
  Avatar,
  Switch,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';

import { staffApi, servicesApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type EditStaffRouteProp = RouteProp<RootStackParamList, 'EditStaff'>;
type EditStaffNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditStaff'>;

interface Service {
  _id: string;
  name: string;
  category: string;
  isActive: boolean;
}

interface Staff {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  role: 'owner' | 'admin' | 'staff';
  services: { _id: string; name: string }[];
  isActive: boolean;
}

type Role = 'staff' | 'admin';

export const EditStaffScreen: React.FC = () => {
  const navigation = useNavigation<EditStaffNavigationProp>();
  const route = useRoute<EditStaffRouteProp>();
  const queryClient = useQueryClient();
  const currentBusiness = useCurrentBusiness();
  const { staffId } = route.params;

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', staffId],
    queryFn: () => staffApi.get(staffId),
  });

  const staff: Staff | undefined = staffData?.data?.data?.staff;

  // Initialize form with staff data
  useEffect(() => {
    if (staff && !isInitialized) {
      setFirstName(staff.profile.firstName);
      setLastName(staff.profile.lastName);
      setEmail(staff.profile.email || '');
      setPhone(staff.profile.phone || '');
      setRole(staff.role === 'owner' ? 'admin' : staff.role);
      setAvatar(staff.profile.avatar || null);
      setIsActive(staff.isActive);
      setSelectedServices(staff.services.map(s => s._id));
      setIsInitialized(true);
    }
  }, [staff, isInitialized]);

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

  // Group services by category
  const groupedServices = useMemo(() => {
    const grouped: Record<string, Service[]> = {};
    services.forEach(service => {
      const category = service.category || 'Sin categoría';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(service);
    });
    return grouped;
  }, [services]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => staffApi.update(staffId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff', staffId] });
      navigation.goBack();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar el empleado';
      setErrors({ submit: message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => staffApi.delete(staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo eliminar el empleado');
    },
  });

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      }
      return [...prev, serviceId];
    });
  };

  const selectAllServices = () => {
    setSelectedServices(services.map(s => s._id));
  };

  const deselectAllServices = () => {
    setSelectedServices([]);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'El nombre es requerido';
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'El apellido es requerido';
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }
    if (phone && phone.length < 8) {
      newErrors.phone = 'Teléfono inválido';
    }
    if (selectedServices.length === 0) {
      newErrors.services = 'Selecciona al menos un servicio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: any = {
      profile: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        avatar: avatar || undefined,
      },
      role,
      isActive,
    };

    updateMutation.mutate(data);
  };

  const handleUpdateServices = () => {
    staffApi.assignServices(staffId, selectedServices).then(() => {
      queryClient.invalidateQueries({ queryKey: ['staff', staffId] });
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Empleado',
      '¿Estás seguro que deseas eliminar este empleado? Esta acción no se puede deshacer.',
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

  const getInitials = () => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '??';
  };

  if (staffLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!staff) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={64} color={colors.error} />
        <Text variant="titleMedium" style={styles.errorText}>
          Empleado no encontrado
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Volver
        </Button>
      </View>
    );
  }

  const isOwner = staff.role === 'owner';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
            {avatar ? (
              <Avatar.Image size={100} source={{ uri: avatar }} />
            ) : (
              <Avatar.Text
                size={100}
                label={getInitials()}
                style={{ backgroundColor: colors.primary + '30' }}
                labelStyle={{ color: colors.primary }}
              />
            )}
            <View style={styles.avatarEditBadge}>
              <Icon name="camera" size={16} color={colors.textOnPrimary} />
            </View>
          </TouchableOpacity>
        </View>

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
            disabled={isOwner}
          />
        </View>

        {/* Basic Info */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Información Personal
        </Text>

        <TextInput
          label="Nombre *"
          value={firstName}
          onChangeText={(text) => {
            setFirstName(text);
            if (errors.firstName) setErrors(prev => ({ ...prev, firstName: '' }));
          }}
          style={styles.input}
          mode="outlined"
          error={!!errors.firstName}
        />
        {errors.firstName && <HelperText type="error">{errors.firstName}</HelperText>}

        <TextInput
          label="Apellido *"
          value={lastName}
          onChangeText={(text) => {
            setLastName(text);
            if (errors.lastName) setErrors(prev => ({ ...prev, lastName: '' }));
          }}
          style={styles.input}
          mode="outlined"
          error={!!errors.lastName}
        />
        {errors.lastName && <HelperText type="error">{errors.lastName}</HelperText>}

        <TextInput
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
          }}
          style={styles.input}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          error={!!errors.email}
        />
        {errors.email && <HelperText type="error">{errors.email}</HelperText>}

        <TextInput
          label="Teléfono"
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
          }}
          style={styles.input}
          mode="outlined"
          keyboardType="phone-pad"
          error={!!errors.phone}
        />
        {errors.phone && <HelperText type="error">{errors.phone}</HelperText>}

        {/* Role */}
        {!isOwner && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Rol
            </Text>
            <SegmentedButtons
              value={role}
              onValueChange={(value) => setRole(value as Role)}
              buttons={[
                {
                  value: 'staff',
                  label: 'Empleado',
                  icon: 'account',
                },
                {
                  value: 'admin',
                  label: 'Administrador',
                  icon: 'shield-account',
                },
              ]}
              style={styles.roleButtons}
            />
          </>
        )}

        {isOwner && (
          <View style={styles.ownerBadge}>
            <Icon name="crown" size={20} color={colors.warning} />
            <Text variant="bodyMedium" style={styles.ownerText}>
              Dueño del negocio
            </Text>
          </View>
        )}

        {/* Services */}
        <View style={styles.servicesHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Servicios Asignados *
          </Text>
          <View style={styles.servicesActions}>
            <Button
              mode="text"
              compact
              onPress={selectAllServices}
              disabled={services.length === selectedServices.length}
            >
              Todos
            </Button>
            <Button
              mode="text"
              compact
              onPress={deselectAllServices}
              disabled={selectedServices.length === 0}
            >
              Ninguno
            </Button>
          </View>
        </View>

        {errors.services && (
          <HelperText type="error" style={styles.servicesError}>
            {errors.services}
          </HelperText>
        )}

        {servicesLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          Object.entries(groupedServices).map(([category, categoryServices]) => (
            <View key={category} style={styles.serviceCategory}>
              <Text variant="labelLarge" style={styles.categoryLabel}>
                {category}
              </Text>
              <View style={styles.servicesGrid}>
                {categoryServices.map(service => {
                  const isSelected = selectedServices.includes(service._id);
                  return (
                    <TouchableOpacity
                      key={service._id}
                      style={[
                        styles.serviceChip,
                        isSelected && styles.serviceChipSelected,
                      ]}
                      onPress={() => toggleService(service._id)}
                    >
                      <Icon
                        name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                        size={18}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.serviceChipText,
                          isSelected && styles.serviceChipTextSelected,
                        ]}
                      >
                        {service.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {/* Schedule Link */}
        <TouchableOpacity
          style={styles.scheduleLink}
          onPress={() => navigation.navigate('StaffSchedule', { staffId })}
        >
          <View style={styles.scheduleLinkContent}>
            <Icon name="calendar-clock" size={24} color={colors.primary} />
            <View style={styles.scheduleLinkText}>
              <Text variant="titleMedium">Horario de Trabajo</Text>
              <Text variant="bodySmall" style={styles.scheduleLinkHint}>
                Configurar días y horarios de trabajo
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Delete Button */}
        {!isOwner && (
          <Button
            mode="outlined"
            icon="delete"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
            textColor={colors.error}
            style={styles.deleteButton}
          >
            Eliminar Empleado
          </Button>
        )}

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
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
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
  roleButtons: {
    marginBottom: spacing.sm,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  ownerText: {
    color: colors.warning,
    fontWeight: '500',
  },
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  servicesActions: {
    flexDirection: 'row',
  },
  servicesError: {
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  loader: {
    marginTop: spacing.lg,
  },
  serviceCategory: {
    marginTop: spacing.md,
  },
  categoryLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  serviceChipSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  serviceChipText: {
    marginLeft: spacing.xs,
    color: colors.textSecondary,
  },
  serviceChipTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  scheduleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  scheduleLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scheduleLinkText: {
    flex: 1,
  },
  scheduleLinkHint: {
    color: colors.textSecondary,
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

export default EditStaffScreen;
