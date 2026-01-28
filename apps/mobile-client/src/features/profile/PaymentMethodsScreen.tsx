import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, ActivityIndicator, FAB } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { userApi } from '../../services/api';

interface PaymentMethod {
  _id: string;
  type: 'card' | 'mercadopago';
  last4: string;
  brand: string;
  isDefault: boolean;
}

export default function PaymentMethodsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => userApi.getPaymentMethods(),
  });

  const paymentMethods: PaymentMethod[] = data?.data?.data?.paymentMethods || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.deletePaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
    onError: () => {
      Alert.alert('Error', 'No se pudo eliminar el método de pago');
    },
  });

  const handleDelete = (id: string) => {
    Alert.alert(
      'Eliminar método de pago',
      '¿Estás seguro de que querés eliminar este método de pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]
    );
  };

  const getCardIcon = (brand: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa': return 'credit-card';
      case 'mastercard': return 'credit-card';
      default: return 'credit-card-outline';
    }
  };

  const renderPaymentMethod = ({ item }: { item: PaymentMethod }) => (
    <View style={styles.methodCard}>
      <View style={styles.methodIcon}>
        <Icon name={getCardIcon(item.brand)} size={28} color={colors.text} />
      </View>
      <View style={styles.methodInfo}>
        <Text style={styles.methodBrand}>{item.brand} •••• {item.last4}</Text>
        {item.isDefault && <Text style={styles.defaultLabel}>Predeterminada</Text>}
      </View>
      <TouchableOpacity onPress={() => handleDelete(item._id)}>
        <Icon name="delete-outline" size={24} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Métodos de pago</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={paymentMethods}
          keyExtractor={(item) => item._id}
          renderItem={renderPaymentMethod}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="credit-card-off-outline" size={64} color={colors.gray300} />
              <Text style={styles.emptyTitle}>Sin métodos de pago</Text>
              <Text style={styles.emptySubtitle}>Agregá una tarjeta para pagar más rápido</Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => Alert.alert('Próximamente', 'Esta función estará disponible pronto')}
      />
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
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodIcon: { marginRight: 12 },
  methodInfo: { flex: 1 },
  methodBrand: { fontSize: 16, fontWeight: '500', color: colors.text },
  defaultLabel: { fontSize: 12, color: colors.success, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.primary },
});
