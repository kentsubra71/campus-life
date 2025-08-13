import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { ChildWellnessScreen } from '../screens/parent/ChildWellnessScreen';
import { SendSupportScreen } from '../screens/parent/SendSupportScreen';
import { ActivityHistoryScreen } from '../screens/parent/ActivityHistoryScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { PaymentReturnHandler } from '../components/PaymentReturnHandler';
import { PayPalP2PReturnHandler } from '../components/PayPalP2PReturnHandler';
import { PayPalTestScreen } from '../screens/parent/PayPalTestScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ParentMainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={ParentDashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen 
        name="Activity" 
        component={ActivityHistoryScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="history" color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" color={color} size={24} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const ParentNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ParentTabs" component={ParentMainTabs} />
      <Stack.Screen name="ChildWellness" component={ChildWellnessScreen} />
      <Stack.Screen name="SendSupport" component={SendSupportScreen} />
      <Stack.Screen name="PaymentReturn" component={PaymentReturnHandler} />
      <Stack.Screen name="PayPalP2PReturn" component={PayPalP2PReturnHandler} />
      <Stack.Screen name="PayPalTest" component={PayPalTestScreen} />
    </Stack.Navigator>
  );
}; 