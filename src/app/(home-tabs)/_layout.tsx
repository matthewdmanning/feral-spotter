/**
 * app/(home-tabs)/_layout.tsx
 * Tab navigator — only screens that truly belong in bottom tabs.
 * Routes declare when a screen shows; screens/ contains what they show.
 *
 * useUnistyles with Tabs is explicitly allowed by Unistyles —
 * react-navigation does not re-render screens on screenOptions changes.
 */

import { Tabs } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Camera, ClipboardList, Settings } from 'lucide-react-native'

const TAB_ICON_SIZE = 24

export default function HomeTabsLayout() {
  const { theme } = useUnistyles()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor:  theme.colors.border,
          borderTopWidth:  1,
        },
        tabBarActiveTintColor:   theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle:        { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Camera size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feral-reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <ClipboardList size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={TAB_ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  )
}
