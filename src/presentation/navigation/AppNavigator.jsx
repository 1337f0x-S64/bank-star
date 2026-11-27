/**
 * @file AppNavigator.jsx
 * @description Root navigation container and hierarchy for BankStar PFM.
 * @standards SRS Alignment: FR-34, Section 4.1, Section 7.1
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BiometricGateScreen from '../screens/BiometricGateScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ExpenseHistoryScreen from '../screens/ExpenseHistoryScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ConverterScreen from '../screens/ConverterScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

/**
 * Standard screen options for all stack screens.
 */
const screenOptions = {
  headerStyle: {
    backgroundColor: '#0F172A',
  },
  headerTintColor: '#F8FAFC',
  headerTitleStyle: {
    fontWeight: '700',
  },
  contentStyle: {
    backgroundColor: '#0F172A',
  },
};

/**
 * Main application navigation component.
 *
 * @returns {React.ReactElement}
 */
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="BiometricGate"
        screenOptions={screenOptions}
      >
        <Stack.Screen
          name="BiometricGate"
          component={BiometricGateScreen}
          options={{
            headerShown: false,
            title: 'Security Gate',
          }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'BankStar PFM',
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="ExpenseHistory"
          component={ExpenseHistoryScreen}
          options={{
            title: 'Expense History',
          }}
        />
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={{
            title: 'Spending Reports',
          }}
        />
        <Stack.Screen
          name="Converter"
          component={ConverterScreen}
          options={{
            title: 'Currency Converter',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
