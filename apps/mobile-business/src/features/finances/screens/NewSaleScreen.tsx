import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Divider,
  IconButton,
  SegmentedButtons,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { financesApi, servicesApi } from '../../../services/api';
import { colors, spacing } from '../../../shared/theme';
import { useCurrentBusiness } from '../../../shared/stores/authStore';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo', icon: 'cash' },
  { value: 'card', label: 'Tarjeta', icon: 'credit-card' },
  { value: 'mercadopago', label: 'MercadoPago', icon: 'cellphone' },
  { value: 'transfer', label: 'Transferencia', icon: 'bank-transfer' },
] as const;

interface SaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export const NewSaleScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const currentBusiness = useCurrentBusiness();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [showServicePicker, setShowServicePicker] = useState(false);

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', currentBusiness?.businessId],
    queryFn: () => servicesApi.list(),
    enabled: !!currentBusiness,
  });

  const services = servicesData?.data?.data?.services || [];

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => data._useQuickSale ? financesApi.quickSale(data) : financesApi.createSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finances-transactions'] });
      Alert.alert('Venta registrada', 'La venta se registr\u00f3 exitosamente.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo registrar la venta');
    },
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addServiceItem = (service: any) => {
    const existing = items.find((i) => i.id === service._id);
    if (existing) {
      setItems(items.map((i) =>
        i.id === service._id ? { ...i, quantity: i.quantity + 1 } : i,
      ));
    } else {
      setItems([...items, {
        id: service._id,
        name: service.name,
        price: service.finalPrice || service.price,
        quantity: 1,
      }]);
    }
    setShowServicePicker(false);
  };

  const addCustomItem = () => {
    const price = parseFloat(customItemPrice);
    if (!customItemName.trim() || isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Ingres\u00e1 un nombre y precio v\u00e1lido');
      return;
    }

    setItems([...items, {
      id: `custom_${Date.now()}`,
      name: customItemName.trim(),
      price,
      quantity: 1,
    }]);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      const newQty = item.quantity + delta;
      return newQty > 0 ? { ...item, quantity: newQty } : item;
    }).filter((item) => item.quantity > 0));
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const handleSubmit = () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Agreg\u00e1 al menos un \u00edtem a la venta');
      return;
    }

    Alert.alert(
      'Confirmar venta',
      `Total: $${subtotal.toLocaleString('es-AR')}\nM\u00e9todo: ${PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            const hasCustomItems = items.some((i) => i.id.startsWith('custom_'));

            if (hasCustomItems) {
              // Use quick-sale for custom/ad-hoc items
              const description = items.map((i) => `${i.name} x${i.quantity}`).join(', ');
              createSaleMutation.mutate({
                _useQuickSale: true,
                amount: subtotal,
                description,
                paymentMethod,
              });
            } else {
              // Use full sale for catalog services
              createSaleMutation.mutate({
                items: items.map((i) => ({
                  type: 'service' as const,
                  itemId: i.id,
                  quantity: i.quantity,
                  price: i.price,
                })),
                paymentMethod,
                clientInfo: clientName.trim() ? { name: clientName.trim() } : undefined,
                notes: notes.trim() || undefined,
              });
            }
          },
        },
      ],
    );
  };

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Items section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              \u00cdtems de venta
            </Text>

            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text variant="bodyMedium" numberOfLines={1} style={styles.itemName}>
                    {item.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.itemPrice}>
                    {formatCurrency(item.price)} c/u
                  </Text>
                </View>
                <View style={styles.quantityControls}>
                  <IconButton
                    icon="minus"
                    size={18}
                    onPress={() => updateQuantity(item.id, -1)}
                    style={styles.qtyButton}
                  />
                  <Text variant="bodyMedium" style={styles.qtyText}>
                    {item.quantity}
                  </Text>
                  <IconButton
                    icon="plus"
                    size={18}
                    onPress={() => updateQuantity(item.id, 1)}
                    style={styles.qtyButton}
                  />
                </View>
                <Text variant="bodyMedium" style={styles.itemTotal}>
                  {formatCurrency(item.price * item.quantity)}
                </Text>
                <IconButton
                  icon="close"
                  size={16}
                  onPress={() => removeItem(item.id)}
                  iconColor={colors.error}
                />
              </View>
            ))}

            {items.length === 0 && (
              <Text variant="bodyMedium" style={styles.emptyText}>
                No hay \u00edtems agregados
              </Text>
            )}

            <Divider style={styles.divider} />

            {/* Add from services */}
            <Text variant="labelLarge" style={styles.addLabel}>Agregar servicio</Text>
            {showServicePicker ? (
              <View style={styles.servicePicker}>
                {servicesLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.serviceChips}>
                      {services.filter((s: any) => s.status === 'active').map((service: any) => (
                        <Chip
                          key={service._id}
                          onPress={() => addServiceItem(service)}
                          style={styles.serviceChip}
                        >
                          {service.name} - {formatCurrency(service.finalPrice || service.price)}
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>
                )}
                <Button
                  mode="text"
                  compact
                  onPress={() => setShowServicePicker(false)}
                >
                  Cancelar
                </Button>
              </View>
            ) : (
              <Button
                mode="outlined"
                icon="tag"
                onPress={() => setShowServicePicker(true)}
                style={styles.addButton}
              >
                Seleccionar servicio
              </Button>
            )}

            {/* Add custom item */}
            <Text variant="labelLarge" style={[styles.addLabel, { marginTop: spacing.md }]}>
              \u00cdtem personalizado
            </Text>
            <View style={styles.customItemRow}>
              <TextInput
                mode="outlined"
                label="Nombre"
                value={customItemName}
                onChangeText={setCustomItemName}
                style={styles.customNameInput}
                dense
              />
              <TextInput
                mode="outlined"
                label="Precio"
                value={customItemPrice}
                onChangeText={setCustomItemPrice}
                keyboardType="numeric"
                style={styles.customPriceInput}
                left={<TextInput.Affix text="$" />}
                dense
              />
              <IconButton
                icon="plus-circle"
                iconColor={colors.primary}
                size={28}
                onPress={addCustomItem}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Payment method */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              M\u00e9todo de pago
            </Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_METHODS.map((method) => (
                <Button
                  key={method.value}
                  mode={paymentMethod === method.value ? 'contained' : 'outlined'}
                  icon={method.icon}
                  onPress={() => setPaymentMethod(method.value)}
                  style={styles.paymentButton}
                  compact
                >
                  {method.label}
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Optional info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Informaci\u00f3n adicional
            </Text>
            <TextInput
              mode="outlined"
              label="Nombre del cliente (opcional)"
              value={clientName}
              onChangeText={setClientName}
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
            />
            <TextInput
              mode="outlined"
              label="Notas (opcional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              style={styles.input}
              left={<TextInput.Icon icon="note-text" />}
            />
          </Card.Content>
        </Card>

        {/* Total */}
        <Card style={styles.totalCard}>
          <Card.Content>
            <View style={styles.totalRow}>
              <Text variant="titleLarge" style={styles.totalLabel}>
                Total
              </Text>
              <Text variant="headlineMedium" style={styles.totalAmount}>
                {formatCurrency(subtotal)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.footerButton}
        >
          Cancelar
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={createSaleMutation.isPending}
          disabled={items.length === 0 || createSaleMutation.isPending}
          style={styles.footerButton}
          icon="cash-register"
        >
          Cobrar
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  card: {
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontWeight: '500',
  },
  itemPrice: {
    color: colors.textSecondary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    margin: 0,
  },
  qtyText: {
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  itemTotal: {
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'right',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  divider: {
    marginVertical: spacing.md,
  },
  addLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  servicePicker: {
    marginBottom: spacing.sm,
  },
  serviceChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  serviceChip: {
    marginRight: spacing.xs,
  },
  addButton: {
    marginBottom: spacing.sm,
  },
  customItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customNameInput: {
    flex: 2,
  },
  customPriceInput: {
    flex: 1,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentButton: {
    flex: 1,
    minWidth: '45%',
  },
  input: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  totalCard: {
    backgroundColor: colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  totalAmount: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerButton: {
    flex: 1,
  },
});

export default NewSaleScreen;
