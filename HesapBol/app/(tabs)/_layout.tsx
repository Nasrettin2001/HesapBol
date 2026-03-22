import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1CC29F',
        tabBarInactiveTintColor: isDark ? '#6C6C80' : '#8E8E93',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
            borderTopColor: isDark ? '#2A2A3E' : '#E8E8ED',
          },
          default: {
            backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
            borderTopColor: isDark ? '#2A2A3E' : '#E8E8ED',
            elevation: 8,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Gruplar',
          tabBarIcon: ({ color }) => <Feather size={24} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Aktivite',
          tabBarIcon: ({ color }) => <Feather size={24} name="activity" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Feather size={24} name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
