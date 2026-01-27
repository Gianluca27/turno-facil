import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Text, Card, Avatar, Divider, ActivityIndicator, Badge } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore, useCurrentBusiness } from '../../../shared/stores/authStore';
import { businessApi, notificationsApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import type { RootStackParamList } from '../../../app/navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItem {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
  color?: string;
  badge?: number;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const MoreScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuthStore();
  const currentBusiness = useCurrentBusiness();

  const { data: businessData, isLoading } = useQuery({
    queryKey: ['business', currentBusiness?.businessId],
    queryFn: () => businessApi.get(),
    enabled: !!currentBusiness,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['unread-notifications', currentBusiness?.businessId],
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: !!currentBusiness,
  });

  const business = businessData?.data?.data?.business;
  const unreadCount = notificationsData?.data?.data?.count || 0;

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleSwitchBusiness = () => {
    Alert.alert(
      'Cambiar de Negocio',
      'Esta función permite gestionar múltiples negocios desde una sola cuenta.',
      [{ text: 'Entendido' }]
    );
  };

  const handleSupport = () => {
    Alert.alert(
      'Ayuda y Soporte',
      '¿Cómo deseas contactarnos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'WhatsApp',
          onPress: () => Linking.openURL('https://wa.me/5491155556789?text=Hola,%20necesito%20ayuda%20con%20TurnoFácil')
        },
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:soporte@turnofacil.com?subject=Necesito%20ayuda')
        },
      ]
    );
  };

  const menuSections: MenuSection[] = [
    {
      title: 'Mi Negocio',
      items: [
        {
          icon: 'store-outline',
          label: 'Información del Negocio',
          description: 'Nombre, dirección, contacto',
          onPress: () => navigation.navigate('BusinessInfo'),
        },
        {
          icon: 'clock-outline',
          label: 'Horarios de Atención',
          description: 'Configura tus días y horas',
          onPress: () => navigation.navigate('BusinessSchedule'),
        },
        {
          icon: 'account-group-outline',
          label: 'Staff / Empleados',
          description: 'Gestiona tu equipo',
          onPress: () => navigation.navigate('Staff'),
        },
        {
          icon: 'calendar-cog',
          label: 'Configuración de Turnos',
          description: 'Reglas de reserva, cancelación',
          onPress: () => navigation.navigate('BookingSettings'),
        },
      ],
    },
    {
      title: 'Finanzas',
      items: [
        {
          icon: 'cash-multiple',
          label: 'Historial de Transacciones',
          description: 'Ver ingresos y pagos',
          onPress: () => navigation.navigate('TransactionHistory'),
        },
        {
          icon: 'credit-card-outline',
          label: 'Métodos de Pago',
          description: 'Configura formas de cobro',
          onPress: () => navigation.navigate('PaymentSettings'),
        },
        {
          icon: 'chart-line',
          label: 'Reportes Financieros',
          description: 'Analiza tus ingresos',
          onPress: () => navigation.navigate('FinanceReports'),
        },
      ],
    },
    {
      title: 'Marketing',
      items: [
        {
          icon: 'sale',
          label: 'Promociones y Campañas',
          description: 'Crea ofertas y comunícate',
          onPress: () => navigation.navigate('Marketing'),
        },
        {
          icon: 'star-outline',
          label: 'Reseñas',
          description: 'Gestiona opiniones de clientes',
          onPress: () => navigation.navigate('Reviews'),
        },
        {
          icon: 'chart-areaspline',
          label: 'Estadísticas',
          description: 'Métricas y rendimiento',
          onPress: () => navigation.navigate('Analytics'),
        },
      ],
    },
    {
      title: 'Configuración',
      items: [
        {
          icon: 'bell-outline',
          label: 'Notificaciones',
          description: 'Configura alertas',
          onPress: () => navigation.navigate('NotificationSettings'),
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
        {
          icon: 'palette-outline',
          label: 'Apariencia',
          description: 'Personaliza tu página',
          onPress: () => navigation.navigate('AppearanceSettings'),
        },
        {
          icon: 'shield-check-outline',
          label: 'Seguridad',
          description: 'Contraseña y accesos',
          onPress: () => navigation.navigate('SecuritySettings'),
        },
        {
          icon: 'puzzle-outline',
          label: 'Integraciones',
          description: 'Google Calendar, MercadoPago',
          onPress: () => navigation.navigate('Integrations'),
        },
        {
          icon: 'account-multiple-outline',
          label: 'Equipo',
          description: 'Gestiona permisos y roles',
          onPress: () => navigation.navigate('Team'),
        },
        {
          icon: 'help-circle-outline',
          label: 'Ayuda y Soporte',
          description: 'FAQ, contacto',
          onPress: handleSupport,
        },
      ],
    },
    {
      title: 'Cuenta',
      items: [
        {
          icon: 'account-circle-outline',
          label: 'Mi Perfil',
          description: 'Editar datos personales',
          onPress: () => navigation.navigate('EditProfile'),
        },
        {
          icon: 'crown-outline',
          label: 'Suscripción',
          description: 'Plan actual y facturación',
          onPress: () => navigation.navigate('Subscription'),
        },
        {
          icon: 'swap-horizontal',
          label: 'Cambiar de Negocio',
          description: 'Si tienes múltiples negocios',
          onPress: handleSwitchBusiness,
        },
        {
          icon: 'logout',
          label: 'Cerrar Sesión',
          onPress: handleLogout,
          color: colors.error,
        },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem, isLast: boolean) => (
    <View key={item.label}>
      <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
        <View style={[styles.menuIcon, item.color ? { backgroundColor: item.color + '15' } : null]}>
          <Icon
            name={item.icon}
            size={22}
            color={item.color || colors.primary}
          />
        </View>
        <View style={styles.menuContent}>
          <View style={styles.menuLabelRow}>
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, item.color ? { color: item.color } : null]}
            >
              {item.label}
            </Text>
            {item.badge && (
              <Badge size={20} style={styles.badge}>
                {item.badge}
              </Badge>
            )}
          </View>
          {item.description && (
            <Text variant="bodySmall" style={styles.menuDescription}>
              {item.description}
            </Text>
          )}
        </View>
        {item.rightElement || (
          <Icon name="chevron-right" size={24} color={colors.textTertiary} />
        )}
      </TouchableOpacity>
      {!isLast && <Divider style={styles.menuDivider} />}
    </View>
  );

  const renderSection = (section: MenuSection) => (
    <View key={section.title} style={styles.section}>
      <Text variant="titleSmall" style={styles.sectionTitle}>
        {section.title}
      </Text>
      <Card style={styles.sectionCard}>
        {section.items.map((item, index) =>
          renderMenuItem(item, index === section.items.length - 1)
        )}
      </Card>
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Business Profile Header */}
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={() => navigation.navigate('BusinessInfo')}
          >
            {business?.logo ? (
              <Avatar.Image size={70} source={{ uri: business.logo }} />
            ) : (
              <Avatar.Text
                size={70}
                label={business?.name?.substring(0, 2).toUpperCase() || 'TF'}
                style={{ backgroundColor: colors.primary }}
              />
            )}
            <View style={styles.editBadge}>
              <Icon name="pencil" size={12} color={colors.background} />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text variant="titleLarge" style={styles.businessName}>
              {business?.name || 'Mi Negocio'}
            </Text>
            <Text variant="bodyMedium" style={styles.businessType}>
              {business?.type || 'Tipo de negocio'}
            </Text>
            <View style={styles.profileStats}>
              <View style={styles.profileStat}>
                <Text variant="titleMedium" style={styles.statNumber}>
                  {business?.stats?.totalAppointments || 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Turnos
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.profileStat}>
                <Text variant="titleMedium" style={styles.statNumber}>
                  {business?.stats?.totalClients || 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Clientes
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.profileStat}>
                <View style={styles.ratingRow}>
                  <Text variant="titleMedium" style={styles.statNumber}>
                    {business?.rating?.toFixed(1) || '0.0'}
                  </Text>
                  <Icon name="star" size={14} color="#F59E0B" />
                </View>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Rating
                </Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* User Info */}
      <Card style={styles.userCard}>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
          <Card.Content style={styles.userContent}>
            <Avatar.Text
              size={40}
              label={`${user?.profile?.firstName?.charAt(0) || ''}${user?.profile?.lastName?.charAt(0) || ''}`}
              style={{ backgroundColor: colors.secondary }}
            />
            <View style={styles.userInfo}>
              <Text variant="titleMedium" style={styles.userName}>
                {user?.profile?.firstName} {user?.profile?.lastName}
              </Text>
              <Text variant="bodySmall" style={styles.userEmail}>
                {user?.email}
              </Text>
            </View>
            <View style={styles.roleChip}>
              <Text variant="labelSmall" style={styles.roleText}>
                {currentBusiness?.role === 'owner' ? 'Propietario' :
                 currentBusiness?.role === 'admin' ? 'Administrador' :
                 currentBusiness?.role || 'Usuario'}
              </Text>
            </View>
          </Card.Content>
        </TouchableOpacity>
      </Card>

      {/* Menu Sections */}
      {menuSections.map(renderSection)}

      {/* App Version */}
      <View style={styles.footer}>
        <Text variant="bodySmall" style={styles.versionText}>
          TurnoFácil para Negocios v1.0.0
        </Text>
        <Text variant="labelSmall" style={styles.copyrightText}>
          © 2024 TurnoFácil. Todos los derechos reservados.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    marginRight: spacing.md,
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  profileInfo: {
    flex: 1,
  },
  businessName: {
    fontWeight: '700',
  },
  businessType: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileStat: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: '600',
    color: colors.primary,
  },
  statLabel: {
    color: colors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  userCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontWeight: '600',
  },
  userEmail: {
    color: colors.textSecondary,
  },
  roleChip: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  roleText: {
    color: colors.primary,
    fontWeight: '500',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.background,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuLabel: {
    fontWeight: '500',
  },
  badge: {
    backgroundColor: colors.error,
  },
  menuDescription: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    marginLeft: spacing.md + 40 + spacing.md,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  versionText: {
    color: colors.textTertiary,
  },
  copyrightText: {
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontSize: 11,
  },
});
