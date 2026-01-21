import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Avatar, Divider, Switch, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuthStore, useCurrentBusiness } from '../../../shared/stores/authStore';
import { businessApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';

interface MenuItem {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
  color?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const MoreScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const currentBusiness = useCurrentBusiness();

  const { data: businessData, isLoading } = useQuery({
    queryKey: ['business', currentBusiness?.businessId],
    queryFn: () => businessApi.getSettings(),
    enabled: !!currentBusiness,
  });

  const business = businessData?.data?.data;

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

  const menuSections: MenuSection[] = [
    {
      title: 'Mi Negocio',
      items: [
        {
          icon: 'store-outline',
          label: 'Información del Negocio',
          description: 'Nombre, dirección, contacto',
          onPress: () => {},
        },
        {
          icon: 'clock-outline',
          label: 'Horarios de Atención',
          description: 'Configura tus días y horas',
          onPress: () => {},
        },
        {
          icon: 'account-group-outline',
          label: 'Staff / Empleados',
          description: 'Gestiona tu equipo',
          onPress: () => {},
        },
        {
          icon: 'calendar-cog',
          label: 'Configuración de Turnos',
          description: 'Reglas de reserva, cancelación',
          onPress: () => {},
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
          onPress: () => {},
        },
        {
          icon: 'credit-card-outline',
          label: 'Métodos de Pago',
          description: 'Configura formas de cobro',
          onPress: () => {},
        },
        {
          icon: 'chart-line',
          label: 'Reportes Financieros',
          description: 'Analiza tus ingresos',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Marketing',
      items: [
        {
          icon: 'sale',
          label: 'Promociones',
          description: 'Crea ofertas y descuentos',
          onPress: () => {},
        },
        {
          icon: 'email-outline',
          label: 'Campañas',
          description: 'Email y SMS marketing',
          onPress: () => {},
        },
        {
          icon: 'star-outline',
          label: 'Reseñas',
          description: 'Gestiona opiniones de clientes',
          onPress: () => {},
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
          onPress: () => {},
        },
        {
          icon: 'palette-outline',
          label: 'Apariencia',
          description: 'Personaliza tu página',
          onPress: () => {},
        },
        {
          icon: 'shield-check-outline',
          label: 'Seguridad',
          description: 'Contraseña y accesos',
          onPress: () => {},
        },
        {
          icon: 'help-circle-outline',
          label: 'Ayuda y Soporte',
          description: 'FAQ, contacto',
          onPress: () => {},
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
          onPress: () => {},
        },
        {
          icon: 'swap-horizontal',
          label: 'Cambiar de Negocio',
          description: 'Si tienes múltiples negocios',
          onPress: () => {},
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
        <View style={[styles.menuIcon, item.color && { backgroundColor: item.color + '15' }]}>
          <Icon
            name={item.icon}
            size={22}
            color={item.color || colors.primary}
          />
        </View>
        <View style={styles.menuContent}>
          <Text
            variant="bodyLarge"
            style={[styles.menuLabel, item.color && { color: item.color }]}
          >
            {item.label}
          </Text>
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
          <View style={styles.profileAvatar}>
            {business?.logo ? (
              <Avatar.Image size={70} source={{ uri: business.logo }} />
            ) : (
              <Avatar.Text
                size={70}
                label={business?.name?.substring(0, 2).toUpperCase() || 'TF'}
                style={{ backgroundColor: colors.primary }}
              />
            )}
          </View>
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
                <Text variant="titleMedium" style={styles.statNumber}>
                  {business?.rating?.toFixed(1) || '0.0'}
                </Text>
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
        <Card.Content style={styles.userContent}>
          <Avatar.Text
            size={40}
            label={`${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`}
            style={{ backgroundColor: colors.secondary }}
          />
          <View style={styles.userInfo}>
            <Text variant="titleMedium" style={styles.userName}>
              {user?.firstName} {user?.lastName}
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
      </Card>

      {/* Menu Sections */}
      {menuSections.map(renderSection)}

      {/* App Version */}
      <View style={styles.footer}>
        <Text variant="bodySmall" style={styles.versionText}>
          TurnoFácil para Negocios v1.0.0
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
  menuLabel: {
    fontWeight: '500',
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
});
