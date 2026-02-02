import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  Chip,
  HelperText,
  SegmentedButtons,
  Avatar,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';

import { staffApi, servicesApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type CreateStaffNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateStaff'>;

interface Service {
  _id: string;
  name: string;
  category: string;
  isActive: boolean;
}

type Role = 'staff' | 'admin';

export const CreateStaffScreen: React.FC = () => {
  const navigation = useNavigation<CreateStaffNavigationProp>();
  const queryClient = useQueryClient();
  const currentBusiness = useCurrentBusiness();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => staffApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear el empleado';
      setErrors({ submit: message });
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
    // Services selection is optional - can be assigned later

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: any = {
      profile: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
      role,
      services: selectedServices,
    };

    if (email) data.profile.email = email.trim();
    if (phone) data.profile.phone = phone.trim();
    if (avatar) data.profile.avatar = avatar;

    createMutation.mutate(data);
  };

  const getInitials = () => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '??';
  };

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
          <Text variant="bodySmall" style={styles.avatarHint}>
            Toca para agregar foto
          </Text>
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
        <Text variant="bodySmall" style={styles.roleDescription}>
          {role === 'admin'
            ? 'Los administradores pueden gestionar turnos, empleados y ver reportes.'
            : 'Los empleados pueden ver y gestionar sus propios turnos.'}
        </Text>

        {/* Services */}
        <View style={styles.servicesHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Servicios Asignados
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

        {services.length === 0 && !servicesLoading && (
          <View style={styles.noServices}>
            <Icon name="tag-off-outline" size={48} color={colors.textTertiary} />
            <Text variant="bodyMedium" style={styles.noServicesText}>
              No hay servicios disponibles
            </Text>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('CreateService', {})}
            >
              Crear Servicio
            </Button>
          </View>
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
          loading={createMutation.isPending}
          disabled={createMutation.isPending}
          style={styles.saveButton}
        >
          Crear Empleado
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
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
  avatarHint: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
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
  roleDescription: {
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
  noServices: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noServicesText: {
    color: colors.textSecondary,
    marginVertical: spacing.md,
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

export default CreateStaffScreen;
