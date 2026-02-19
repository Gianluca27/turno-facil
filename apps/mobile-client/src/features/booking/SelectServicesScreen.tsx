import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Text, Button, Checkbox, Searchbar, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { BookingStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/api';
import { useBookingStore } from '../../shared/stores/bookingStore';

type NavigationProp = NativeStackNavigationProp<BookingStackParamList, 'SelectServices'>;
type RouteProps = RouteProp<BookingStackParamList, 'SelectServices'>;

interface Service {
  _id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  categoryId?: string;
  image?: string;
}

interface Category {
  _id: string;
  name: string;
}

export default function SelectServicesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { businessId } = route.params;
  const bookingStore = useBookingStore();

  // Restore selections from store if navigating back
  const [selectedServices, setSelectedServices] = useState<string[]>(
    () => bookingStore.services.map((s) => s._id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Reset store when starting a fresh booking flow
  React.useEffect(() => {
    const currentBusiness = useBookingStore.getState().business;
    if (currentBusiness && currentBusiness._id !== businessId) {
      bookingStore.reset();
      setSelectedServices([]);
    }
  }, [businessId, bookingStore]);

  // Fetch business details and cache in store
  const { data: businessData } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessApi.getById(businessId),
  });

  React.useEffect(() => {
    const business = businessData?.data?.data?.business;
    if (business && !bookingStore.business) {
      bookingStore.setBusiness({
        _id: business._id,
        name: business.name,
        address: business.location?.address || '',
        city: business.location?.city || '',
        coverImage: business.media?.cover,
        requiresDeposit: business.bookingConfig?.requireDeposit || false,
        depositAmount: business.bookingConfig?.depositAmount || 0,
        depositType: business.bookingConfig?.depositType || 'percentage',
        cancellationPolicy: {
          allowCancellation: business.bookingConfig?.cancellationPolicy?.allowCancellation ?? true,
          freeCancellationHours: business.bookingConfig?.cancellationPolicy?.hoursBeforeAppointment ?? 24,
          penaltyPercentage: business.bookingConfig?.cancellationPolicy?.penaltyPercentage ?? 0,
        },
        requireConfirmation: business.bookingConfig?.requireConfirmation || false,
      });
    }
  }, [businessData, bookingStore]);

  // Fetch services
  const { data, isLoading } = useQuery({
    queryKey: ['business-services', businessId],
    queryFn: () => businessApi.getServices(businessId),
  });

  const services: Service[] = data?.data?.data?.services || [];
  const categories: Category[] = data?.data?.data?.categories || [];

  // Filter services
  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || service.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate totals
  const selectedServiceObjects = services.filter((s) => selectedServices.includes(s._id));
  const totalDuration = selectedServiceObjects.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServiceObjects.reduce((sum, s) => sum + s.price, 0);

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleContinue = () => {
    // Persist selected services to store with full details
    const selectedServiceObjects = services.filter((s) => selectedServices.includes(s._id));
    bookingStore.setServices(
      selectedServiceObjects.map((s) => ({
        _id: s._id,
        name: s.name,
        duration: s.duration,
        price: s.price,
        description: s.description,
        image: s.image,
        categoryId: s.categoryId,
      }))
    );

    navigation.navigate('SelectStaff', {
      businessId,
      serviceIds: selectedServices,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Cargando servicios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.stepText}>Paso 1 de 4</Text>
          <Text style={styles.title}>Seleccioná servicios</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Buscar servicio..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category._id}
              style={[
                styles.categoryChip,
                selectedCategory === category._id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category._id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category._id && styles.categoryTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Divider />

      {/* Services List */}
      <ScrollView style={styles.servicesList} showsVerticalScrollIndicator={false}>
        {filteredServices.map((service) => {
          const isSelected = selectedServices.includes(service._id);
          return (
            <TouchableOpacity
              key={service._id}
              style={[styles.serviceItem, isSelected && styles.serviceItemSelected]}
              onPress={() => toggleService(service._id)}
              activeOpacity={0.7}
            >
              <View style={styles.serviceContent}>
                {service.image && (
                  <Image source={{ uri: service.image }} style={styles.serviceImage} />
                )}
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  {service.description && (
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>
                  )}
                  <View style={styles.serviceMeta}>
                    <View style={styles.durationContainer}>
                      <Icon name="clock-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.durationText}>{service.duration} min</Text>
                    </View>
                    <Text style={styles.servicePrice}>
                      ${service.price.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => toggleService(service._id)}
                  color={colors.primary}
                />
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      {selectedServices.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>
              {selectedServices.length} servicio{selectedServices.length > 1 ? 's' : ''}
            </Text>
            <View style={styles.summaryDetails}>
              <Text style={styles.summaryDuration}>
                <Icon name="clock-outline" size={14} color={colors.textSecondary} />
                {' '}{totalDuration} min
              </Text>
              <Text style={styles.summaryPrice}>${totalPrice.toLocaleString()}</Text>
            </View>
          </View>
          <Button
            mode="contained"
            onPress={handleContinue}
            style={styles.continueButton}
            contentStyle={styles.continueButtonContent}
            labelStyle={styles.continueButtonLabel}
          >
            Continuar
          </Button>
        </View>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 8,
  },
  stepText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchbar: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  categoriesContainer: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: colors.white,
  },
  servicesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '10',
  },
  serviceContent: {
    flex: 1,
    flexDirection: 'row',
  },
  serviceImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  serviceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  checkboxContainer: {
    marginLeft: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  summaryDuration: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  continueButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  continueButtonContent: {
    height: 48,
    paddingHorizontal: 16,
  },
  continueButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
