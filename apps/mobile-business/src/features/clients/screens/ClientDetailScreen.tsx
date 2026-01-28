import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import {
  Text,
  Button,
  Card,
  Chip,
  ActivityIndicator,
  Divider,
  Portal,
  Modal,
  TextInput,
  IconButton,
  Avatar,
  Menu,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { clientsApi } from '../../../services/api';
import { colors, spacing, getStatusColor, getStatusLabel } from '../../../shared/theme';
import { RootStackParamList } from '../../../app/navigation/RootNavigator';

type ClientDetailRouteProp = RouteProp<RootStackParamList, 'ClientDetail'>;
type ClientDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ClientDetail'>;

interface ClientStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalSpent: number;
  averageSpending: number;
  lastVisit?: string;
}

interface Client {
  _id: string;
  userId?: string;
  info: {
    name: string;
    phone?: string;
    email?: string;
  };
  isVip: boolean;
  isBlocked: boolean;
  blockReason?: string;
  stats: ClientStats;
  tags: string[];
  notes?: string;
  createdAt: string;
  lastAppointment?: string;
}

interface Appointment {
  _id: string;
  date: string;
  startTime: string;
  status: string;
  services: Array<{ name: string; price: number }>;
  staffInfo: { name: string };
  pricing: { total: number };
}

export const ClientDetailScreen: React.FC = () => {
  const navigation = useNavigation<ClientDetailNavigationProp>();
  const route = useRoute<ClientDetailRouteProp>();
  const queryClient = useQueryClient();
  const { clientId } = route.params;

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  // Fetch client
  const { data: clientData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
  });

  const client: Client | undefined = clientData?.data?.data?.client;

  // Fetch client appointments
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['clientAppointments', clientId],
    queryFn: () => clientsApi.getAppointments(clientId),
    enabled: !!clientId,
  });

  const appointments: Appointment[] = appointmentsData?.data?.data?.appointments || [];

  // Mutations
  const toggleVipMutation = useMutation({
    mutationFn: () => clientsApi.toggleVip(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: (reason?: string) => clientsApi.block(clientId, reason),
    onSuccess: () => {
      setShowBlockModal(false);
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => clientsApi.unblock(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: (notesText: string) => clientsApi.update(clientId, { notes: notesText }),
    onSuccess: () => {
      setShowNotesModal(false);
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
    },
  });

  const handleCall = () => {
    if (client?.info.phone) {
      Linking.openURL(`tel:${client.info.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (client?.info.phone) {
      const phone = client.info.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}`);
    }
  };

  const handleEmail = () => {
    if (client?.info.email) {
      Linking.openURL(`mailto:${client.info.email}`);
    }
  };

  const handleBlock = () => {
    Alert.alert(
      'Bloquear Cliente',
      '¿Estás seguro que deseas bloquear este cliente? No podrá realizar reservas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: () => setShowBlockModal(true) },
      ]
    );
  };

  const handleUnblock = () => {
    Alert.alert(
      'Desbloquear Cliente',
      '¿Deseas desbloquear este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desbloquear', onPress: () => unblockMutation.mutate() },
      ]
    );
  };

  const openNotesModal = () => {
    setNotes(client?.notes || '');
    setShowNotesModal(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={64} color={colors.error} />
        <Text variant="titleMedium" style={styles.errorText}>
          Cliente no encontrado
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Volver
        </Button>
      </View>
    );
  }

  const completionRate = client.stats.totalAppointments > 0
    ? Math.round((client.stats.completedAppointments / client.stats.totalAppointments) * 100)
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Avatar.Text
            size={80}
            label={client.info.name.charAt(0).toUpperCase()}
            style={{ backgroundColor: client.isVip ? '#F59E0B' : colors.primary + '30' }}
            labelStyle={{ color: client.isVip ? colors.textOnPrimary : colors.primary }}
          />
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text variant="headlineSmall" style={styles.name}>
                {client.info.name}
              </Text>
              {client.isVip && (
                <Icon name="star" size={24} color="#F59E0B" />
              )}
            </View>
            <View style={styles.badges}>
              {client.isBlocked && (
                <Chip
                  compact
                  style={styles.blockedChip}
                  textStyle={styles.blockedChipText}
                  icon="block-helper"
                >
                  Bloqueado
                </Chip>
              )}
              {client.userId && (
                <Chip compact icon="account-check" style={styles.registeredChip}>
                  Registrado
                </Chip>
              )}
            </View>
          </View>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              leadingIcon={client.isVip ? 'star-off' : 'star'}
              onPress={() => {
                setMenuVisible(false);
                toggleVipMutation.mutate();
              }}
              title={client.isVip ? 'Quitar VIP' : 'Marcar como VIP'}
            />
            {!client.isBlocked ? (
              <Menu.Item
                leadingIcon="block-helper"
                onPress={() => {
                  setMenuVisible(false);
                  handleBlock();
                }}
                title="Bloquear cliente"
                titleStyle={{ color: colors.error }}
              />
            ) : (
              <Menu.Item
                leadingIcon="check-circle"
                onPress={() => {
                  setMenuVisible(false);
                  handleUnblock();
                }}
                title="Desbloquear cliente"
              />
            )}
          </Menu>
        </View>

        {/* Blocked Alert */}
        {client.isBlocked && (
          <View style={styles.blockedAlert}>
            <Icon name="block-helper" size={20} color={colors.error} />
            <View style={styles.blockedAlertContent}>
              <Text variant="bodyMedium" style={styles.blockedAlertText}>
                Este cliente está bloqueado
              </Text>
              {client.blockReason && (
                <Text variant="bodySmall" style={styles.blockedReason}>
                  Motivo: {client.blockReason}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Contact Actions */}
        <View style={styles.contactActions}>
          {client.info.phone && (
            <>
              <IconButton
                icon="phone"
                mode="contained-tonal"
                size={24}
                onPress={handleCall}
              />
              <IconButton
                icon="whatsapp"
                mode="contained-tonal"
                size={24}
                onPress={handleWhatsApp}
                iconColor="#25D366"
              />
            </>
          )}
          {client.info.email && (
            <IconButton
              icon="email"
              mode="contained-tonal"
              size={24}
              onPress={handleEmail}
            />
          )}
          <Button
            mode="contained"
            icon="calendar-plus"
            onPress={() => navigation.navigate('CreateAppointment', { clientId })}
            style={styles.newAppointmentButton}
            disabled={client.isBlocked}
          >
            Nuevo Turno
          </Button>
        </View>

        {/* Contact Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Información de Contacto
            </Text>
            {client.info.phone && (
              <View style={styles.contactRow}>
                <Icon name="phone-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.contactText}>
                  {client.info.phone}
                </Text>
              </View>
            )}
            {client.info.email && (
              <View style={styles.contactRow}>
                <Icon name="email-outline" size={20} color={colors.textSecondary} />
                <Text variant="bodyLarge" style={styles.contactText}>
                  {client.info.email}
                </Text>
              </View>
            )}
            <View style={styles.contactRow}>
              <Icon name="calendar-clock-outline" size={20} color={colors.textSecondary} />
              <Text variant="bodyLarge" style={styles.contactText}>
                Cliente desde {format(parseISO(client.createdAt), "MMMM yyyy", { locale: es })}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Estadísticas
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {client.stats.totalAppointments}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Turnos totales
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {completionRate}%
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Asistencia
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  ${client.stats.totalSpent}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Total gastado
                </Text>
              </View>
            </View>
            {client.stats.lastVisit && (
              <View style={styles.lastVisit}>
                <Text variant="bodySmall" style={styles.lastVisitLabel}>
                  Última visita:
                </Text>
                <Text variant="bodyMedium">
                  {format(parseISO(client.stats.lastVisit), "d 'de' MMMM, yyyy", { locale: es })}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Notes */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.notesHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Notas
              </Text>
              <IconButton
                icon="pencil"
                size={20}
                onPress={openNotesModal}
              />
            </View>
            {client.notes ? (
              <Text variant="bodyMedium">{client.notes}</Text>
            ) : (
              <Text variant="bodyMedium" style={styles.noNotes}>
                Sin notas. Toca el lápiz para agregar.
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Appointments History */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Historial de Turnos
            </Text>
            {appointmentsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : appointments.length > 0 ? (
              <>
                {appointments.slice(0, 5).map((apt, index) => (
                  <React.Fragment key={apt._id}>
                    {index > 0 && <Divider style={styles.appointmentDivider} />}
                    <TouchableOpacity
                      style={styles.appointmentRow}
                      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: apt._id })}
                    >
                      <View style={styles.appointmentInfo}>
                        <Text variant="bodyLarge">
                          {format(parseISO(apt.date), "d MMM yyyy", { locale: es })} - {apt.startTime}
                        </Text>
                        <Text variant="bodySmall" style={styles.appointmentServices}>
                          {apt.services.map(s => s.name).join(', ')}
                        </Text>
                        <Text variant="bodySmall" style={styles.appointmentStaff}>
                          {apt.staffInfo.name}
                        </Text>
                      </View>
                      <View style={styles.appointmentRight}>
                        <Chip
                          compact
                          style={[
                            styles.statusChip,
                            { backgroundColor: getStatusColor(apt.status) + '20' },
                          ]}
                          textStyle={{ color: getStatusColor(apt.status), fontSize: 10 }}
                        >
                          {getStatusLabel(apt.status)}
                        </Chip>
                        <Text variant="bodyMedium" style={styles.appointmentPrice}>
                          ${apt.pricing.total}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
                {appointments.length > 5 && (
                  <Button
                    mode="text"
                    onPress={() => navigation.navigate('ClientAppointments', { clientId })}
                    style={styles.viewAllButton}
                  >
                    Ver todos los turnos ({appointments.length})
                  </Button>
                )}
              </>
            ) : (
              <Text variant="bodyMedium" style={styles.noAppointments}>
                Este cliente no tiene turnos registrados
              </Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Block Modal */}
      <Portal>
        <Modal
          visible={showBlockModal}
          onDismiss={() => setShowBlockModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Bloquear Cliente
          </Text>
          <Text variant="bodyMedium" style={styles.modalDescription}>
            El cliente no podrá realizar reservas mientras esté bloqueado.
          </Text>
          <TextInput
            label="Motivo (opcional)"
            value={blockReason}
            onChangeText={setBlockReason}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowBlockModal(false)}
              style={styles.modalButton}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => blockMutation.mutate(blockReason || undefined)}
              loading={blockMutation.isPending}
              buttonColor={colors.error}
              style={styles.modalButton}
            >
              Bloquear
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Notes Modal */}
      <Portal>
        <Modal
          visible={showNotesModal}
          onDismiss={() => setShowNotesModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Notas del Cliente
          </Text>
          <TextInput
            label="Notas"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={5}
            style={styles.modalInput}
            placeholder="Preferencias, alergias, información importante..."
          />
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowNotesModal(false)}
              style={styles.modalButton}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => updateNotesMutation.mutate(notes)}
              loading={updateNotesMutation.isPending}
              style={styles.modalButton}
            >
              Guardar
            </Button>
          </View>
        </Modal>
      </Portal>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.textSecondary,
    marginVertical: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  blockedChip: {
    backgroundColor: colors.errorLight,
  },
  blockedChipText: {
    color: colors.error,
    fontSize: 11,
  },
  registeredChip: {
    backgroundColor: colors.successLight,
  },
  blockedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
  },
  blockedAlertContent: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  blockedAlertText: {
    color: colors.error,
    fontWeight: '500',
  },
  blockedReason: {
    color: colors.error,
    opacity: 0.8,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  newAppointmentButton: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  contactText: {
    marginLeft: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  lastVisit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  lastVisitLabel: {
    color: colors.textSecondary,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -spacing.sm,
  },
  noNotes: {
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  appointmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentServices: {
    color: colors.textSecondary,
  },
  appointmentStaff: {
    color: colors.textTertiary,
  },
  appointmentRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  statusChip: {
    marginBottom: 4,
  },
  appointmentPrice: {
    fontWeight: '600',
    color: colors.primary,
  },
  appointmentDivider: {
    marginVertical: spacing.xs,
  },
  viewAllButton: {
    marginTop: spacing.sm,
  },
  noAppointments: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.background,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  modalDescription: {
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalInput: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

export default ClientDetailScreen;
