import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { RootStackParamList } from '../../navigation/types';
import { promotionsApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Promotion {
  _id: string;
  name: string;
  description?: string;
  type: string;
  code?: string;
  discount: { type: string; amount: number };
  validFrom: string;
  validUntil: string;
  businessInfo?: { _id: string; name: string };
}

export default function PromotionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => promotionsApi.getAvailable(),
  });

  const promotions: Promotion[] = data?.data?.data?.promotions || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDiscount = (promo: Promotion) => {
    if (promo.discount.type === 'percentage') {
      return `${promo.discount.amount}% OFF`;
    }
    return `$${promo.discount.amount.toLocaleString()} OFF`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  const isExpiringSoon = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  };

  const renderPromotion = ({ item }: { item: Promotion }) => (
    <TouchableOpacity
      style={styles.promoCard}
      onPress={() =>
        item.businessInfo?._id &&
        navigation.navigate('BusinessProfile', { businessId: item.businessInfo._id })
      }
    >
      <View style={styles.promoHeader}>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{formatDiscount(item)}</Text>
        </View>
        {isExpiringSoon(item.validUntil) && (
          <Chip
            icon={() => <Icon name="clock-alert-outline" size={14} color={colors.warning} />}
            style={styles.expiringChip}
            textStyle={styles.expiringChipText}
            compact
          >
            Vence pronto
          </Chip>
        )}
      </View>

      <Text style={styles.promoName}>{item.name}</Text>
      {item.description && (
        <Text style={styles.promoDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {item.businessInfo && (
        <View style={styles.businessRow}>
          <Icon name="store" size={16} color={colors.textSecondary} />
          <Text style={styles.businessName}>{item.businessInfo.name}</Text>
        </View>
      )}

      {item.code && (
        <View style={styles.codeContainer}>
          <Icon name="ticket-percent" size={16} color={colors.primary} />
          <Text style={styles.codeLabel}>Código:</Text>
          <Text style={styles.codeValue}>{item.code}</Text>
        </View>
      )}

      <View style={styles.validityRow}>
        <Icon name="calendar-range" size={14} color={colors.textTertiary} />
        <Text style={styles.validityText}>
          Válido hasta {formatDate(item.validUntil)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Promociones</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={promotions}
          keyExtractor={(item) => item._id}
          renderItem={renderPromotion}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="tag-off-outline" size={64} color={colors.gray300} />
              <Text style={styles.emptyTitle}>Sin promociones disponibles</Text>
              <Text style={styles.emptySubtitle}>
                Las promociones de tus negocios favoritos aparecerán acá
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  promoCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  discountBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discountText: { fontSize: 16, fontWeight: '700', color: colors.white },
  expiringChip: { backgroundColor: colors.warningLight + '30', height: 28 },
  expiringChipText: { fontSize: 11, color: colors.warning },
  promoName: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 4 },
  promoDescription: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  businessRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  businessName: { fontSize: 14, color: colors.textSecondary },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '15',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  codeLabel: { fontSize: 13, color: colors.textSecondary },
  codeValue: { fontSize: 15, fontWeight: '700', color: colors.primary, letterSpacing: 1 },
  validityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  validityText: { fontSize: 12, color: colors.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
