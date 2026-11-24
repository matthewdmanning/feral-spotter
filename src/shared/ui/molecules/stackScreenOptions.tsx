/**
 * The header and transition options every Stack in the app shares, so the
 * root and submission flows cannot drift apart. Layouts spread it and add
 * their own options after.
 */

import type { NativeStackNavigationOptions } from 'expo-router'
import { Text } from '@/src/shared/ui/atoms/Text'
import type { useUnistyles } from 'react-native-unistyles'

export function stackScreenOptions(
  theme: ReturnType<typeof useUnistyles>['theme'],
): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.text,
    headerTitle: ({ children, tintColor }) => (
      <Text style={[theme.textVariants.heading, { color: tintColor }]}>
        {children}
      </Text>
    ),
    headerTitleStyle: {
      fontFamily: theme.fonts.bold,
      fontSize: theme.typography.lg,
      color: theme.colors.text,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.colors.background },
    animation: 'slide_from_right',
    gestureEnabled: true,
  }
}
