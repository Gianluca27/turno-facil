import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  SegmentedButtons,
  ActivityIndicator,
  Chip,
  FAB,
  Portal,
  Modal,
  Button,
  List,
  Switch,
  IconButton,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';

import { marketingApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

type Tab = 'promotions' | 'campaigns';

interface Promotion {
  _id: string;
  name: string;
  code: string;
  description?: string;
  discount: {
    type: 'percentage' | 'fixed';
    amount: number;
    maxDiscount?: number;
  };
  validFrom: string;
  validUntil: string;
  limits: {
    totalUses?: number;
    currentUses: number;
  };
  status: 'active' | 'paused' | 'expired';
}

interface Campaign {
  _id: string;
  name: string;
  type: 'email' | 'push' | 'sms';
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  scheduledAt?: string;
  sentAt?: string;
  audience: {
    type: string;
    estimatedReach: number;
  };
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
}

export const MarketingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const currentBusiness = useCurrentBusiness();
  const [activeTab, setActiveTab] = useState<Tab>('promotions');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: promotionsData, isLoading: promotionsLoading, refetch: refetchPromotions } = useQuery({
    queryKey: ['promotions', currentBusiness?.businessId],
    queryFn: () => marketingApi.getPromotions(),
    enabled: !!currentBusiness && activeTab === 'promotions',
  });

  const { data: campaignsData, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ['campaigns', currentBusiness?.businessId],
    queryFn: () => marketingApi.getCampaigns(),
    enabled: !!currentBusiness && activeTab === 'campaigns',
  });

  const togglePromotionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      marketingApi.updatePromotion(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  const promotions: Promotion[] = promotionsData?.data?.data?.promotions || [];
  const campaigns: Campaign[] = campaignsData?.data?.data?.campaigns || [];

  const isLoading = activeTab === 'promotions' ? promotionsLoading : campaignsLoading;

  const refetch = () => {
    if (activeTab === 'promotions') {
      refetchPromotions();
    } else {
      refetchCampaigns();
    }
  };

  const getPromotionStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return colors.success;
      case 'paused':
        return colors.warning;
      case 'expired':
        return colors.textSecondary;
      default:
        return colors.textSecondary;
    }
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return colors.success;
      case 'scheduled':
        return colors.primary;
      case 'draft':
        return colors.textSecondary;
      case 'cancelled':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return 'email';
      case 'push':
        return 'bell';
      case 'sms':
        return 'message-text';
      default:
        return 'bullhorn';
    }
  };

  const renderPromotionCard = (promotion: Promotion) => {
    const isActive = promotion.status === 'active';
    const daysLeft = Math.ceil(
      (new Date(promotion.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return (
      <Card
        key={promotion._id}
        style={styles.card}
        onPress={() => navigation.navigate('PromotionDetail', { promotionId: promotion._id })}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text variant="titleMedium" style={styles.cardTitle} numberOfLines={1}>
                {promotion.name}
              </Text>
              <Chip
                compact
                style={[styles.statusChip, { backgroundColor: getPromotionStatusColor(promotion.status) + '20' }]}
                textStyle={[styles.statusChipText, { color: getPromotionStatusColor(promotion.status) }]}
              >
                {promotion.status === 'active' ? 'Activa' : promotion.status === 'paused' ? 'Pausada' : 'Expirada'}
              </Chip>
            </View>
            <Switch
              value={isActive}
              onValueChange={(value) => {
                togglePromotionMutation.mutate({
                  id: promotion._id,
                  status: value ? 'active' : 'paused',
                });
              }}
              disabled={promotion.status === 'expired'}
              color={colors.primary}
            />
          </View>

          <View style={styles.promoCodeRow}>
            <Chip icon="ticket-percent" style={styles.codeChip}>
              {promotion.code}
            </Chip>
            <Text variant="titleLarge" style={styles.discountText}>
              {promotion.discount.type === 'percentage'
                ? `${promotion.discount.amount}%`
                : `$${promotion.discount.amount}`}
            </Text>
          </View>

          <View style={styles.promoStats}>
            <View style={styles.promoStatItem}>
              <Icon name="ticket-confirmation" size={16} color={colors.textSecondary} />
              <Text variant="bodySmall" style={styles.promoStatText}>
                {promotion.limits.currentUses}
                {promotion.limits.totalUses ? `/${promotion.limits.totalUses}` : ''} usos
              </Text>
            </View>
            {daysLeft > 0 && promotion.status !== 'expired' && (
              <View style={styles.promoStatItem}>
                <Icon name="clock-outline" size={16} color={colors.textSecondary} />
                <Text variant="bodySmall" style={styles.promoStatText}>
                  {daysLeft} días restantes
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderCampaignCard = (campaign: Campaign) => {
    return (
      <Card
        key={campaign._id}
        style={styles.card}
        onPress={() => navigation.navigate('CampaignDetail', { campaignId: campaign._id })}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.campaignTypeIcon, { backgroundColor: colors.primary + '20' }]}>
                <Icon name={getCampaignTypeIcon(campaign.type)} size={20} color={colors.primary} />
              </View>
              <View style={styles.campaignTitleContainer}>
                <Text variant="titleMedium" style={styles.cardTitle} numberOfLines={1}>
                  {campaign.name}
                </Text>
                <Text variant="bodySmall" style={styles.campaignType}>
                  {campaign.type === 'email' ? 'Email' : campaign.type === 'push' ? 'Notificación' : 'SMS'}
                </Text>
              </View>
            </View>
            <Chip
              compact
              style={[styles.statusChip, { backgroundColor: getCampaignStatusColor(campaign.status) + '20' }]}
              textStyle={[styles.statusChipText, { color: getCampaignStatusColor(campaign.status) }]}
            >
              {campaign.status === 'sent' ? 'Enviada' : campaign.status === 'scheduled' ? 'Programada' : campaign.status === 'draft' ? 'Borrador' : 'Cancelada'}
            </Chip>
          </View>

          {campaign.scheduledAt && campaign.status === 'scheduled' && (
            <View style={styles.scheduledRow}>
              <Icon name="calendar-clock" size={16} color={colors.textSecondary} />
              <Text variant="bodySmall" style={styles.scheduledText}>
                Programada para {format(new Date(campaign.scheduledAt), "d MMM 'a las' HH:mm", { locale: es })}
              </Text>
            </View>
          )}

          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <Text variant="headlineSmall" style={styles.campaignStatNumber}>
                {campaign.audience.estimatedReach}
              </Text>
              <Text variant="labelSmall" style={styles.campaignStatLabel}>
                Destinatarios
              </Text>
            </View>
            {campaign.stats && (
              <>
                <View style={styles.campaignStatItem}>
                  <Text variant="headlineSmall" style={styles.campaignStatNumber}>
                    {campaign.stats.delivered}
                  </Text>
                  <Text variant="labelSmall" style={styles.campaignStatLabel}>
                    Entregados
                  </Text>
                </View>
                <View style={styles.campaignStatItem}>
                  <Text variant="headlineSmall" style={styles.campaignStatNumber}>
                    {campaign.stats.opened}
                  </Text>
                  <Text variant="labelSmall" style={styles.campaignStatLabel}>
                    Abiertos
                  </Text>
                </View>
              </>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon
        name={activeTab === 'promotions' ? 'ticket-percent-outline' : 'bullhorn-outline'}
        size={64}
        color={colors.textTertiary}
      />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        {activeTab === 'promotions' ? 'No hay promociones' : 'No hay campañas'}
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {activeTab === 'promotions'
          ? 'Crea tu primera promoción para atraer más clientes'
          : 'Crea tu primera campaña para comunicarte con tus clientes'}
      </Text>
      <Button
        mode="contained"
        icon="plus"
        onPress={() => setShowCreateModal(true)}
        style={styles.emptyButton}
      >
        {activeTab === 'promotions' ? 'Crear Promoción' : 'Crear Campaña'}
      </Button>
    </View>
  );

  const renderCreateModal = () => (
    <Portal>
      <Modal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          {activeTab === 'promotions' ? 'Nueva Promoción' : 'Nueva Campaña'}
        </Text>

        {activeTab === 'promotions' ? (
          <>
            <List.Item
              title="Descuento Porcentual"
              description="Ej: 20% de descuento"
              left={(props) => <List.Icon {...props} icon="percent" color={colors.primary} />}
              onPress={() => {
                setShowCreateModal(false);
                navigation.navigate('CreatePromotion', { type: 'percentage' });
              }}
              style={styles.modalItem}
            />
            <List.Item
              title="Descuento Fijo"
              description="Ej: $500 de descuento"
              left={(props) => <List.Icon {...props} icon="cash" color={colors.success} />}
              onPress={() => {
                setShowCreateModal(false);
                navigation.navigate('CreatePromotion', { type: 'fixed' });
              }}
              style={styles.modalItem}
            />
          </>
        ) : (
          <>
            <List.Item
              title="Notificación Push"
              description="Enviar notificación a la app"
              left={(props) => <List.Icon {...props} icon="bell" color={colors.primary} />}
              onPress={() => {
                setShowCreateModal(false);
                navigation.navigate('CreateCampaign', { type: 'push' });
              }}
              style={styles.modalItem}
            />
            <List.Item
              title="Email Marketing"
              description="Enviar campaña por email"
              left={(props) => <List.Icon {...props} icon="email" color={colors.secondary} />}
              onPress={() => {
                setShowCreateModal(false);
                navigation.navigate('CreateCampaign', { type: 'email' });
              }}
              style={styles.modalItem}
            />
            <List.Item
              title="SMS"
              description="Enviar mensaje de texto"
              left={(props) => <List.Icon {...props} icon="message-text" color={colors.success} />}
              onPress={() => {
                setShowCreateModal(false);
                navigation.navigate('CreateCampaign', { type: 'sms' });
              }}
              style={styles.modalItem}
            />
          </>
        )}

        <Button
          mode="outlined"
          onPress={() => setShowCreateModal(false)}
          style={styles.modalCancelButton}
        >
          Cancelar
        </Button>
      </Modal>
    </Portal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const currentData = activeTab === 'promotions' ? promotions : campaigns;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as Tab)}
        buttons={[
          { value: 'promotions', label: 'Promociones', icon: 'ticket-percent' },
          { value: 'campaigns', label: 'Campañas', icon: 'bullhorn' },
        ]}
        style={styles.segmentedButtons}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        contentContainerStyle={styles.scrollContent}
      >
        {currentData.length > 0 ? (
          activeTab === 'promotions'
            ? promotions.map(renderPromotionCard)
            : campaigns.map(renderCampaignCard)
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {renderCreateModal()}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
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
  segmentedButtons: {
    margin: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  card: {
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  cardTitle: {
    fontWeight: '600',
    flex: 1,
  },
  statusChip: {
    height: 24,
  },
  statusChipText: {
    fontSize: 11,
  },
  promoCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  codeChip: {
    backgroundColor: colors.primary + '10',
  },
  discountText: {
    fontWeight: '700',
    color: colors.success,
  },
  promoStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  promoStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  promoStatText: {
    color: colors.textSecondary,
  },
  campaignTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  campaignTitleContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  campaignType: {
    color: colors.textSecondary,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    backgroundColor: colors.primary + '10',
    padding: spacing.sm,
    borderRadius: 8,
  },
  scheduledText: {
    color: colors.primary,
  },
  campaignStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
  },
  campaignStatItem: {
    alignItems: 'center',
  },
  campaignStatNumber: {
    fontWeight: '700',
    color: colors.primary,
  },
  campaignStatLabel: {
    color: colors.textSecondary,
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
    marginBottom: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    borderRadius: 12,
    padding: spacing.lg,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  modalItem: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  modalCancelButton: {
    marginTop: spacing.sm,
  },
});

export default MarketingScreen;
