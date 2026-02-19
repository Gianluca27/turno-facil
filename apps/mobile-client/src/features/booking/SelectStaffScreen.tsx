import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Text, Button, RadioButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { BookingStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/api';
import { useBookingStore } from '../../shared/stores/bookingStore';

type NavigationProp = NativeStackNavigationProp<BookingStackParamList, 'SelectStaff'>;
type RouteProps = RouteProp<BookingStackParamList, 'SelectStaff'>;

interface Staff {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    specialties?: string[];
  };
  stats?: {
    averageRating?: number;
    totalReviews?: number;
  };
  services: string[];
}

export default function SelectStaffScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { businessId, serviceIds } = route.params;
  const bookingStore = useBookingStore();

  // Restore selection from store if navigating back
  const [selectedStaff, setSelectedStaff] = useState<string | null>(
    () => bookingStore.staff?._id ?? null
  );

  // Fetch staff
  const { data, isLoading } = useQuery({
    queryKey: ['business-staff', businessId],
    queryFn: () => businessApi.getStaff(businessId),
  });

  const staff: Staff[] = data?.data?.data?.staff || [];

  // Filter staff by selected services
  const availableStaff = staff.filter((member) =>
    serviceIds.some((serviceId) => member.services.includes(serviceId))
  );

  const handleContinue = () => {
    // Persist staff selection to store
    if (selectedStaff) {
      const member = availableStaff.find((s) => s._id === selectedStaff);
      if (member) {
        bookingStore.setStaff({
          _id: member._id,
          firstName: member.profile.firstName,
          lastName: member.profile.lastName,
          displayName: member.profile.displayName,
          avatar: member.profile.avatar,
          specialties: member.profile.specialties,
          averageRating: member.stats?.averageRating,
          totalReviews: member.stats?.totalReviews,
        });
      }
    } else {
      bookingStore.setStaff(null);
    }

    navigation.navigate('SelectDateTime', {
      businessId,
      serviceIds,
      staffId: selectedStaff || undefined,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Cargando profesionales...</Text>
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
          <Text style={styles.stepText}>Paso 2 de 4</Text>
          <Text style={styles.title}>Elegí un profesional</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* No preference option */}
        <TouchableOpacity
          style={[styles.staffCard, !selectedStaff && styles.staffCardSelected]}
          onPress={() => setSelectedStaff(null)}
          activeOpacity={0.7}
        >
          <View style={styles.staffContent}>
            <View style={[styles.avatar, styles.avatarAny]}>
              <Icon name="account-group" size={28} color={colors.white} />
            </View>
            <View style={styles.staffInfo}>
              <Text style={styles.staffName}>Sin preferencia</Text>
              <Text style={styles.staffBio}>
                Te asignaremos el primer profesional disponible
              </Text>
            </View>
          </View>
          <RadioButton
            value="none"
            status={!selectedStaff ? 'checked' : 'unchecked'}
            onPress={() => setSelectedStaff(null)}
            color={colors.primary}
          />
        </TouchableOpacity>

        {/* Staff list */}
        {availableStaff.map((member) => {
          const isSelected = selectedStaff === member._id;
          const name = member.profile.displayName ||
            `${member.profile.firstName} ${member.profile.lastName}`;

          return (
            <TouchableOpacity
              key={member._id}
              style={[styles.staffCard, isSelected && styles.staffCardSelected]}
              onPress={() => setSelectedStaff(member._id)}
              activeOpacity={0.7}
            >
              <View style={styles.staffContent}>
                {member.profile.avatar ? (
                  <Image source={{ uri: member.profile.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                      {member.profile.firstName[0]}{member.profile.lastName[0]}
                    </Text>
                  </View>
                )}
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{name}</Text>
                  {member.profile.bio && (
                    <Text style={styles.staffBio} numberOfLines={2}>
                      {member.profile.bio}
                    </Text>
                  )}
                  {member.profile.specialties && member.profile.specialties.length > 0 && (
                    <View style={styles.specialtiesContainer}>
                      {member.profile.specialties.slice(0, 3).map((specialty, index) => (
                        <View key={index} style={styles.specialtyChip}>
                          <Text style={styles.specialtyText}>{specialty}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {member.stats?.averageRating && (
                    <View style={styles.ratingContainer}>
                      <Icon name="star" size={16} color={colors.star} />
                      <Text style={styles.ratingText}>
                        {member.stats.averageRating.toFixed(1)}
                      </Text>
                      <Text style={styles.reviewCount}>
                        ({member.stats.totalReviews || 0} reseñas)
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <RadioButton
                value={member._id}
                status={isSelected ? 'checked' : 'unchecked'}
                onPress={() => setSelectedStaff(member._id)}
                color={colors.primary}
              />
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  content: {
    flex: 1,
    padding: 16,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  staffCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '10',
  },
  staffContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  avatarAny: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    backgroundColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  staffBio: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  specialtyChip: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
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
  },
  continueButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  continueButtonContent: {
    height: 52,
  },
  continueButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
