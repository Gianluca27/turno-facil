import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, Button, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { useAuthStore } from '../../shared/stores/authStore';
import { userApi } from '../../services/api';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.profile?.firstName || '');
  const [lastName, setLastName] = useState(user?.profile?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const mutation = useMutation({
    mutationFn: () => userApi.updateProfile({ firstName, lastName, phone }),
    onSuccess: (response) => {
      updateUser(response.data?.data?.user);
      Alert.alert('Perfil actualizado', 'Tus datos fueron guardados correctamente');
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar el perfil');
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Editar perfil</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarContainer}>
          <Avatar.Text size={100} label={firstName[0] || 'U'} style={styles.avatar} />
          <TouchableOpacity style={styles.changeAvatarButton}>
            <Icon name="camera" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Nombre"
            value={firstName}
            onChangeText={setFirstName}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="Apellido"
            value={lastName}
            onChangeText={setLastName}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="Email"
            value={user?.email || ''}
            mode="outlined"
            disabled
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />
        </View>

        <Button
          mode="contained"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          Guardar cambios
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
  avatarContainer: { alignItems: 'center', marginVertical: 24, position: 'relative' },
  avatar: { backgroundColor: colors.primary },
  changeAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  form: { gap: 12 },
  input: { backgroundColor: colors.white },
  inputOutline: { borderRadius: 12 },
  saveButton: { marginTop: 24, borderRadius: 12, backgroundColor: colors.primary },
  saveButtonContent: { height: 52 },
});
