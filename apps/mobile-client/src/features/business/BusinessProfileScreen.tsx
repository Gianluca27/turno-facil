import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { Text, Button, Chip, Divider, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { ExploreStackParamList, RootStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/api';
import { useAuthStore } from '../../shared/stores/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<ExploreStackParamList, 'BusinessProfile'>;

const { width } = Dimensions.get('window');

export default function BusinessProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { businessId } = route.params;
  const { user, addFavoriteBusiness, removeFavoriteBusiness } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'services' | 'reviews' | 'about'>('services');

  const isFavorite = user?.favorites?.businesses?.includes(businessId) || false;

  // Fetch business details
  const { data: businessData, isLoading } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessApi.getById(businessId),
  });

  // Fetch services
  const { data: servicesData } = useQuery({
    queryKey: ['business-services', businessId],
    queryFn: () => businessApi.getServices(businessId),
  });

  // Fetch reviews
  const { data: reviewsData } = useQuery({
    queryKey: ['business-reviews', businessId],
    queryFn: () => businessApi.getReviews(businessId, { limit: 5 }),
  });

  // Toggle favorite
  const favoriteMutation = useMutation({
    mutationFn: () =>
      isFavorite
        ? businessApi.removeFromFavorites(businessId)
        : businessApi.addToFavorites(businessId),
    onSuccess: () => {
      if (isFavorite) {
        removeFavoriteBusiness(businessId);
      } else {
        addFavoriteBusiness(businessId);
      }
    },
  });

  const business = businessData?.data?.data?.business;
  const services = servicesData?.data?.data?.services || [];
  const categories = servicesData?.data?.data?.categories || [];
  const reviews = reviewsData?.data?.data?.items || [];

  const handleBooking = () => {
    navigation.navigate('Booking', {
      screen: 'SelectServices',
      params: { businessId },
    });
  };

  const handleCall = () => {
    if (business?.contact?.phone) {
      Linking.openURL(`tel:${business.contact.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (business?.contact?.whatsapp) {
      Linking.openURL(`https://wa.me/${business.contact.whatsapp.replace(/\D/g, '')}`);
    }
  };

  const handleDirections = () => {
    if (business?.location?.coordinates) {
      const [lng, lat] = business.location.coordinates.coordinates;
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    }
  };

  if (isLoading || !business) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: business.media?.cover || 'https://via.placeholder.com/400x250' }}
            style={styles.coverImage}
          />
          <View style={styles.imageOverlay} />

          {/* Back and Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={24} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.headerRightActions}>
              <TouchableOpacity style={styles.headerButton}>
                <Icon name="share-variant" size={24} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => favoriteMutation.mutate()}
              >
                <Icon
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorite ? colors.error : colors.white}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Business Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.businessName}>{business.name}</Text>
          <Text style={styles.businessType}>{business.type}</Text>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={20} color={colors.star} />
              <Text style={styles.rating}>
                {business.stats?.averageRating?.toFixed(1) || '4.5'}
              </Text>
              <Text style={styles.reviewCount}>
                ({business.stats?.totalReviews || 0} reseñas)
              </Text>
            </View>
            {business.bookingConfig?.allowInstantBooking && (
              <Chip
                icon={() => <Icon name="flash" size={16} color={colors.success} />}
                style={styles.instantChip}
                textStyle={styles.instantChipText}
              >
                Reserva instantánea
              </Chip>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={handleCall}>
              <View style={styles.quickActionIcon}>
                <Icon name="phone" size={22} color={colors.primary} />
              </View>
              <Text style={styles.quickActionText}>Llamar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={handleWhatsApp}>
              <View style={styles.quickActionIcon}>
                <Icon name="whatsapp" size={22} color={colors.success} />
              </View>
              <Text style={styles.quickActionText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={handleDirections}>
              <View style={styles.quickActionIcon}>
                <Icon name="map-marker" size={22} color={colors.error} />
              </View>
              <Text style={styles.quickActionText}>Cómo llegar</Text>
            </TouchableOpacity>
          </View>

          {/* Address */}
          <View style={styles.addressContainer}>
            <Icon name="map-marker-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.addressText}>
              {business.location?.address}, {business.location?.city}
            </Text>
          </View>
        </View>

        <Divider />

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'services' && styles.tabActive]}
            onPress={() => setActiveTab('services')}
          >
            <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
              Servicios
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
              Reseñas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
              Info
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'services' && (
          <View style={styles.tabContent}>
            {services.map((service: any) => (
              <View key={service._id} style={styles.serviceItem}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.serviceDuration}>{service.duration} min</Text>
                  {service.description && (
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>
                  )}
                </View>
                <View style={styles.serviceRight}>
                  <Text style={styles.servicePrice}>
                    ${service.price?.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            {reviews.map((review: any) => (
              <View key={review._id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewUser}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {review.clientInfo?.name?.[0] || 'U'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.reviewerName}>
                        {review.clientInfo?.name || 'Usuario'}
                      </Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Icon
                            key={star}
                            name={star <= review.ratings?.overall ? 'star' : 'star-outline'}
                            size={14}
                            color={colors.star}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
                {review.content?.text && (
                  <Text style={styles.reviewText}>{review.content.text}</Text>
                )}
              </View>
            ))}
            {reviews.length === 0 && (
              <Text style={styles.noReviews}>Aún no hay reseñas</Text>
            )}
          </View>
        )}

        {activeTab === 'about' && (
          <View style={styles.tabContent}>
            {business.description && (
              <View style={styles.aboutSection}>
                <Text style={styles.aboutTitle}>Descripción</Text>
                <Text style={styles.aboutText}>{business.description}</Text>
              </View>
            )}
            <View style={styles.aboutSection}>
              <Text style={styles.aboutTitle}>Horarios</Text>
              {business.schedule?.regular?.map((day: any, index: number) => (
                <View key={index} style={styles.scheduleRow}>
                  <Text style={styles.dayName}>
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day.dayOfWeek]}
                  </Text>
                  <Text style={styles.scheduleTime}>
                    {day.isOpen
                      ? day.slots?.[0]
                        ? `${day.slots[0].open} - ${day.slots[0].close}`
                        : 'Abierto'
                      : 'Cerrado'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Booking Button */}
      <View style={styles.bookingContainer}>
        <Button
          mode="contained"
          onPress={handleBooking}
          style={styles.bookingButton}
          contentStyle={styles.bookingButtonContent}
          labelStyle={styles.bookingButtonLabel}
        >
          Reservar turno
        </Button>
      </View>
    </SafeAreaView>
  );
}

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
  imageContainer: {
    height: 250,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  headerActions: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  infoContainer: {
    padding: 20,
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  businessType: {
    fontSize: 16,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 6,
  },
  reviewCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  instantChip: {
    backgroundColor: colors.successLight + '30',
  },
  instantChipText: {
    fontSize: 12,
    color: colors.success,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: colors.gray50,
    borderRadius: 12,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabContent: {
    padding: 20,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 16,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  serviceDuration: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
  },
  serviceRight: {
    alignItems: 'flex-end',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  reviewStars: {
    flexDirection: 'row',
    marginTop: 4,
  },
  reviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    lineHeight: 20,
  },
  noReviews: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 32,
  },
  aboutSection: {
    marginBottom: 24,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dayName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  scheduleTime: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  bookingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookingButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  bookingButtonContent: {
    height: 52,
  },
  bookingButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
