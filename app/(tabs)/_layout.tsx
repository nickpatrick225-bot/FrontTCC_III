import { Tabs } from 'expo-router';
import { Chrome as Home, Settings, Heart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // No Android com botões de navegação, insets.bottom é ~48px
  // No Android com gestos, insets.bottom é ~0-20px
  // No iOS, insets.bottom é ~34px (home indicator)
  const bottomPadding = Platform.OS === 'android'
    ? Math.max(insets.bottom, 10)
    : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 8,
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
        },
        tabBarActiveTintColor: '#40E0D0',
        tabBarInactiveTintColor: '#666',
      }}>
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ size, color }) => (
            <Heart size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Configurações',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
