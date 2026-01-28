import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../shared/theme';
import {
  MainTabParamList,
  ExploreStackParamList,
  AppointmentsStackParamList,
  FavoritesStackParamList,
  ProfileStackParamList,
} from './types';

// Explore Screens
import ExploreScreen from '../features/explore/ExploreScreen';
import SearchScreen from '../features/explore/SearchScreen';
import BusinessProfileScreen from '../features/business/BusinessProfileScreen';
import BusinessServicesScreen from '../features/business/BusinessServicesScreen';
import BusinessStaffScreen from '../features/business/BusinessStaffScreen';
import BusinessReviewsScreen from '../features/business/BusinessReviewsScreen';

// Appointments Screens
import AppointmentsListScreen from '../features/appointments/AppointmentsListScreen';
import AppointmentDetailScreen from '../features/appointments/AppointmentDetailScreen';
import RescheduleScreen from '../features/appointments/RescheduleScreen';
import WriteReviewScreen from '../features/reviews/WriteReviewScreen';

// Favorites Screens
import FavoritesListScreen from '../features/favorites/FavoritesListScreen';

// Profile Screens
import ProfileScreen from '../features/profile/ProfileScreen';
import EditProfileScreen from '../features/profile/EditProfileScreen';
import NotificationsScreen from '../features/profile/NotificationsScreen';
import PaymentMethodsScreen from '../features/profile/PaymentMethodsScreen';
import SettingsScreen from '../features/profile/SettingsScreen';
import MyReviewsScreen from '../features/reviews/MyReviewsScreen';
import PromotionsScreen from '../features/promotions/PromotionsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const AppointmentsStack = createNativeStackNavigator<AppointmentsStackParamList>();
const FavoritesStack = createNativeStackNavigator<FavoritesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// Explore Stack Navigator
function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ExploreStack.Screen name="Explore" component={ExploreScreen} />
      <ExploreStack.Screen name="Search" component={SearchScreen} />
      <ExploreStack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
      <ExploreStack.Screen name="BusinessServices" component={BusinessServicesScreen} />
      <ExploreStack.Screen name="BusinessStaff" component={BusinessStaffScreen} />
      <ExploreStack.Screen name="BusinessReviews" component={BusinessReviewsScreen} />
    </ExploreStack.Navigator>
  );
}

// Appointments Stack Navigator
function AppointmentsStackNavigator() {
  return (
    <AppointmentsStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AppointmentsStack.Screen name="AppointmentsList" component={AppointmentsListScreen} />
      <AppointmentsStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
      <AppointmentsStack.Screen name="RescheduleAppointment" component={RescheduleScreen} />
      <AppointmentsStack.Screen name="WriteReview" component={WriteReviewScreen} />
    </AppointmentsStack.Navigator>
  );
}

// Favorites Stack Navigator
function FavoritesStackNavigator() {
  return (
    <FavoritesStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <FavoritesStack.Screen name="FavoritesList" component={FavoritesListScreen} />
    </FavoritesStack.Navigator>
  );
}

// Profile Stack Navigator
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
      <ProfileStack.Screen name="MyReviews" component={MyReviewsScreen} />
      <ProfileStack.Screen name="Promotions" component={PromotionsScreen} />
    </ProfileStack.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarLabel: 'Explorar',
          tabBarIcon: ({ color, size }) => (
            <Icon name="magnify" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AppointmentsTab"
        component={AppointmentsStackNavigator}
        options={{
          tabBarLabel: 'Mis Turnos',
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar-clock" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="FavoritesTab"
        component={FavoritesStackNavigator}
        options={{
          tabBarLabel: 'Favoritos',
          tabBarIcon: ({ color, size }) => (
            <Icon name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
