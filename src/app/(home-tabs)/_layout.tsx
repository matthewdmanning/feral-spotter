/**
 * app/(home-tabs)/_layout.tsx
 * Tab navigator — only screens that truly belong in bottom tabs.
 * Routes declare when a screen shows; screens/ contains what they show.
 *
 * Native tabs (expo-router/native-tabs): Android draws its own Material
 * bottom navigation bar (active indicator, ripple, animation, TalkBack), and
 * iOS 26 draws its system glass tab bar. The Android bar takes solid colours
 * only; the theme reaches it through the indicator, ripple, icon and label
 * colours.
 *
 * Icons are Phosphor, the same set as the rest of the app. On Android they
 * are vector drawables written at prebuild by
 * plugins/withPhosphorTabDrawables.js, the fastest icon source native tabs
 * accept: regular weight idle, fill weight selected. iOS uses SF Symbols.
 * src/config/tabIcons.json names both.
 *
 * useUnistyles with a navigator is explicitly allowed by Unistyles —
 * navigators do not re-render screens on option changes.
 */

import tabIcons from '@/src/shared/config/tabIcons.json'
import { selectionHaptic } from '@/src/shared/lib/haptics'
import { NativeTabs, type SFSymbolIcon } from 'expo-router/native-tabs'
import { useUnistyles } from 'react-native-unistyles'

type SFSymbols = NonNullable<SFSymbolIcon['sf']>
type TabName = keyof typeof tabIcons

const TABS: { name: TabName; title: string }[] = [
  { name: 'index', title: 'Home' },
  { name: 'feral-reports', title: 'Reports' },
  { name: 'settings', title: 'Settings' },
]

export default function HomeTabsLayout() {
  const { theme } = useUnistyles()
  const label = {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.textVariants.caption.fontSize,
  }

  return (
    <NativeTabs
      backgroundColor={theme.colors.surface}
      indicatorColor={theme.colors.accentSoft}
      rippleColor={theme.colors.secondary}
      iconColor={{
        default: theme.colors.muted,
        selected: theme.colors.accentSoftText,
      }}
      labelStyle={{
        default: { ...label, color: theme.colors.muted },
        selected: { ...label, color: theme.colors.text },
      }}
      // Three tabs: Material shows every label.
      labelVisibilityMode="labeled"
      screenListeners={{ tabPress: () => selectionHaptic() }}
    >
      {TABS.map(({ name, title }) => {
        const { drawable, sf } = tabIcons[name]
        return (
          <NativeTabs.Trigger key={name} name={name}>
            <NativeTabs.Trigger.Label>{title}</NativeTabs.Trigger.Label>
            {/* The JSON types symbol names as plain strings. */}
            <NativeTabs.Trigger.Icon drawable={drawable} sf={sf as SFSymbols} />
          </NativeTabs.Trigger>
        )
      })}
    </NativeTabs>
  )
}
