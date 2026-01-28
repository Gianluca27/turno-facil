import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
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
} from 'react-native-paper';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { clientsApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

interface Client {
  _id: string;
  userId: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  totalAppointments: number;
  totalSpent: number;
  lastVisit?: string;
  notes?: string;
  tags?: string[];
  isBlocked: boolean;
}

export const ClientsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentBusiness = useCurrentBusiness();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['clients', currentBusiness?.businessId, searchQuery],
    queryFn: ({ pageParam = 1 }) =>
      clientsApi.list({ page: pageParam, q: searchQuery, limit: 20 }),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage.data.data;
      return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
    },
    enabled: !!currentBusiness,
    initialPageParam: 1,
  });

  const clients: Client[] = data?.pages.flatMap((page) => page.data.data.clients) || [];

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const renderClientCard = useCallback(
    ({ item: client }: { item: Client }) => (
      <Card
        style={styles.clientCard}
        onPress={() => setSelectedClient(client)}
      >
        <Card.Content style={styles.clientContent}>
          <View style={styles.clientAvatar}>
            {client.userId.avatar ? (
              <Avatar.Image
                size={50}
                source={{ uri: client.userId.avatar }}
              />
            ) : (
              <Avatar.Text
                size={50}
                label={getInitials(client.userId.firstName, client.userId.lastName)}
                style={{ backgroundColor: colors.primary }}
              />
            )}
          </View>

          <View style={styles.clientInfo}>
            <View style={styles.clientHeader}>
              <Text variant="titleMedium" numberOfLines={1} style={styles.clientName}>
                {client.userId.firstName} {client.userId.lastName}
              </Text>
              {client.isBlocked && (
                <Chip compact style={styles.blockedChip} textStyle={styles.blockedChipText}>
                  Bloqueado
                </Chip>
              )}
            </View>

            <Text variant="bodyMedium" style={styles.clientEmail} numberOfLines={1}>
              {client.userId.email}
            </Text>

            {client.userId.phone && (
              <Text variant="bodySmall" style={styles.clientPhone}>
                {client.userId.phone}
              </Text>
            )}

            <View style={styles.clientStats}>
              <View style={styles.statItem}>
                <Icon name="calendar-check" size={14} color={colors.textSecondary} />
                <Text variant="labelSmall" style={styles.statText}>
                  {client.totalAppointments} turnos
                </Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="cash" size={14} color={colors.textSecondary} />
                <Text variant="labelSmall" style={styles.statText}>
                  ${client.totalSpent}
                </Text>
              </View>
              {client.lastVisit && (
                <View style={styles.statItem}>
                  <Icon name="clock-outline" size={14} color={colors.textSecondary} />
                  <Text variant="labelSmall" style={styles.statText}>
                    {format(new Date(client.lastVisit), 'd MMM', { locale: es })}
                  </Text>
                </View>
              )}
            </View>

            {client.tags && client.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {client.tags.slice(0, 3).map((tag) => (
                  <Chip
                    key={tag}
                    compact
                    style={styles.tagChip}
                    textStyle={styles.tagChipText}
                  >
                    {tag}
                  </Chip>
                ))}
                {client.tags.length > 3 && (
                  <Text variant="labelSmall" style={styles.moreTagsText}>
                    +{client.tags.length - 3}
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

  const renderClientModal = () => (
    <Portal>
      <Modal
        visible={!!selectedClient}
        onDismiss={() => setSelectedClient(null)}
        contentContainerStyle={styles.modalContainer}
      >
        {selectedClient && (
          <>
            <View style={styles.modalHeader}>
              {selectedClient.userId.avatar ? (
                <Avatar.Image
                  size={80}
                  source={{ uri: selectedClient.userId.avatar }}
                />
              ) : (
                <Avatar.Text
                  size={80}
                  label={getInitials(
                    selectedClient.userId.firstName,
                    selectedClient.userId.lastName
                  )}
                  style={{ backgroundColor: colors.primary }}
                />
              )}
              <Text variant="headlineSmall" style={styles.modalName}>
                {selectedClient.userId.firstName} {selectedClient.userId.lastName}
              </Text>
              {selectedClient.isBlocked && (
                <Chip compact style={styles.blockedChip} textStyle={styles.blockedChipText}>
                  Bloqueado
                </Chip>
              )}
            </View>

            <Divider style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Información de Contacto
              </Text>
              <View style={styles.modalRow}>
                <Icon name="email-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.modalRowText}>
                  {selectedClient.userId.email}
                </Text>
              </View>
              {selectedClient.userId.phone && (
                <View style={styles.modalRow}>
                  <Icon name="phone-outline" size={20} color={colors.textSecondary} />
                  <Text variant="bodyLarge" style={styles.modalRowText}>
                    {selectedClient.userId.phone}
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
                    {selectedClient.totalAppointments}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Turnos
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text variant="headlineMedium" style={styles.statNumber}>
                    ${selectedClient.totalSpent}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Total Gastado
                  </Text>
                </View>
              </View>
              {selectedClient.lastVisit && (
                <Text variant="bodySmall" style={styles.lastVisitText}>
                  Última visita: {format(new Date(selectedClient.lastVisit), "d 'de' MMMM, yyyy", { locale: es })}
                </Text>
              )}
            </View>

            {selectedClient.notes && (
              <>
                <Divider style={styles.modalDivider} />
                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Notas
                  </Text>
                  <Text variant="bodyMedium" style={styles.notesText}>
                    {selectedClient.notes}
                  </Text>
                </View>
              </>
            )}

            {selectedClient.tags && selectedClient.tags.length > 0 && (
              <>
                <Divider style={styles.modalDivider} />
                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Etiquetas
                  </Text>
                  <View style={styles.modalTagsContainer}>
                    {selectedClient.tags.map((tag) => (
                      <Chip key={tag} style={styles.modalTagChip}>
                        {tag}
                      </Chip>
                    ))}
                  </View>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                icon="calendar-plus"
                onPress={() => {
                  const clientId = selectedClient._id;
                  setSelectedClient(null);
                  navigation.navigate('CreateAppointment', { clientId });
                }}
                style={styles.modalActionButton}
              >
                Nuevo Turno
              </Button>
              <Button
                mode="contained"
                icon="account-details"
                onPress={() => {
                  const clientId = selectedClient._id;
                  setSelectedClient(null);
                  navigation.navigate('ClientDetail', { clientId });
                }}
                style={styles.modalActionButton}
              >
                Ver Perfil
              </Button>
            </View>
          </>
        )}
      </Modal>
    </Portal>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="account-group-outline" size={64} color={colors.textTertiary} />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No hay clientes
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {searchQuery
          ? 'No se encontraron clientes con ese criterio'
          : 'Los clientes aparecerán aquí cuando realicen reservas'}
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
        placeholder="Buscar clientes..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <FlatList
        data={clients}
        renderItem={renderClientCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />

      {renderClientModal()}

      <FAB
        icon="account-plus"
        style={styles.fab}
        onPress={() => {
          // Navigate to add client manually
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
  clientCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  clientContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    marginRight: spacing.md,
  },
  clientInfo: {
    flex: 1,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clientName: {
    fontWeight: '600',
    flex: 1,
  },
  blockedChip: {
    backgroundColor: colors.error + '20',
    height: 22,
  },
  blockedChipText: {
    color: colors.error,
    fontSize: 10,
  },
  clientEmail: {
    color: colors.textSecondary,
  },
  clientPhone: {
    color: colors.textTertiary,
    marginTop: 2,
  },
  clientStats: {
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  tagChip: {
    height: 22,
    backgroundColor: colors.primary + '10',
  },
  tagChipText: {
    fontSize: 10,
    color: colors.primary,
  },
  moreTagsText: {
    color: colors.textSecondary,
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
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
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalName: {
    fontWeight: '600',
    marginTop: spacing.md,
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
    gap: spacing.md,
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
  },
  lastVisitText: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  notesText: {
    color: colors.textSecondary,
  },
  modalTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalTagChip: {
    backgroundColor: colors.primary + '10',
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
