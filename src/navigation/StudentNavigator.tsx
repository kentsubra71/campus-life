import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/student/DashboardScreen';
import { LogWellnessScreen } from '../screens/student/LogWellnessScreen';
import { RewardsScreen } from '../screens/student/RewardsScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';
import WellnessLogScreen from '../screens/wellness/WellnessLogScreen';
import WellnessHistoryScreen from '../screens/wellness/WellnessHistoryScreen';
import { useTheme } from '../contexts/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const DashboardStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} />
      <Stack.Screen name="WellnessLog" component={WellnessLogScreen} />
      <Stack.Screen name="WellnessHistory" component={WellnessHistoryScreen} />
    </Stack.Navigator>
  );
};

export const StudentNavigator = () => {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
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