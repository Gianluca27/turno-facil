import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../shared/theme';
import { ExploreStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/api';

type RouteProps = RouteProp<ExploreStackParamList, 'BusinessServices'>;

export default function BusinessServicesScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { businessId } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['business-services', businessId],
    queryFn: () => businessApi.getServices(businessId),
  });

  const services = data?.data?.data?.services || [];
  const categories = data?.data?.data?.categories || [];

  const renderService = ({ item }: { item: any }) => (
    <View style={styles.serviceItem}>
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <Text style={styles.serviceDuration}>{item.duration} min</Text>
        {item.description && (
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <Text style={styles.servicePrice}>${item.price?.toLocaleString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Servicios</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={services}
        renderItem={renderService}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  list: {
    padding: 16,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 16,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  serviceDuration: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
});
