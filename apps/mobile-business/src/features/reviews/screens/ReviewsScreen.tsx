import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Avatar,
  Chip,
  Portal,
  Modal,
  Button,
  Divider,
  TextInput,
  SegmentedButtons,
  IconButton,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { reviewsApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

type Filter = 'all' | 'pending' | 'responded';

interface Review {
  _id: string;
  clientId: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  };
  staffId?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
  };
  ratings: {
    overall: number;
    service?: number;
    staff?: number;
    cleanliness?: number;
    value?: number;
  };
  content: {
    text?: string;
    photos: string[];
    services: string[];
  };
  response?: {
    text: string;
    respondedAt: string;
  };
  moderation: {
    status: string;
  };
  createdAt: string;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { rating: number; count: number }[];
  pendingResponses: number;
}

export const ReviewsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const currentBusiness = useCurrentBusiness();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['review-stats', currentBusiness?.businessId],
    queryFn: () => reviewsApi.getStats(),
    enabled: !!currentBusiness,
  });

  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['reviews', currentBusiness?.businessId, filter],
    queryFn: ({ pageParam = 1 }) =>
      reviewsApi.getAll({
        page: pageParam,
        limit: 20,
        filter: filter === 'pending' ? 'pending_response' : filter === 'responded' ? 'responded' : undefined,
      }),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage.data.data;
      return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
    },
    enabled: !!currentBusiness,
    initialPageParam: 1,
  });

  const respondMutation = useMutation({
    mutationFn: ({ reviewId, text }: { reviewId: string; text: string }) =>
      reviewsApi.respond(reviewId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
      setSelectedReview(null);
      setResponseText('');
    },
  });

  const stats: ReviewStats = statsData?.data?.data || {
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: [],
    pendingResponses: 0,
  };

  const reviews: Review[] = reviewsData?.pages.flatMap((page) => page.data.data.reviews) || [];

  const isLoading = statsLoading || reviewsLoading;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half-full' : 'star-outline'}
            size={size}
            color="#F59E0B"
          />
        ))}
      </View>
    );
  };

  const renderStatsCard = () => (
    <Card style={styles.statsCard}>
      <Card.Content>
        <View style={styles.statsHeader}>
          <View style={styles.mainRating}>
            <Text variant="displayMedium" style={styles.ratingNumber}>
              {stats.averageRating.toFixed(1)}
            </Text>
            {renderStars(stats.averageRating, 24)}
            <Text variant="bodyMedium" style={styles.totalReviews}>
              {stats.totalReviews} reseñas
            </Text>
          </View>

          <View style={styles.ratingBars}>
            {[5, 4, 3, 2, 1].map((rating) => {
              const dist = stats.ratingDistribution.find((d) => d.rating === rating);
              const count = dist?.count || 0;
              const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
              return (
                <View key={rating} style={styles.ratingBarRow}>
                  <Text variant="labelSmall" style={styles.ratingLabel}>
                    {rating}
                  </Text>
                  <Icon name="star" size={12} color="#F59E0B" />
                  <View style={styles.ratingBarContainer}>
                    <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
                  </View>
                  <Text variant="labelSmall" style={styles.ratingCount}>
                    {count}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {stats.pendingResponses > 0 && (
          <View style={styles.pendingBanner}>
            <Icon name="message-reply-text-outline" size={20} color={colors.warning} />
            <Text variant="bodyMedium" style={styles.pendingText}>
              {stats.pendingResponses} reseñas sin responder
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderReviewCard = useCallback(
    ({ item: review }: { item: Review }) => (
      <Card style={styles.reviewCard} onPress={() => setSelectedReview(review)}>
        <Card.Content>
          <View style={styles.reviewHeader}>
            {review.clientId.profile?.avatar ? (
              <Avatar.Image size={40} source={{ uri: review.clientId.profile.avatar }} />
            ) : (
              <Avatar.Text
                size={40}
                label={getInitials(
                  review.clientId.profile?.firstName || '',
                  review.clientId.profile?.lastName || ''
                )}
                style={{ backgroundColor: colors.primary }}
              />
            )}
            <View style={styles.reviewHeaderInfo}>
              <Text variant="titleSmall" numberOfLines={1}>
                {review.clientId.profile?.firstName} {review.clientId.profile?.lastName}
              </Text>
              <View style={styles.reviewMeta}>
                {renderStars(review.ratings.overall, 14)}
                <Text variant="bodySmall" style={styles.reviewDate}>
                  {format(new Date(review.createdAt), "d MMM yyyy", { locale: es })}
                </Text>
              </View>
            </View>
            {!review.response && (
              <Chip
                compact
                style={styles.pendingChip}
                textStyle={styles.pendingChipText}
              >
                Sin responder
              </Chip>
            )}
          </View>

          {review.content.services.length > 0 && (
            <View style={styles.servicesRow}>
              {review.content.services.slice(0, 2).map((service, index) => (
                <Chip key={index} compact style={styles.serviceChip} textStyle={styles.serviceChipText}>
                  {service}
                </Chip>
              ))}
              {review.content.services.length > 2 && (
                <Text variant="labelSmall" style={styles.moreServices}>
                  +{review.content.services.length - 2}
                </Text>
              )}
            </View>
          )}

          {review.content.text && (
            <Text variant="bodyMedium" numberOfLines={3} style={styles.reviewText}>
              "{review.content.text}"
            </Text>
          )}

          {review.response && (
            <View style={styles.responsePreview}>
              <Icon name="reply" size={14} color={colors.textSecondary} />
              <Text variant="bodySmall" style={styles.responseText} numberOfLines={1}>
                {review.response.text}
              </Text>
            </View>
          )}

          {review.staffId && (
            <Text variant="labelSmall" style={styles.staffText}>
              Atendido por {review.staffId.profile.firstName}
            </Text>
          )}
        </Card.Content>
      </Card>
    ),
    []
  );

  const renderReviewModal = () => (
    <Portal>
      <Modal
        visible={!!selectedReview}
        onDismiss={() => {
          setSelectedReview(null);
          setResponseText('');
        }}
        contentContainerStyle={styles.modalContainer}
      >
        {selectedReview && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              {selectedReview.clientId.profile?.avatar ? (
                <Avatar.Image size={60} source={{ uri: selectedReview.clientId.profile.avatar }} />
              ) : (
                <Avatar.Text
                  size={60}
                  label={getInitials(
                    selectedReview.clientId.profile?.firstName || '',
                    selectedReview.clientId.profile?.lastName || ''
                  )}
                  style={{ backgroundColor: colors.primary }}
                />
              )}
              <View style={styles.modalHeaderInfo}>
                <Text variant="titleMedium">
                  {selectedReview.clientId.profile?.firstName} {selectedReview.clientId.profile?.lastName}
                </Text>
                {renderStars(selectedReview.ratings.overall, 20)}
                <Text variant="bodySmall" style={styles.modalDate}>
                  {format(new Date(selectedReview.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                </Text>
              </View>
            </View>

            {selectedReview.content.text && (
              <View style={styles.modalSection}>
                <Text variant="bodyLarge" style={styles.reviewFullText}>
                  "{selectedReview.content.text}"
                </Text>
              </View>
            )}

            {Object.entries(selectedReview.ratings).filter(([key]) => key !== 'overall').length > 0 && (
              <>
                <Divider style={styles.modalDivider} />
                <View style={styles.modalSection}>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    Calificaciones Detalladas
                  </Text>
                  <View style={styles.detailedRatings}>
                    {selectedReview.ratings.service && (
                      <View style={styles.detailedRatingRow}>
                        <Text variant="bodyMedium">Servicio</Text>
                        {renderStars(selectedReview.ratings.service, 14)}
                      </View>
                    )}
                    {selectedReview.ratings.staff && (
                      <View style={styles.detailedRatingRow}>
                        <Text variant="bodyMedium">Personal</Text>
                        {renderStars(selectedReview.ratings.staff, 14)}
                      </View>
                    )}
                    {selectedReview.ratings.cleanliness && (
                      <View style={styles.detailedRatingRow}>
                        <Text variant="bodyMedium">Limpieza</Text>
                        {renderStars(selectedReview.ratings.cleanliness, 14)}
                      </View>
                    )}
                    {selectedReview.ratings.value && (
                      <View style={styles.detailedRatingRow}>
                        <Text variant="bodyMedium">Relación calidad-precio</Text>
                        {renderStars(selectedReview.ratings.value, 14)}
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}

            <Divider style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                {selectedReview.response ? 'Tu Respuesta' : 'Responder'}
              </Text>
              {selectedReview.response ? (
                <View style={styles.existingResponse}>
                  <Text variant="bodyMedium">{selectedReview.response.text}</Text>
                  <Text variant="labelSmall" style={styles.responseDate}>
                    Respondido el {format(new Date(selectedReview.response.respondedAt), "d MMM yyyy", { locale: es })}
                  </Text>
                </View>
              ) : (
                <>
                  <TextInput
                    mode="outlined"
                    placeholder="Escribe tu respuesta..."
                    value={responseText}
                    onChangeText={setResponseText}
                    multiline
                    numberOfLines={4}
                    style={styles.responseInput}
                  />
                  <Button
                    mode="contained"
                    icon="send"
                    onPress={() => {
                      if (responseText.trim()) {
                        respondMutation.mutate({
                          reviewId: selectedReview._id,
                          text: responseText.trim(),
                        });
                      }
                    }}
                    loading={respondMutation.isPending}
                    disabled={!responseText.trim() || respondMutation.isPending}
                    style={styles.sendButton}
                  >
                    Enviar Respuesta
                  </Button>
                </>
              )}
            </View>
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="star-outline" size={64} color={colors.textTertiary} />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No hay reseñas
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {filter === 'pending'
          ? 'No hay reseñas pendientes de responder'
          : filter === 'responded'
          ? 'No hay reseñas respondidas'
          : 'Las reseñas de tus clientes aparecerán aquí'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        renderItem={renderReviewCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={() => (
          <>
            {renderStatsCard()}
            <SegmentedButtons
              value={filter}
              onValueChange={(value) => setFilter(value as Filter)}
              buttons={[
                { value: 'all', label: 'Todas' },
                { value: 'pending', label: 'Pendientes' },
                { value: 'responded', label: 'Respondidas' },
              ]}
              style={styles.filterButtons}
            />
          </>
        )}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />

      {renderReviewModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  statsCard: {
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  mainRating: {
    alignItems: 'center',
    paddingRight: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: colors.surfaceVariant,
  },
  ratingNumber: {
    fontWeight: '700',
    color: colors.text,
  },
  totalReviews: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  ratingBars: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingLabel: {
    width: 12,
    textAlign: 'right',
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  ratingCount: {
    width: 24,
    textAlign: 'right',
    color: colors.textSecondary,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.warning + '20',
    borderRadius: 8,
  },
  pendingText: {
    color: colors.warning,
    fontWeight: '500',
  },
  filterButtons: {
    marginBottom: spacing.md,
  },
  reviewCard: {
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reviewHeaderInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  reviewDate: {
    color: colors.textSecondary,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  pendingChip: {
    backgroundColor: colors.warning + '20',
    height: 24,
  },
  pendingChipText: {
    fontSize: 10,
    color: colors.warning,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  serviceChip: {
    height: 22,
    backgroundColor: colors.primary + '10',
  },
  serviceChipText: {
    fontSize: 10,
    color: colors.primary,
  },
  moreServices: {
    color: colors.textSecondary,
    alignSelf: 'center',
  },
  reviewText: {
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  responsePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  responseText: {
    flex: 1,
    color: colors.textSecondary,
  },
  staffText: {
    color: colors.textSecondary,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.md,
    color: colors.text,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    borderRadius: 12,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalHeaderInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  modalDate: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  reviewFullText: {
    fontStyle: 'italic',
    lineHeight: 24,
  },
  modalDivider: {
    marginVertical: spacing.md,
  },
  detailedRatings: {
    gap: spacing.sm,
  },
  detailedRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  existingResponse: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: 8,
  },
  responseDate: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  responseInput: {
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  sendButton: {
    backgroundColor: colors.primary,
  },
});

export default ReviewsScreen;
