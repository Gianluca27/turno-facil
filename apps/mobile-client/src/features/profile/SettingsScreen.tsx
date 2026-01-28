import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Switch, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { useAuthStore } from '../../shared/stores/authStore';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, updateUser } = useAuthStore();

  const [notifications, setNotifications] = useState({
    push: user?.preferences?.notifications?.push ?? true,
    email: user?.preferences?.notifications?.email ?? true,
    sms: user?.preferences?.notifications?.sms ?? false,
    marketing: user?.preferences?.notifications?.marketing ?? true,
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const SettingItem = ({
    icon,
    label,
    value,
    onToggle,
    description,
  }: {
    icon: string;
    label: string;
    value?: boolean;
    onToggle?: () => void;
    description?: string;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={24} color={colors.text} />
        <View style={styles.settingText}>
          <Text style={styles.settingLabel}>{label}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
      </View>
      {onToggle && <Switch value={value} onValueChange={onToggle} color={colors.primary} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Notificaciones</Text>
        <View style={styles.section}>
          <SettingItem
            icon="bell"
            label="Notificaciones push"
            description="Recibir alertas en tu dispositivo"
            value={notifications.push}
            onToggle={() => handleToggle('push')}
          />
          <Divider />
          <SettingItem
            icon="email"
            label="Notificaciones por email"
            description="Confirmaciones y recordatorios"
            value={notifications.email}
            onToggle={() => handleToggle('email')}
          />
          <Divider />
          <SettingItem
            icon="message-text"
            label="SMS"
            description="Recordatorios importantes por SMS"
            value={notifications.sms}
            onToggle={() => handleToggle('sms')}
          />
          <Divider />
          <SettingItem
            icon="tag"
            label="Promociones"
            description="Ofertas y descuentos especiales"
            value={notifications.marketing}
            onToggle={() => handleToggle('marketing')}
          />
        </View>

        <Text style={styles.sectionTitle}>Cuenta</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon name="lock" size={24} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Cambiar contraseña</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={colors.gray400} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon name="shield-check" size={24} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Privacidad</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={colors.gray400} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Más</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon name="file-document" size={24} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Términos y condiciones</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={colors.gray400} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon name="shield-lock" size={24} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Política de privacidad</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={colors.gray400} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.deleteAccount}
          onPress={() =>
            Alert.alert('Eliminar cuenta', '¿Estás seguro? Esta acción no se puede deshacer.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive' },
            ])
          }
        >
          <Icon name="delete" size={20} color={colors.error} />
          <Text style={styles.deleteAccountText}>Eliminar mi cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
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
  content: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  section: { backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 16, color: colors.text },
  settingDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  deleteAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 24,
    gap: 8,
  },
  deleteAccountText: { fontSize: 14, color: colors.error },
});
