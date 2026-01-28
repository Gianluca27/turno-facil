import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Text, ActivityIndicator, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { reviewsApi } from '../../services/api';

interface Review {
  _id: string;
  businessInfo: { name: string };
  ratings: { overall: number };
  content?: { text?: string };
  createdAt: string;
}

export default function MyReviewsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: () => reviewsApi.getMyReviews(),
  });

  const reviews: Review[] = data?.data?.data?.items || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reviewsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
    },
  });

  const handleDelete = (id: string) => {
    setMenuVisible(null);
    Alert.alert('Eliminar reseña', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View>
          <Text style={styles.businessName}>{item.businessInfo.name}</Text>
          <Text style={styles.reviewDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <Menu
          visible={menuVisible === item._id}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <TouchableOpacity onPress={() => setMenuVisible(item._id)}>
              <Icon name="dots-vertical" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          }
        >
          <Menu.Item onPress={() => handleDelete(item._id)} title="Eliminar" />
        </Menu>
      </View>
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name={star <= item.ratings.overall ? 'star' : 'star-outline'}
            size={20}
            color={colors.star}
          />
        ))}
      </View>
      {item.content?.text && <Text style={styles.reviewText}>{item.content.text}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Mis reseñas</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item._id}
          renderItem={renderReview}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="star-outline" size={64} color={colors.gray300} />
              <Text style={styles.emptyTitle}>Sin reseñas</Text>
              <Text style={styles.emptySubtitle}>
                Tus reseñas aparecerán acá después de cada turno
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
  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  businessName: { fontSize: 16, fontWeight: '600', color: colors.text },
  reviewDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  ratingContainer: { flexDirection: 'row', marginTop: 8 },
  reviewText: { fontSize: 14, color: colors.textSecondary, marginTop: 12, lineHeight: 20 },
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
