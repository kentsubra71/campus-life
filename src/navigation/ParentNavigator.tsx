import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { StatusHeader } from '../components/StatusHeader';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { ChildWellnessScreen } from '../screens/parent/ChildWellnessScreen';
import { SendSupportScreen } from '../screens/parent/SendSupportScreen';
import { ActivityHistoryScreen } from '../screens/parent/ActivityHistoryScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { PaymentReturnHandler } from '../components/PaymentReturnHandler';
import { PayPalP2PReturnHandler } from '../components/PayPalP2PReturnHandler';
import { FamilyJoinRequestsScreen } from '../screens/parent/FamilyJoinRequestsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ParentMainTabs = () => {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
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
        })}
        screenListeners={{
          state: (e) => {
            // This will be used to update header title based on active tab
          },
        }}
      >
      <Tab.Screen 
        name="Dashboard" 
        component={ParentDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="dashboard" color={color} size={24} />
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
    </View>
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
      <Stack.Screen name="FamilyJoinRequests" component={FamilyJoinRequestsScreen} />
      <Stack.Screen name="PaymentReturn" component={PaymentReturnHandler} />
      <Stack.Screen name="PayPalP2PReturn" component={PayPalP2PReturnHandler} />
    </Stack.Navigator>
  );
}; 