import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { RootStackParamList } from '../../navigation/types';
import { favoritesApi } from '../../services/api';
import { useAuthStore } from '../../shared/stores/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Business {
  _id: string;
  name: string;
  type: string;
  media?: { logo?: string; cover?: string };
  location?: { address: string; city: string };
  stats?: { averageRating?: number; totalReviews?: number };
}

export default function FavoritesListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { removeFavoriteBusiness } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => favoritesApi.getBusinesses(),
  });

  const businesses: Business[] = data?.data?.data?.businesses || [];

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const removeMutation = useMutation({
    mutationFn: (businessId: string) => favoritesApi.removeBusiness(businessId),
    onSuccess: (_, businessId) => {
      removeFavoriteBusiness(businessId);
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const renderBusinessCard = ({ item }: { item: Business }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('BusinessProfile', { businessId: item._id })}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.media?.cover || item.media?.logo || 'https://via.placeholder.com/100' }}
        style={styles.cardImage}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.businessName} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => removeMutation.mutate(item._id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="heart" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
        <Text style={styles.businessType}>{item.type}</Text>
        {item.location && (
          <View style={styles.locationRow}>
            <Icon name="map-marker-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location.address}, {item.location.city}
            </Text>
          </View>
        )}
        {item.stats?.averageRating && (
          <View style={styles.ratingRow}>
            <Icon name="star" size={16} color={colors.star} />
            <Text style={styles.ratingText}>{item.stats.averageRating.toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({item.stats.totalReviews || 0})</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Icon name="heart-outline" size={64} color={colors.gray300} />
      <Text style={styles.emptyTitle}>No tenés favoritos</Text>
      <Text style={styles.emptySubtitle}>
        Guardá tus negocios preferidos para acceder rápidamente
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoritos</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item._id}
          renderItem={renderBusinessCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
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
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardImage: { width: 100, height: 100 },
  cardContent: { flex: 1, padding: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  businessName: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1, marginRight: 8 },
  businessType: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  locationText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  ratingText: { fontSize: 14, fontWeight: '600', color: colors.text },
  reviewCount: { fontSize: 12, color: colors.textSecondary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
});
