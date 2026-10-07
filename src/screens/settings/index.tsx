import {
  getThemeMode,
  setThemeMode,
  type ThemeMode,
} from '@/src/config/unistyles'
import { AppButton } from '@/src/components/atoms/AppButton'
import { SegmentedControl } from '@/src/components/atoms/SegmentedControl'
import {
  getHapticsEnabled,
  selectionHaptic,
  setHapticsEnabled,
} from '@/src/lib/haptics'
import { useSettingsDraft } from '@/src/hooks/useSettingsDraft'
import { APP_VERSION } from '@/src/config/constants'
import { router } from 'expo-router'
import { Check, FileText, Key } from 'lucide-react-native'
import { useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useUnistyles, withUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const UniSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: { false: theme.colors.border, true: theme.colors.accent },
  thumbColor: theme.colors.text,
}))

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const PHOTO_TOGGLES = [
  {
    key: 'keep_photos_on_device',
    label: 'Keep Photos on Device',
    desc: 'Save captured photos to your camera roll',
    platform: null,
  },
  {
    key: 'improved_camera_capture',
    label: 'Improved Camera Capture',
    desc: 'Use device-aware VisionCamera capture on Android',
    devOnly: true,
    platform: 'android',
  },
  {
    key: 'ios_improved_camera_capture',
    label: 'Improved iPhone Capture',
    desc: 'Use the optimized VisionCamera + AVFoundation fallback on iOS',
    devOnly: true,
    platform: 'ios',
  },
  {
    key: 'native_camera_capture',
    label: 'Native Camera Capture',
    desc: 'Use AVFoundation on iOS or CameraX on Android; the VisionCamera path remains available',
    devOnly: true,
    platform: null,
  },
  {
    key: 'camera_max_detail',
    label: 'Maximum Detail',
    desc: 'Prefer the highest still-photo resolution exposed by the native camera',
    devOnly: true,
    platform: null,
  },
  {
    key: 'camera_motion_priority',
    label: 'Motion Priority',
    desc: 'Favor device-supported low-latency capture and shorter exposure behavior',
    devOnly: true,
    platform: null,
  },
  {
    key: 'camera_disable_low_light_boost',
    label: 'Disable Low-Light Boost',
    desc: 'Avoid platform low-light modes that may trade motion detail for brightness',
    devOnly: true,
    platform: null,
  },
  {
    key: 'camera_subject_metering',
    label: 'Subject Metering',
    desc: 'Allow a bounding-box localizer to steer native focus and exposure',
    devOnly: true,
    platform: null,
  },
  {
    key: 'camera_pinch_zoom',
    label: 'Pinch to Zoom',
    desc: 'Allow pinch to zoom the camera preview; a zoomed capture is a cropped capture',
    devOnly: true,
    platform: null,
  },
  {
    key: 'camera_performance_checks',
    label: 'Camera Performance Checks',
    desc: 'Attach comparable camera timing data to PostHog events for A/B testing',
    devOnly: true,
    platform: null,
  },
] as const

export default function SettingsScreen() {
  const { theme } = useUnistyles()
  const [themeMode, setSelectedThemeMode] = useState<ThemeMode>(getThemeMode)
  const [hapticsOn, setHapticsOn] = useState(getHapticsEnabled)
  // Like the theme, this applies at once rather than waiting for Save.
  const toggleHaptics = (next: boolean) => {
    setHapticsEnabled(next)
    setHapticsOn(next)
    selectionHaptic()
  }
  const {
    draft,
    patch,
    passwordConfigured,
    newPassword,
    confirmPassword,
    isVerifying,
    setNewPassword,
    setConfirmPassword,
    handleSave,
    handleDiscard,
    handleRemovePassword,
  } = useSettingsDraft()

  // Experimental camera tuning ships only in development installs, never in
  // Alpha, Beta or Preview builds (so not IS_PRERELEASE, which includes them).
  const photoToggles = PHOTO_TOGGLES.filter(
    (toggle) =>
      ('devOnly' in toggle ? __DEV__ : true) &&
      (toggle.platform === null || toggle.platform === Platform.OS),
  )

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>
              Configure appearance, authentication and storage
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Appearance</Text>
            <SegmentedControl
              label="Theme"
              options={THEME_OPTIONS}
              value={themeMode}
              onChange={(next) => {
                if (!next) return
                setThemeMode(next)
                setSelectedThemeMode(next)
              }}
              accessibilityLabel="Theme"
            />
            <Text style={styles.hint}>
              System follows your device&apos;s appearance setting.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Haptic Feedback</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextGroup}>
                <Text style={styles.toggleLabel}>Vibration on Touch</Text>
                <Text style={styles.hint}>
                  A light click when you press a button or switch tabs
                </Text>
              </View>
              <Pressable
                onPress={() => toggleHaptics(!hapticsOn)}
                style={styles.switchTarget}
                accessibilityRole="switch"
                accessibilityLabel="Haptic Feedback"
                accessibilityState={{ checked: hapticsOn }}
              >
                <UniSwitch value={hapticsOn} onValueChange={toggleHaptics} />
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Authentication</Text>
            {passwordConfigured ? (
              <View style={styles.gap}>
                <View style={styles.configuredRow}>
                  <Check
                    size={theme.iconSize.md}
                    color={theme.colors.accentSoftText}
                  />
                  <Text style={styles.configuredText}>Password configured</Text>
                </View>
                <Pressable
                  onPress={handleRemovePassword}
                  style={styles.linkRow}
                  accessibilityRole="button"
                >
                  <Key size={theme.iconSize.md} color={theme.colors.danger} />
                  <Text
                    style={[styles.linkText, { color: theme.colors.danger }]}
                  >
                    Remove Password
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.gap}>
                <Text style={styles.hint}>Required to submit observations</Text>
                {(['Password', 'Confirm Password'] as const).map((lbl, i) => (
                  <View key={lbl} style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{lbl}</Text>
                    <TextInput
                      secureTextEntry
                      placeholder={lbl}
                      placeholderTextColor={theme.colors.muted}
                      value={i === 0 ? newPassword : confirmPassword}
                      onChangeText={
                        i === 0 ? setNewPassword : setConfirmPassword
                      }
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photos</Text>
            {photoToggles.map(({ key, label, desc }, i) => {
              const on = draft[key]
              return (
                <View key={key}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleTextGroup}>
                      <Text style={styles.toggleLabel}>{label}</Text>
                      <Text style={styles.hint}>{desc}</Text>
                    </View>
                    <Pressable
                      onPress={() => patch(key, !on)}
                      style={styles.switchTarget}
                      accessibilityRole="switch"
                      accessibilityLabel={label}
                      accessibilityState={{ checked: on }}
                    >
                      <UniSwitch
                        value={on}
                        onValueChange={(value) => patch(key, value)}
                      />
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>FeralSpotter</Text>
            <Text style={styles.subtitle}>Version {APP_VERSION}</Text>
            <View style={styles.divider} />
            <Pressable
              onPress={() => router.push('/data-agreement')}
              style={styles.linkRow}
              accessibilityRole="button"
            >
              <FileText size={theme.iconSize.md} color={theme.colors.accent} />
              <Text style={styles.linkText}>Data Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          variant="danger"
          onPress={handleDiscard}
          disabled={isVerifying}
          flex1
        >
          Discard
        </AppButton>
        <AppButton onPress={handleSave} loading={isVerifying} flex1>
          Save
        </AppButton>
      </View>
    </View>
  )
}
