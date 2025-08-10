import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { ChildWellnessScreen } from '../screens/parent/ChildWellnessScreen';
import { SendSupportScreen } from '../screens/parent/SendSupportScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ParentMainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1f2937',
          borderTopColor: '#374151',
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
          paddingHorizontal: 12,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          flex: 1,
          paddingVertical: 6,
          paddingHorizontal: 4,
          borderRadius: 10,
          marginHorizontal: 2,
          minHeight: 50,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveBackgroundColor: 'rgba(99, 102, 241, 0.1)',
        tabBarInactiveBackgroundColor: 'transparent',
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={ParentDashboardScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="SendSupport" 
        component={SendSupportScreen}
        options={{
          tabBarLabel: 'Send Love',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
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
    </Stack.Navigator>
  );
}; 