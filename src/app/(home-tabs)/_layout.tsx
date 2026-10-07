/**
 * app/(home-tabs)/_layout.tsx
 * Tab navigator — only screens that truly belong in bottom tabs.
 * Routes declare when a screen shows; screens/ contains what they show.
 *
 * useUnistyles with Tabs is explicitly allowed by Unistyles —
 * react-navigation does not re-render screens on screenOptions changes.
 *
 * Gradients are inline styles, not Unistyles ones: RN processes
 * experimental_backgroundImage in JS, which Unistyles' native updates skip.
 */

import { Tabs } from 'expo-router'
import type { BottomTabBarButtonProps } from 'expo-router/js-tabs'
import { PlatformPressable } from 'expo-router/react-navigation'
import { PixelRatio, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import {
  Camera,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react-native'
import { selectionHaptic } from '@/src/lib/haptics'

function HapticTabButton(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(event) => {
        selectionHaptic()
        props.onPressIn?.(event)
      }}
    />
  )
}

// The focused tab's icon sits on a raised eyeshine pill (Material's active
// indicator); idle icons sit flat.
function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  const { theme } = useUnistyles()
  return (
    <View
      style={[
        {
          paddingHorizontal: theme.spacing.lg,
          // Thin, so the pill does not push the label into the gesture bar.
          paddingVertical: 2,
          borderRadius: theme.radius.full,
        },
        focused && {
          experimental_backgroundImage: theme.gradients.primary,
          boxShadow: theme.depth.raised,
        },
      ]}
    >
      <Icon
        size={theme.iconSize.xl}
        color={focused ? theme.colors.accentText : theme.colors.muted}
      />
    </View>
  )
}

export default function HomeTabsLayout() {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  // The stock bar height assumes default text and 24dp icons. Size it from
  // the real contents instead — pill, label at the OS font scale — plus a
  // gap above the gesture bar, so the labels never sit on it.
  const labelHeight =
    theme.textVariants.caption.lineHeight * PixelRatio.getFontScale()
  const bottomGap = insets.bottom + theme.spacing.md
  const tabBarHeight =
    theme.spacing.sm +
    theme.iconSize.xl +
    4 +
    theme.spacing.xs +
    labelHeight +
    bottomGap

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: theme.spacing.sm,
          paddingBottom: bottomGap,
        },
        tabBarBackground: () => (
          <View
            style={{
              flex: 1,
              experimental_backgroundImage: theme.gradients.tabBar,
            }}
          />
        ),
        tabBarButton: HapticTabButton,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: {
          ...theme.textVariants.caption,
          marginTop: theme.spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Camera} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feral-reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={ClipboardList} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Settings} focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}
