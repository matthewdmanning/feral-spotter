import {
  getThemeMode,
  setThemeMode,
  type ThemeMode,
} from '@/src/config/unistyles'
import { SegmentedControl } from '@/src/components/atoms/SegmentedControl'
import { useSettingsDraft } from '@/src/hooks/useSettingsDraft'
import { router } from 'expo-router'
import { Check, FileText, Key, Trash2 } from 'lucide-react-native'
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
    platform: 'android',
  },
  {
    key: 'ios_improved_camera_capture',
    label: 'Improved iPhone Capture',
    desc: 'Use the optimized VisionCamera + AVFoundation fallback on iOS',
    platform: 'ios',
  },
  {
    key: 'native_camera_capture',
    label: 'Native Camera Capture',
    desc: 'Use AVFoundation on iOS or CameraX on Android; the VisionCamera path remains available',
    platform: null,
  },
  {
    key: 'camera_max_detail',
    label: 'Maximum Detail',
    desc: 'Prefer the highest still-photo resolution exposed by the native camera',
    platform: null,
  },
  {
    key: 'camera_motion_priority',
    label: 'Motion Priority',
    desc: 'Favor device-supported low-latency capture and shorter exposure behavior',
    platform: null,
  },
  {
    key: 'camera_disable_low_light_boost',
    label: 'Disable Low-Light Boost',
    desc: 'Avoid platform low-light modes that may trade motion detail for brightness',
    platform: null,
  },
  {
    key: 'camera_subject_metering',
    label: 'Subject Metering',
    desc: 'Allow a bounding-box localizer to steer native focus and exposure',
    platform: null,
  },
  {
    key: 'camera_pinch_zoom',
    label: 'Pinch to Zoom',
    desc: 'Allow pinch to zoom the camera preview; a zoomed capture is a cropped capture',
    platform: null,
  },
  {
    key: 'camera_performance_checks',
    label: 'Camera Performance Checks',
    desc: 'Attach comparable camera timing data to PostHog events for A/B testing',
    platform: null,
  },
] as const

const ENABLED_BY_DEFAULT = new Set([
  'keep_photos_on_device',
  'camera_max_detail',
  'camera_motion_priority',
])

export default function SettingsScreen() {
  const { theme } = useUnistyles()
  const [themeMode, setSelectedThemeMode] = useState<ThemeMode>(getThemeMode)
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
    handleClearDraft,
    handleRemovePassword,
  } = useSettingsDraft()

  const photoToggles = PHOTO_TOGGLES.filter(
    ({ platform }) => platform === null || platform === Platform.OS,
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
            <Text style={styles.cardTitle}>Authentication</Text>
            {passwordConfigured ? (
              <View style={styles.gap}>
                <View style={styles.configuredRow}>
                  <Check size={18} color={theme.colors.accentText} />
                  <Text style={styles.configuredText}>Password configured</Text>
                </View>
                <Pressable
                  onPress={handleRemovePassword}
                  style={styles.linkRow}
                  accessibilityRole="button"
                >
                  <Key size={16} color={theme.colors.danger} />
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
            <Text style={styles.cardTitle}>Draft</Text>
            <Pressable
              onPress={handleClearDraft}
              style={styles.linkRow}
              accessibilityRole="button"
            >
              <Trash2 size={16} color={theme.colors.danger} />
              <Text style={[styles.linkText, { color: theme.colors.danger }]}>
                Clear Draft
              </Text>
            </Pressable>
            <Text style={styles.hint}>
              Clears the in-progress submission — cats, photos and location —
              and returns you to the home screen. Photos saved to this device
              are not deleted.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photos</Text>
            {photoToggles.map(({ key, label, desc }, i) => {
              const value = draft[key]
              const on =
                value === undefined ? ENABLED_BY_DEFAULT.has(key) : value
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
            <Text style={styles.subtitle}>Version 1.0.0</Text>
            <View style={styles.divider} />
            <Pressable
              onPress={() => router.push('/data-agreement')}
              style={styles.linkRow}
              accessibilityRole="button"
            >
              <FileText size={16} color={theme.colors.accent} />
              <Text style={styles.linkText}>Data Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleDiscard}
          disabled={isVerifying}
          style={[styles.footerBtn, styles.footerBtnSecondary]}
        >
          <Text style={styles.footerBtnSecondaryText}>Discard</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={isVerifying}
          style={[styles.footerBtn, styles.footerBtnPrimary]}
        >
          <Text style={styles.footerBtnPrimaryText}>
            {isVerifying ? 'Verifying...' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
