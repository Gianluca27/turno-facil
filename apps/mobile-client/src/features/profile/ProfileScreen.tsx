import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../shared/stores/authStore';
import { authApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

interface MenuItem {
  icon: string;
  label: string;
  screen?: keyof ProfileStackParamList;
  onPress?: () => void;
  color?: string;
  badge?: number;
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que querés cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await authApi.logout();
            } catch (e) { }
            logout();
          },
        },
      ]
    );
  };

  const menuItems: MenuItem[][] = [
    [
      { icon: 'account-edit', label: 'Editar perfil', screen: 'EditProfile' },
      { icon: 'bell-outline', label: 'Notificaciones', screen: 'Notifications' },
      { icon: 'credit-card-outline', label: 'Métodos de pago', screen: 'PaymentMethods' },
    ],
    [
      { icon: 'star-outline', label: 'Mis reseñas', screen: 'MyReviews' },
      { icon: 'tag-outline', label: 'Promociones', screen: 'Promotions' },
    ],
    [
      { icon: 'cog-outline', label: 'Configuración', screen: 'Settings' },
      { icon: 'help-circle-outline', label: 'Ayuda', screen: 'Help' },
    ],
    [
      { icon: 'logout', label: 'Cerrar sesión', onPress: handleLogout, color: colors.error },
    ],
  ];

  const renderMenuItem = (item: MenuItem, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.menuItem}
      onPress={item.onPress || (() => item.screen && navigation.navigate(item.screen))}
    >
      <View style={styles.menuItemLeft}>
        <Icon name={item.icon} size={24} color={item.color || colors.text} />
        <Text style={[styles.menuItemLabel, item.color ? { color: item.color } : undefined]}>
          {item.label}
        </Text>
      </View>
      {item.badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      ) : (
        <Icon name="chevron-right" size={24} color={colors.gray400} />
      )}
    </TouchableOpacity>
  );

  const userName = user?.profile?.firstName
    ? `${user.profile.firstName} ${user.profile.lastName || ''}`
    : 'Usuario';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
        </View>

        {/* User Card */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => navigation.navigate('EditProfile')}
        >
          {user?.profile?.avatar ? (
            <Image source={{ uri: user.profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {user?.profile?.firstName?.[0] || 'U'}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.gray400} />
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.stats?.totalAppointments || 0}</Text>
            <Text style={styles.statLabel}>Turnos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {user?.favorites?.businesses?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Favoritos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              ${((user?.stats?.totalSpent || 0) / 1000).toFixed(0)}k
            </Text>
            <Text style={styles.statLabel}>Gastado</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.menuSection}>
            {section.map(renderMenuItem)}
          </View>
        ))}

        <Text style={styles.version}>TurnoFácil v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '600', color: colors.white },
  userInfo: { flex: 1, marginLeft: 16 },
  userName: { fontSize: 18, fontWeight: '600', color: colors.text },
  userEmail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: colors.border },
  menuSection: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemLabel: { fontSize: 16, color: colors.text },
  badge: {
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 12, color: colors.white, fontWeight: '600' },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textTertiary,
    paddingVertical: 24,
  },
});
