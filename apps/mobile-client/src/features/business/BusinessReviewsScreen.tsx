import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { ExploreStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/api';

type RouteProps = RouteProp<ExploreStackParamList, 'BusinessReviews'>;

export default function BusinessReviewsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { businessId } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['business-reviews', businessId],
    queryFn: () => businessApi.getReviews(businessId, { limit: 50 }),
  });

  const reviews = data?.data?.data?.items || [];

  const renderReview = ({ item }: { item: any }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.clientInfo?.name?.[0] || 'U'}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewerName}>{item.clientInfo?.name || 'Usuario'}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Icon
                key={star}
                name={star <= item.ratings?.overall ? 'star' : 'star-outline'}
                size={14}
                color={colors.star}
              />
            ))}
          </View>
        </View>
        <Text style={styles.reviewDate}>
          {new Date(item.createdAt).toLocaleDateString('es-AR')}
        </Text>
      </View>
      {item.content?.text && <Text style={styles.reviewText}>{item.content.text}</Text>}
      {item.response?.text && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>Respuesta del negocio:</Text>
          <Text style={styles.responseText}>{item.response.text}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reseñas</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={reviews}
        renderItem={renderReview}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="comment-outline" size={48} color={colors.gray300} />
            <Text style={styles.emptyText}>Aún no hay reseñas</Text>
          </View>
        }
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
  reviewItem: {
    paddingVertical: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  reviewMeta: {
    flex: 1,
    marginLeft: 12,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  stars: {
    flexDirection: 'row',
    marginTop: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    lineHeight: 20,
  },
  responseContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
});
