import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { userApi } from '../../services/api';

interface Notification {
  _id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const ICON_MAP: Record<string, { icon: string; color: string }> = {
  booking_confirmed: { icon: 'check-circle', color: colors.success },
  booking_cancelled: { icon: 'cancel', color: colors.error },
  reminder_24h: { icon: 'bell', color: colors.warning },
  reminder_2h: { icon: 'bell-ring', color: colors.warning },
  review_request: { icon: 'star', color: colors.star },
  promotion: { icon: 'tag', color: colors.primary },
  default: { icon: 'bell-outline', color: colors.textSecondary },
};

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => userApi.getNotifications({ limit: 50 }),
  });

  const notifications: Notification[] = data?.data?.data?.items || [];

  const markReadMutation = useMutation({
    mutationFn: (id: string) => userApi.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => userApi.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconConfig = ICON_MAP[item.type] || ICON_MAP.default;
    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unread]}
        onPress={() => !item.read && markReadMutation.mutate(item._id)}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.color + '20' }]}>
          <Icon name={iconConfig.icon} size={22} color={iconConfig.color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notificationTime}>{formatDate(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => markAllReadMutation.mutate()}>
            <Text style={styles.markAllRead}>Marcar leídas</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="bell-off-outline" size={64} color={colors.gray300} />
              <Text style={styles.emptyTitle}>Sin notificaciones</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: 8 },
  markAllRead: { fontSize: 14, color: colors.primary, fontWeight: '500' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  unread: { backgroundColor: colors.primaryLight + '10' },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  notificationBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  notificationTime: { fontSize: 12, color: colors.textTertiary, marginTop: 6 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, color: colors.textSecondary, marginTop: 16 },
});
