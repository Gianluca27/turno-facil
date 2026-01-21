import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '../../shared/theme';

// Feature screens
import { DashboardScreen } from '../../features/dashboard/screens/DashboardScreen';
import { CalendarScreen } from '../../features/calendar/screens/CalendarScreen';
import { ClientsScreen } from '../../features/clients/screens/ClientsScreen';
import { ServicesScreen } from '../../features/services/screens/ServicesScreen';
import { MoreScreen } from '../../features/settings/screens/MoreScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  Clients: undefined;
  Services: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: colors.text,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Calendar':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Clients':
              iconName = focused ? 'account-group' : 'account-group-outline';
              break;
            case 'Services':
              iconName = focused ? 'tag' : 'tag-outline';
              break;
            case 'More':
              iconName = focused ? 'menu' : 'menu';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Inicio',
          headerTitle: 'TurnoFácil',
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: 'Agenda',
          headerTitle: 'Agenda',
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          title: 'Clientes',
          headerTitle: 'Clientes',
        }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesScreen}
        options={{
          title: 'Servicios',
          headerTitle: 'Servicios',
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: 'Más',
          headerTitle: 'Configuración',
        }}
      />
    </Tab.Navigator>
  );
};
