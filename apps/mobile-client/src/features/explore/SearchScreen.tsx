import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text, Searchbar, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { ExploreStackParamList } from '../../navigation/types';
import { exploreApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<ExploreStackParamList, 'Search'>;
type RouteProps = RouteProp<ExploreStackParamList, 'Search'>;

const FILTERS = [
  { id: 'rating', label: 'Mejor valorados', icon: 'star' },
  { id: 'distance', label: 'Más cercanos', icon: 'map-marker' },
  { id: 'available', label: 'Disponible hoy', icon: 'clock' },
  { id: 'price', label: 'Precio', icon: 'currency-usd' },
];

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const [searchQuery, setSearchQuery] = useState(route.params?.query || '');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['search-businesses', searchQuery, selectedFilters, page],
    queryFn: () =>
      exploreApi.searchBusinesses({
        q: searchQuery,
        type: route.params?.category !== 'all' ? route.params?.category : undefined,
        rating: selectedFilters.includes('rating') ? 4 : undefined,
        hasAvailability: selectedFilters.includes('available') || undefined,
        page,
        limit: 20,
      }),
    enabled: true,
  });

  const businesses = data?.data?.data?.items || [];
  const totalPages = data?.data?.data?.totalPages || 1;

  const toggleFilter = (filterId: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterId) ? prev.filter((f) => f !== filterId) : [...prev, filterId]
    );
    setPage(1);
  };

  const handleBusinessPress = (businessId: string) => {
    navigation.navigate('BusinessProfile', { businessId });
  };

  const renderBusinessItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.businessItem}
      onPress={() => handleBusinessPress(item._id)}
    >
      <Image
        source={{ uri: item.media?.cover || 'https://via.placeholder.com/100' }}
        style={styles.businessImage}
      />
      <View style={styles.businessInfo}>
        <Text style={styles.businessName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.businessType}>{item.type}</Text>
        <View style={styles.businessMeta}>
          <View style={styles.ratingContainer}>
            <Icon name="star" size={14} color={colors.star} />
            <Text style={styles.rating}>
              {item.stats?.averageRating?.toFixed(1) || '4.5'}
            </Text>
            <Text style={styles.reviewCount}>({item.stats?.totalReviews || 0})</Text>
          </View>
          <Text style={styles.location} numberOfLines={1}>
            {item.location?.city}
          </Text>
        </View>
        {item.bookingConfig?.allowInstantBooking && (
          <View style={styles.instantBookingBadge}>
            <Icon name="flash" size={12} color={colors.success} />
            <Text style={styles.instantBookingText}>Reserva instantánea</Text>
          </View>
        )}
      </View>
      <Icon name="chevron-right" size={24} color={colors.gray400} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="magnify" size={64} color={colors.gray300} />
      <Text style={styles.emptyTitle}>No encontramos resultados</Text>
      <Text style={styles.emptyText}>
        Probá con otros términos de búsqueda o modificá los filtros
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Searchbar
          placeholder="Buscar..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => refetch()}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          autoFocus
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Chip
              selected={selectedFilters.includes(item.id)}
              onPress={() => toggleFilter(item.id)}
              style={[
                styles.filterChip,
                selectedFilters.includes(item.id) && styles.filterChipSelected,
              ]}
              textStyle={[
                styles.filterChipText,
                selectedFilters.includes(item.id) && styles.filterChipTextSelected,
              ]}
              icon={() => (
                <Icon
                  name={item.icon}
                  size={16}
                  color={selectedFilters.includes(item.id) ? colors.white : colors.textSecondary}
                />
              )}
            >
              {item.label}
            </Chip>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={businesses}
          renderItem={renderBusinessItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          onEndReached={() => {
            if (page < totalPages) setPage(page + 1);
          }}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 12,
    elevation: 0,
    height: 44,
  },
  searchInput: {
    fontSize: 16,
    marginLeft: -8,
  },
  filtersContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    backgroundColor: colors.gray100,
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 12,
  },
  businessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  businessImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.gray200,
  },
  businessInfo: {
    flex: 1,
    marginLeft: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  businessType: {
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  businessMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  location: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  instantBookingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  instantBookingText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 108,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
