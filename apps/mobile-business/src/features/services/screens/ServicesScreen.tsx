import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Searchbar,
  FAB,
  ActivityIndicator,
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

import { servicesApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

interface Service {
  _id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  discountedPrice?: number;
  category: string;
  isActive: boolean;
  requiresDeposit: boolean;
  depositAmount?: number;
  maxConcurrentBookings: number;
  staffIds: string[];
  images?: string[];
}

export const ServicesScreen: React.FC = () => {
  const currentBusiness = useCurrentBusiness();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['services', currentBusiness?.businessId],
    queryFn: () => servicesApi.list(),
    enabled: !!currentBusiness,
  });

  const services: Service[] = data?.data?.data?.services || [];

  const filteredServices = React.useMemo(() =>
    services.filter((s: Service) =>
      searchQuery ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    ),
    [services, searchQuery]
  );

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      servicesApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const groupedServices = React.useMemo(() => {
    const grouped: Record<string, Service[]> = {};
    filteredServices.forEach((service) => {
      const category = service.category || 'Sin categoría';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(service);
    });
    return grouped;
  }, [filteredServices]);

  const categories = Object.keys(groupedServices);

  const renderServiceCard = useCallback(
    (service: Service) => (
      <Card
        key={service._id}
        style={[styles.serviceCard, !service.isActive && styles.inactiveCard]}
        onPress={() => setSelectedService(service)}
      >
        <Card.Content style={styles.serviceContent}>
          <View style={styles.serviceInfo}>
            <View style={styles.serviceHeader}>
              <Text
                variant="titleMedium"
                numberOfLines={1}
                style={[styles.serviceName, !service.isActive && styles.inactiveText]}
              >
                {service.name}
              </Text>
              {!service.isActive && (
                <Chip compact style={styles.inactiveChip} textStyle={styles.inactiveChipText}>
                  Inactivo
                </Chip>
              )}
            </View>

            {service.description && (
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={[styles.serviceDescription, !service.isActive && styles.inactiveText]}
              >
                {service.description}
              </Text>
            )}

            <View style={styles.serviceDetails}>
              <View style={styles.detailItem}>
                <Icon name="clock-outline" size={14} color={colors.textSecondary} />
                <Text variant="labelSmall" style={styles.detailText}>
                  {formatDuration(service.duration)}
                </Text>
              </View>
              {service.requiresDeposit && (
                <View style={styles.detailItem}>
                  <Icon name="cash-lock" size={14} color={colors.warning} />
                  <Text variant="labelSmall" style={[styles.detailText, { color: colors.warning }]}>
                    Seña: ${service.depositAmount}
                  </Text>
                </View>
              )}
              <View style={styles.detailItem}>
                <Icon name="account-multiple" size={14} color={colors.textSecondary} />
                <Text variant="labelSmall" style={styles.detailText}>
                  {service.staffIds?.length || 0} profesionales
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.priceContainer}>
            {service.discountedPrice ? (
              <>
                <Text variant="bodySmall" style={styles.originalPrice}>
                  ${service.price}
                </Text>
                <Text variant="titleLarge" style={styles.discountedPrice}>
                  ${service.discountedPrice}
                </Text>
              </>
            ) : (
              <Text variant="titleLarge" style={styles.price}>
                ${service.price}
              </Text>
            )}
          </View>
        </Card.Content>
      </Card>
    ),
    []
  );

  const renderCategory = ({ item: category }: { item: string }) => (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <Text variant="titleMedium" style={styles.categoryTitle}>
          {category}
        </Text>
        <Text variant="bodySmall" style={styles.categoryCount}>
          {groupedServices[category].length} servicios
        </Text>
      </View>
      {groupedServices[category].map(renderServiceCard)}
    </View>
  );

  const renderServiceModal = () => (
    <Portal>
      <Modal
        visible={!!selectedService}
        onDismiss={() => setSelectedService(null)}
        contentContainerStyle={styles.modalContainer}
      >
        {selectedService && (
          <>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Text variant="headlineSmall" style={styles.modalTitle}>
                  {selectedService.name}
                </Text>
                <Switch
                  value={selectedService.isActive}
                  onValueChange={(value) => {
                    toggleActiveMutation.mutate({ id: selectedService._id, isActive: value });
                    setSelectedService({ ...selectedService, isActive: value });
                  }}
                />
              </View>
              <Chip compact style={styles.categoryChip}>
                {selectedService.category}
              </Chip>
            </View>

            {selectedService.description && (
              <>
                <Divider style={styles.modalDivider} />
                <Text variant="bodyMedium" style={styles.modalDescription}>
                  {selectedService.description}
                </Text>
              </>
            )}

            <Divider style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Detalles
              </Text>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Icon name="cash" size={24} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Precio
                  </Text>
                  {selectedService.discountedPrice ? (
                    <View style={styles.priceRow}>
                      <Text variant="bodyLarge" style={styles.modalOriginalPrice}>
                        ${selectedService.price}
                      </Text>
                      <Text variant="titleMedium" style={styles.modalDiscountedPrice}>
                        ${selectedService.discountedPrice}
                      </Text>
                    </View>
                  ) : (
                    <Text variant="titleMedium">${selectedService.price}</Text>
                  )}
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Icon name="clock-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Duración
                  </Text>
                  <Text variant="titleMedium">{formatDuration(selectedService.duration)}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Icon name="account-multiple" size={24} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Profesionales asignados
                  </Text>
                  <Text variant="titleMedium">{selectedService.staffIds?.length || 0}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Icon name="calendar-multiple" size={24} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Reservas simultáneas máximas
                  </Text>
                  <Text variant="titleMedium">{selectedService.maxConcurrentBookings}</Text>
                </View>
              </View>

              {selectedService.requiresDeposit && (
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Icon name="cash-lock" size={24} color={colors.warning} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text variant="labelMedium" style={styles.detailLabel}>
                      Seña requerida
                    </Text>
                    <Text variant="titleMedium">${selectedService.depositAmount}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                icon="trash-can-outline"
                onPress={() => {
                  // Handle delete
                  setSelectedService(null);
                }}
                style={styles.modalActionButton}
                textColor={colors.error}
              >
                Eliminar
              </Button>
              <Button
                mode="contained"
                icon="pencil"
                onPress={() => {
                  // Navigate to edit service
                  setSelectedService(null);
                }}
                style={styles.modalActionButton}
              >
                Editar
              </Button>
            </View>
          </>
        )}
      </Modal>
    </Portal>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="tag-off-outline" size={64} color={colors.textTertiary} />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No hay servicios
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {searchQuery
          ? 'No se encontraron servicios con ese criterio'
          : 'Agrega tu primer servicio para comenzar'}
      </Text>
      {!searchQuery && (
        <Button
          mode="contained"
          icon="plus"
          onPress={() => {}}
          style={styles.emptyButton}
        >
          Agregar Servicio
        </Button>
      )}
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
        placeholder="Buscar servicios..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {categories.length > 0 ? (
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        />
      ) : (
        renderEmpty()
      )}

      {renderServiceModal()}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          // Navigate to create service
        }}
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
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryTitle: {
    fontWeight: '600',
  },
  categoryCount: {
    color: colors.textSecondary,
  },
  serviceCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  inactiveCard: {
    opacity: 0.7,
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  serviceName: {
    fontWeight: '600',
    flex: 1,
  },
  inactiveText: {
    color: colors.textSecondary,
  },
  inactiveChip: {
    backgroundColor: colors.textTertiary + '30',
    height: 22,
  },
  inactiveChipText: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  serviceDescription: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  serviceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: colors.textSecondary,
  },
  priceContainer: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  price: {
    fontWeight: '700',
    color: colors.primary,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  discountedPrice: {
    fontWeight: '700',
    color: colors.success,
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
  emptyButton: {
    marginTop: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    borderRadius: 12,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    marginBottom: spacing.sm,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: '600',
    flex: 1,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.primary + '10',
  },
  modalDivider: {
    marginVertical: spacing.md,
  },
  modalDescription: {
    color: colors.textSecondary,
  },
  modalSection: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailIcon: {
    width: 40,
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  detailLabel: {
    color: colors.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalOriginalPrice: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  modalDiscountedPrice: {
    color: colors.success,
    fontWeight: '600',
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
