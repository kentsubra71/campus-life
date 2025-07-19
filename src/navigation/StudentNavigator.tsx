import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/student/DashboardScreen';
import { LogWellnessScreen } from '../screens/student/LogWellnessScreen';
import { RewardsScreen } from '../screens/student/RewardsScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';

const Tab = createBottomTabNavigator();

export const StudentNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="dashboard" color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Log"
        component={LogWellnessScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="add-circle" color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Rewards"
        component={RewardsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="card-giftcard" color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" color={color} size={24} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}; 