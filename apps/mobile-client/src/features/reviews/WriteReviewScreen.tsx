import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { AppointmentsStackParamList } from '../../navigation/types';
import { reviewsApi } from '../../services/api';

type RouteProps = RouteProp<AppointmentsStackParamList, 'WriteReview'>;

export default function WriteReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { appointmentId } = route.params;
  const queryClient = useQueryClient();

  const [ratings, setRatings] = useState({
    overall: 0,
    service: 0,
    staff: 0,
    cleanliness: 0,
    value: 0,
  });
  const [text, setText] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      reviewsApi.create({
        appointmentId,
        ratings,
        content: { text: text.trim() || 'Sin comentarios' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      Alert.alert('¡Gracias!', 'Tu reseña fue publicada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo publicar la reseña');
    },
  });

  const RatingStars = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onChange(star)}>
            <Icon
              name={star <= value ? 'star' : 'star-outline'}
              size={32}
              color={star <= value ? colors.star : colors.gray300}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const canSubmit = ratings.overall > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Escribir reseña</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>¿Cómo fue tu experiencia?</Text>

        <View style={styles.ratingsCard}>
          <RatingStars
            label="Calificación general"
            value={ratings.overall}
            onChange={(v) => setRatings((prev) => ({ ...prev, overall: v }))}
          />
          <RatingStars
            label="Calidad del servicio"
            value={ratings.service}
            onChange={(v) => setRatings((prev) => ({ ...prev, service: v }))}
          />
          <RatingStars
            label="Atención del profesional"
            value={ratings.staff}
            onChange={(v) => setRatings((prev) => ({ ...prev, staff: v }))}
          />
          <RatingStars
            label="Limpieza"
            value={ratings.cleanliness}
            onChange={(v) => setRatings((prev) => ({ ...prev, cleanliness: v }))}
          />
          <RatingStars
            label="Relación calidad-precio"
            value={ratings.value}
            onChange={(v) => setRatings((prev) => ({ ...prev, value: v }))}
          />
        </View>

        <Text style={styles.sectionTitle}>Comentario (opcional)</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Contá tu experiencia..."
          mode="outlined"
          multiline
          numberOfLines={5}
          style={styles.textInput}
          outlineStyle={styles.textInputOutline}
        />

        <Button
          mode="contained"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!canSubmit || mutation.isPending}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          Publicar reseña
        </Button>
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  ratingsCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: { fontSize: 14, color: colors.text, flex: 1 },
  stars: { flexDirection: 'row', gap: 4 },
  textInput: { backgroundColor: colors.white },
  textInputOutline: { borderRadius: 12 },
  submitButton: { marginTop: 24, borderRadius: 12, backgroundColor: colors.primary },
  submitButtonContent: { height: 52 },
});
