import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';
import { Platform } from 'react-native';

const VercelAnalytics = Platform.OS === 'web'
  ? require('@vercel/analytics/react').Analytics
  : () => null;

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      <VercelAnalytics />
    </ThemeProvider>
  );
}
