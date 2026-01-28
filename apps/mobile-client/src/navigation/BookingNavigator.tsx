import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookingStackParamList } from './types';

// Booking Screens
import SelectServicesScreen from '../features/booking/SelectServicesScreen';
import SelectStaffScreen from '../features/booking/SelectStaffScreen';
import SelectDateTimeScreen from '../features/booking/SelectDateTimeScreen';
import BookingConfirmationScreen from '../features/booking/BookingConfirmationScreen';
import BookingSuccessScreen from '../features/booking/BookingSuccessScreen';
import PaymentScreen from '../features/booking/PaymentScreen';

const Stack = createNativeStackNavigator<BookingStackParamList>();

export default function BookingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="SelectServices" component={SelectServicesScreen} />
      <Stack.Screen name="SelectStaff" component={SelectStaffScreen} />
      <Stack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
    </Stack.Navigator>
  );
}
