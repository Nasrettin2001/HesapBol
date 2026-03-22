import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from 'nativewind';
import { AuthProvider } from '../providers/AuthProvider';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Auto refresh tick failed with error']);

export const unstable_settings = {
  anchor: '(tabs)',
};

// Custom themes that match our NativeWind palette
const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#1CC29F',
    background: '#0D0D14',
    card: '#1A1A2E',
    text: '#F0F0F5',
    border: '#2A2A3E',
    notification: '#FF6B6B',
  },
};

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1CC29F',
    background: '#F8F9FA',
    card: '#FFFFFF',
    text: '#1A1A2E',
    border: '#E8E8ED',
    notification: '#FF5252',
  },
};

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? customDarkTheme : customLightTheme}>
      <View style={{ flex: 1 }} className={colorScheme === 'dark' ? 'dark' : ''}>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="group" options={{ headerShown: false }} />
            <Stack.Screen name="expense" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        </AuthProvider>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
