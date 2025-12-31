import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../../services/settingsTheme';

export default function AppTabsLayout() {
  const t = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 62,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: t.border,
          backgroundColor: t.card,
        },
        tabBarActiveTintColor: t.text,
        tabBarInactiveTintColor: t.muted,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Carte',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="map-outline" />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Liste',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="list-outline" />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoris',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="heart-outline" />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Événements',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="calendar-outline" />,
        }}
      />
      <Tabs.Screen
        name="business"
        options={{
          title: 'Pro',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="briefcase-outline" />,
        }}
      />

      {/* Hidden routes pushed on top of tabs */}
      <Tabs.Screen
        name="event-create"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="business-apply"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile-establishment"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="user-event-create"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="user-events-my"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}


