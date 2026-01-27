import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Text, Searchbar, Chip, Card, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { ExploreStackParamList } from '../../navigation/types';
import { exploreApi, businessApi } from '../../services/api';
import { useAuthStore } from '../../shared/stores/authStore';

type NavigationProp = NativeStackNavigationProp<ExploreStackParamList, 'Explore'>;

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: 'apps' },
  { id: 'barberia', name: 'Barberías', icon: 'content-cut' },
  { id: 'peluqueria', name: 'Peluquerías', icon: 'hair-dryer' },
  { id: 'spa', name: 'Spa', icon: 'spa' },
  { id: 'nails', name: 'Uñas', icon: 'hand-back-right' },
  { id: 'estetica', name: 'Estética', icon: 'face-woman-shimmer' },
  { id: 'masajes', name: 'Masajes', icon: 'meditation' },
  { id: 'salud', name: 'Salud', icon: 'hospital' },
];

export default function ExploreScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch featured businesses
  const { data: featuredData, refetch: refetchFeatured } = useQuery({
    queryKey: ['featured-businesses'],
    queryFn: () => exploreApi.getFeaturedBusinesses(),
  });

  // Fetch nearby businesses
  const { data: nearbyData, refetch: refetchNearby } = useQuery({
    queryKey: ['nearby-businesses'],
    queryFn: () =>
      exploreApi.getNearbyBusinesses({
        lat: -34.6037, // Default Buenos Aires
        lng: -58.3816,
        distance: 10,
      }),
  });

  // Fetch recommended businesses
  const { data: recommendedData, refetch: refetchRecommended } = useQuery({
    queryKey: ['recommended-businesses'],
    queryFn: () => exploreApi.getRecommendedBusinesses(),
    enabled: !!user,
  });

  const featuredBusinesses = featuredData?.data?.data?.businesses || [];
  const nearbyBusinesses = nearbyData?.data?.data?.businesses || [];
  const recommendedBusinesses = recommendedData?.data?.data?.businesses || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFeatured(), refetchNearby(), refetchRecommended()]);
    setRefreshing(false);
  };

  const handleSearch = () => {
    navigation.navigate('Search', { query: searchQuery, category: selectedCategory });
  };

  const handleBusinessPress = (businessId: string) => {
    navigation.navigate('BusinessProfile', { businessId });
  };

  const renderBusinessCard = ({ item, horizontal = false }: { item: any; horizontal?: boolean }) => (
    <TouchableOpacity
      onPress={() => handleBusinessPress(item._id)}
      style={horizontal ? styles.horizontalCard : styles.verticalCard}
    >
      <Card style={styles.card}>
        <Image
          source={{ uri: item.media?.cover || 'https://via.placeholder.com/300x200' }}
          style={horizontal ? styles.horizontalImage : styles.verticalImage}
        />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.businessName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.businessType} numberOfLines={1}>
            {item.type}
          </Text>
          <View style={styles.businessInfo}>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={14} color={colors.star} />
              <Text style={styles.rating}>
                {item.stats?.averageRating?.toFixed(1) || '4.5'}
              </Text>
              <Text style={styles.reviewCount}>
                ({item.stats?.totalReviews || 0})
              </Text>
            </View>
            {item.location?.address && (
              <Text style={styles.distance} numberOfLines={1}>
                {item.location.city}
              </Text>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                Hola, {user?.profile?.firstName || 'visitante'}
              </Text>
              <Text style={styles.subtitle}>¿Qué querés reservar hoy?</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Icon name="bell-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <Searchbar
            placeholder="Buscar negocios, servicios..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            icon={() => <Icon name="magnify" size={24} color={colors.textSecondary} />}
            onIconPress={handleSearch}
          />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {CATEGORIES.map((category) => (
              <Chip
                key={category.id}
                selected={selectedCategory === category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipSelected,
                ]}
                textStyle={[
                  styles.categoryChipText,
                  selectedCategory === category.id && styles.categoryChipTextSelected,
                ]}
                icon={() => (
                  <Icon
                    name={category.icon}
                    size={18}
                    color={selectedCategory === category.id ? colors.white : colors.textSecondary}
                  />
                )}
              >
                {category.name}
              </Chip>
            ))}
          </ScrollView>
        </View>

        {/* Featured Section */}
        {featuredBusinesses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Destacados</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Search', { query: '' })}>
                <Text style={styles.seeAll}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={featuredBusinesses}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => renderBusinessCard({ item, horizontal: true })}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Recommended Section */}
        {recommendedBusinesses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recomendados para vos</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recommendedBusinesses}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => renderBusinessCard({ item, horizontal: true })}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Nearby Section */}
        {nearbyBusinesses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Cerca de vos</Text>
              <TouchableOpacity>
                <Icon name="map-marker" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.nearbyGrid}>
              {nearbyBusinesses.slice(0, 6).map((business: any) => (
                <View key={business._id} style={styles.nearbyItem}>
                  {renderBusinessCard({ item: business, horizontal: false })}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {featuredBusinesses.length === 0 &&
          nearbyBusinesses.length === 0 &&
          recommendedBusinesses.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="store-search" size={64} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No encontramos negocios</Text>
              <Text style={styles.emptyText}>
                Pronto habrá más negocios disponibles en tu zona
              </Text>
            </View>
          )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    elevation: 0,
  },
  searchInput: {
    fontSize: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: colors.gray100,
    marginHorizontal: 4,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: colors.white,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  horizontalCard: {
    marginHorizontal: 4,
    width: width * 0.7,
  },
  verticalCard: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  horizontalImage: {
    width: '100%',
    height: 140,
  },
  verticalImage: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  businessType: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  businessInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
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
  distance: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  nearbyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  nearbyItem: {
    width: '50%',
    padding: 4,
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
