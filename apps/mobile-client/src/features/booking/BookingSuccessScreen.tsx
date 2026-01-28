import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { BookingStackParamList, RootStackParamList } from '../../navigation/types';
import { bookingApi } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<BookingStackParamList, 'BookingSuccess'>;

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function BookingSuccessScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { appointmentId } = route.params;

  // Fetch appointment details
  const { data } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => bookingApi.getById(appointmentId),
    enabled: !!appointmentId,
  });

  const appointment = data?.data?.data?.appointment;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
    const day = d.getDate();
    const month = MONTHS_ES[d.getMonth()];
    return `${dayName} ${day} de ${month}`;
  };

  const handleGoToAppointments = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Main',
            state: {
              routes: [{ name: 'AppointmentsTab' }],
              index: 1,
            },
          },
        ],
      })
    );
  };

  const handleGoHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      })
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Animation */}
        <View style={styles.animationContainer}>
          <View style={styles.checkCircle}>
            <Icon name="check" size={64} color={colors.white} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>¡Reserva confirmada!</Text>
        <Text style={styles.subtitle}>
          Tu turno ha sido reservado exitosamente. Te enviamos un email con los detalles.
        </Text>

        {/* Appointment Details */}
        {appointment && (
          <View style={styles.appointmentCard}>
            <Text style={styles.businessName}>{appointment.businessInfo?.name}</Text>

            <View style={styles.detailRow}>
              <Icon name="calendar" size={20} color={colors.primary} />
              <Text style={styles.detailText}>{formatDate(appointment.date)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Icon name="clock-outline" size={20} color={colors.primary} />
              <Text style={styles.detailText}>
                {appointment.startTime} - {appointment.endTime} hs
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Icon name="scissors-cutting" size={20} color={colors.primary} />
              <Text style={styles.detailText}>
                {appointment.services?.map((s: any) => s.name).join(', ')}
              </Text>
            </View>

            {appointment.staffInfo?.name && (
              <View style={styles.detailRow}>
                <Icon name="account" size={20} color={colors.primary} />
                <Text style={styles.detailText}>{appointment.staffInfo.name}</Text>
              </View>
            )}

            <View style={styles.pricingRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                ${appointment.pricing?.total?.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <View style={styles.tipItem}>
            <Icon name="bell-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.tipText}>
              Te enviaremos un recordatorio antes de tu turno
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Icon name="calendar-edit" size={20} color={colors.textSecondary} />
            <Text style={styles.tipText}>
              Podés modificar o cancelar desde "Mis Turnos"
            </Text>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleGoToAppointments}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Ver mis turnos
        </Button>
        <Button
          mode="outlined"
          onPress={handleGoHome}
          style={styles.secondaryButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.secondaryButtonLabel}
        >
          Volver al inicio
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  animationContainer: {
    marginBottom: 24,
  },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  appointmentCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  tipsContainer: {
    marginTop: 24,
    width: '100%',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  buttonContainer: {
    padding: 24,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    borderRadius: 12,
    borderColor: colors.primary,
  },
  buttonContent: {
    height: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});
