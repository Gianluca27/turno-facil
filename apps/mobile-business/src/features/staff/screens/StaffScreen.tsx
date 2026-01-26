import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import {
  Text,
  Card,
  Searchbar,
  FAB,
  ActivityIndicator,
  Avatar,
  Chip,
  Portal,
  Modal,
  Button,
  Divider,
  Switch,
  IconButton,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

import { staffApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

interface StaffSchedule {
  dayOfWeek: number;
  isWorking: boolean;
  shifts: { start: string; end: string }[];
}

interface Staff {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    phone?: string;
    email?: string;
  };
  role: 'owner' | 'admin' | 'staff';
  services: { _id: string; name: string }[];
  schedule: StaffSchedule[];
  isActive: boolean;
  stats: {
    totalAppointments: number;
    completedAppointments: number;
    averageRating?: number;
    totalReviews: number;
  };
  createdAt: string;
}

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ROLES: Record<string, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  staff: 'Empleado',
};

export const StaffScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const currentBusiness = useCurrentBusiness();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['staff', currentBusiness?.businessId],
    queryFn: () => staffApi.getAll(),
    enabled: !!currentBusiness,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ staffId, isActive }: { staffId: string; isActive: boolean }) =>
      staffApi.update(staffId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const staff: Staff[] = data?.data?.data?.staff || [];

  const filteredStaff = staff.filter((s) => {
    const fullName = `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return colors.primary;
      case 'admin':
        return colors.secondary;
      default:
        return colors.textSecondary;
    }
  };

  const getWorkingDays = (schedule: StaffSchedule[]) => {
    return schedule
      .filter((s) => s.isWorking)
      .map((s) => DAYS_OF_WEEK[s.dayOfWeek])
      .join(', ');
  };

  const renderStaffCard = useCallback(
    ({ item: member }: { item: Staff }) => (
      <Card
        style={[styles.staffCard, !member.isActive && styles.inactiveCard]}
        onPress={() => setSelectedStaff(member)}
      >
        <Card.Content style={styles.staffContent}>
          <View style={styles.staffAvatar}>
            {member.profile.avatar ? (
              <Avatar.Image size={56} source={{ uri: member.profile.avatar }} />
            ) : (
              <Avatar.Text
                size={56}
                label={getInitials(member.profile.firstName, member.profile.lastName)}
                style={{ backgroundColor: getRoleColor(member.role) }}
              />
            )}
            {!member.isActive && (
              <View style={styles.inactiveBadge}>
                <Icon name="pause" size={12} color={colors.background} />
              </View>
            )}
          </View>

          <View style={styles.staffInfo}>
            <View style={styles.staffHeader}>
              <Text variant="titleMedium" numberOfLines={1} style={styles.staffName}>
                {member.profile.firstName} {member.profile.lastName}
              </Text>
              <Chip
                compact
                style={[styles.roleChip, { backgroundColor: getRoleColor(member.role) + '20' }]}
                textStyle={[styles.roleChipText, { color: getRoleColor(member.role) }]}
              >
                {ROLES[member.role]}
              </Chip>
            </View>

            {member.profile.email && (
              <Text variant="bodyMedium" style={styles.staffEmail} numberOfLines={1}>
                {member.profile.email}
              </Text>
            )}

            <View style={styles.staffStats}>
              <View style={styles.statItem}>
                <Icon name="calendar-check" size={14} color={colors.textSecondary} />
                <Text variant="labelSmall" style={styles.statText}>
                  {member.stats.completedAppointments} turnos
                </Text>
              </View>
              {member.stats.averageRating && (
                <View style={styles.statItem}>
                  <Icon name="star" size={14} color="#F59E0B" />
                  <Text variant="labelSmall" style={styles.statText}>
                    {member.stats.averageRating.toFixed(1)} ({member.stats.totalReviews})
                  </Text>
                </View>
              )}
            </View>

            {member.services.length > 0 && (
              <View style={styles.servicesContainer}>
                {member.services.slice(0, 2).map((service) => (
                  <Chip
                    key={service._id}
                    compact
                    style={styles.serviceChip}
                    textStyle={styles.serviceChipText}
                  >
                    {service.name}
                  </Chip>
                ))}
                {member.services.length > 2 && (
                  <Text variant="labelSmall" style={styles.moreServicesText}>
                    +{member.services.length - 2}
                  </Text>
                )}
              </View>
            )}
          </View>

          <Icon name="chevron-right" size={24} color={colors.textTertiary} />
        </Card.Content>
      </Card>
    ),
    []
  );

  const renderStaffModal = () => (
    <Portal>
      <Modal
        visible={!!selectedStaff}
        onDismiss={() => setSelectedStaff(null)}
        contentContainerStyle={styles.modalContainer}
      >
        {selectedStaff && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              {selectedStaff.profile.avatar ? (
                <Avatar.Image size={80} source={{ uri: selectedStaff.profile.avatar }} />
              ) : (
                <Avatar.Text
                  size={80}
                  label={getInitials(
                    selectedStaff.profile.firstName,
                    selectedStaff.profile.lastName
                  )}
                  style={{ backgroundColor: getRoleColor(selectedStaff.role) }}
                />
              )}
              <Text variant="headlineSmall" style={styles.modalName}>
                {selectedStaff.profile.firstName} {selectedStaff.profile.lastName}
              </Text>
              <Chip
                compact
                style={[
                  styles.roleChip,
                  { backgroundColor: getRoleColor(selectedStaff.role) + '20' },
                ]}
                textStyle={[styles.roleChipText, { color: getRoleColor(selectedStaff.role) }]}
              >
                {ROLES[selectedStaff.role]}
              </Chip>
            </View>

            <View style={styles.statusToggle}>
              <View style={styles.statusInfo}>
                <Icon
                  name={selectedStaff.isActive ? 'check-circle' : 'pause-circle'}
                  size={24}
                  color={selectedStaff.isActive ? colors.success : colors.textSecondary}
                />
                <Text variant="bodyLarge" style={styles.statusText}>
                  {selectedStaff.isActive ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
              <Switch
                value={selectedStaff.isActive}
                onValueChange={(value) => {
                  toggleStatusMutation.mutate({
                    staffId: selectedStaff._id,
                    isActive: value,
                  });
                  setSelectedStaff({ ...selectedStaff, isActive: value });
                }}
                color={colors.primary}
              />
            </View>

            <Divider style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Información de Contacto
              </Text>
              {selectedStaff.profile.email && (
                <View style={styles.modalRow}>
                  <Icon name="email-outline" size={20} color={colors.textSecondary} />
                  <Text variant="bodyLarge" style={styles.modalRowText}>
                    {selectedStaff.profile.email}
                  </Text>
                </View>
              )}
              {selectedStaff.profile.phone && (
                <View style={styles.modalRow}>
                  <Icon name="phone-outline" size={20} color={colors.textSecondary} />
                  <Text variant="bodyLarge" style={styles.modalRowText}>
                    {selectedStaff.profile.phone}
                  </Text>
                </View>
              )}
            </View>

            <Divider style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Estadísticas
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text variant="headlineMedium" style={styles.statNumber}>
                    {selectedStaff.stats.totalAppointments}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Total Turnos
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text variant="headlineMedium" style={styles.statNumber}>
                    {selectedStaff.stats.completedAppointments}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Completados
                  </Text>
                </View>
                {selectedStaff.stats.averageRating && (
                  <View style={styles.statBox}>
                    <View style={styles.ratingContainer}>
                      <Text variant="headlineMedium" style={styles.statNumber}>
                        {selectedStaff.stats.averageRating.toFixed(1)}
                      </Text>
                      <Icon name="star" size={20} color="#F59E0B" />
                    </View>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      ({selectedStaff.stats.totalReviews} reviews)
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Divider style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Horario de Trabajo
              </Text>
              <Text variant="bodyMedium" style={styles.workingDaysText}>
                {getWorkingDays(selectedStaff.schedule) || 'Sin horario definido'}
              </Text>
            </View>

            {selectedStaff.services.length > 0 && (
              <>
                <Divider style={styles.modalDivider} />
                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Servicios Asignados ({selectedStaff.services.length})
                  </Text>
                  <View style={styles.modalServicesContainer}>
                    {selectedStaff.services.map((service) => (
                      <Chip key={service._id} style={styles.modalServiceChip}>
                        {service.name}
                      </Chip>
                    ))}
                  </View>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                icon="calendar"
                onPress={() => {
                  setSelectedStaff(null);
                  navigation.navigate('StaffSchedule', { staffId: selectedStaff._id });
                }}
                style={styles.modalActionButton}
              >
                Horarios
              </Button>
              <Button
                mode="contained"
                icon="pencil"
                onPress={() => {
                  setSelectedStaff(null);
                  navigation.navigate('EditStaff', { staffId: selectedStaff._id });
                }}
                style={styles.modalActionButton}
              >
                Editar
              </Button>
            </View>
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="account-group-outline" size={64} color={colors.textTertiary} />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No hay empleados
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {searchQuery
          ? 'No se encontraron empleados con ese criterio'
          : 'Agrega empleados para gestionar tu equipo'}
      </Text>
    </View>
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
      <Searchbar
        placeholder="Buscar empleados..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <FlatList
        data={filteredStaff}
        renderItem={renderStaffCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={renderEmpty}
      />

      {renderStaffModal()}

      <FAB
        icon="account-plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateStaff')}
      />
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
  searchbar: {
    margin: spacing.md,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  staffCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  inactiveCard: {
    opacity: 0.7,
  },
  staffContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffAvatar: {
    marginRight: spacing.md,
    position: 'relative',
  },
  inactiveBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.textSecondary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffInfo: {
    flex: 1,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  staffName: {
    fontWeight: '600',
    flex: 1,
  },
  roleChip: {
    height: 22,
  },
  roleChipText: {
    fontSize: 10,
  },
  staffEmail: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  staffStats: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: colors.textSecondary,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  serviceChip: {
    height: 22,
    backgroundColor: colors.surfaceVariant,
  },
  serviceChipText: {
    fontSize: 10,
    color: colors.text,
  },
  moreServicesText: {
    color: colors.textSecondary,
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.md,
    color: colors.text,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    borderRadius: 12,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalName: {
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    padding: spacing.md,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontWeight: '500',
  },
  modalDivider: {
    marginVertical: spacing.md,
  },
  modalSection: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalRowText: {
    marginLeft: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workingDaysText: {
    color: colors.textSecondary,
  },
  modalServicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalServiceChip: {
    backgroundColor: colors.surfaceVariant,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalActionButton: {
    flex: 1,
  },
});

export default StaffScreen;
