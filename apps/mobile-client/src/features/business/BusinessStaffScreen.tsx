import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { ExploreStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/api';

type RouteProps = RouteProp<ExploreStackParamList, 'BusinessStaff'>;

export default function BusinessStaffScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { businessId } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['business-staff', businessId],
    queryFn: () => businessApi.getStaff(businessId),
  });

  const staff = data?.data?.data?.staff || [];

  const renderStaff = ({ item }: { item: any }) => (
    <View style={styles.staffItem}>
      {item.profile?.avatar ? (
        <Image source={{ uri: item.profile.avatar }} style={styles.staffImage} />
      ) : (
        <Avatar.Text
          size={64}
          label={`${item.profile?.firstName?.[0] || ''}${item.profile?.lastName?.[0] || ''}`}
          style={styles.staffAvatar}
        />
      )}
      <View style={styles.staffInfo}>
        <Text style={styles.staffName}>
          {item.profile?.displayName || `${item.profile?.firstName} ${item.profile?.lastName}`}
        </Text>
        {item.profile?.specialties?.length > 0 && (
          <Text style={styles.staffSpecialties} numberOfLines={1}>
            {item.profile.specialties.join(', ')}
          </Text>
        )}
        <View style={styles.staffRating}>
          <Icon name="star" size={14} color={colors.star} />
          <Text style={styles.ratingText}>
            {item.stats?.averageRating?.toFixed(1) || '4.5'}
          </Text>
          <Text style={styles.reviewCount}>({item.stats?.totalReviews || 0})</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Profesionales</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={staff}
        renderItem={renderStaff}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    justifyContent: 'space-between',
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  list: {
    padding: 16,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  staffImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  staffAvatar: {
    backgroundColor: colors.primary,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  staffSpecialties: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  staffRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  reviewCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
});
