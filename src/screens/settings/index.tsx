import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import {
  getThemeMode,
  setThemeMode,
  type ThemeMode,
} from '@/src/shared/config/unistyles'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { SegmentedControl } from '@/src/shared/ui/atoms/SegmentedControl'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { ToggleRow } from '@/src/shared/ui/molecules/ToggleRow'
import { visiblePhotoToggles } from '@/src/features/settings/config/photoToggles'
import {
  getHapticsEnabled,
  selectionHaptic,
  setHapticsEnabled,
} from '@/src/shared/lib/haptics'
import { saveEmailOptIn } from '@/src/features/permissions/communications/hooks/saveEmailOptIn'
import { useChangeEmail } from '@/src/features/auth/hooks/useChangeEmail'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useSettingsDraft } from '@/src/hooks/useSettingsDraft'
import { APP_VERSION, FEATURE_FLAGS } from '@/src/shared/config/constants'
import { router } from 'expo-router'
import { CheckIcon } from 'phosphor-react-native/src/icons/Check'
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText'
import { KeyIcon } from 'phosphor-react-native/src/icons/Key'
import { Fragment, useState } from 'react'
import { Platform, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const VISIBLE_TOGGLES = visiblePhotoToggles(FEATURE_FLAGS, Platform.OS)
const PHOTO_TOGGLES = VISIBLE_TOGGLES.filter((toggle) => !toggle.flag)
const DEVELOPER_TOGGLES = VISIBLE_TOGGLES.filter((toggle) => toggle.flag)

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
  // Email updates are an opt-in kept in the consent store; like the theme and
  // haptics, a change applies at once rather than waiting for Save.
  const emailOptIn = useConsentStore((s) => s.emailOptIn === true)
  const accountEmail = useAuthStore((s) => s.user?.email)
  const changeEmail = useChangeEmail()
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

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>
              Configure appearance, authentication and storage
            </Text>
          </View>

          <GlassSurface kind="card" style={styles.card}>
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
          </GlassSurface>

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>Haptic Feedback</Text>
            <ToggleRow
              label="Vibration on Touch"
              hint="A light click when you press a button or switch tabs"
              value={hapticsOn}
              onValueChange={toggleHaptics}
            />
          </GlassSurface>

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>Communications</Text>
            <ToggleRow
              label="Email Updates"
              hint="News and project updates, sent to the email address on your account"
              value={emailOptIn}
              onValueChange={saveEmailOptIn}
            />
            <View style={styles.divider} />
            <Text style={styles.hint}>
              Your email: {accountEmail ?? 'not available'}
            </Text>
            <TextField
              label="New email"
              placeholder="New email"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              value={changeEmail.newEmail}
              onChangeText={changeEmail.setNewEmail}
            />
            <TextButton
              onPress={changeEmail.submit}
              disabled={changeEmail.busy || !changeEmail.newEmail.trim()}
            >
              Send verification link
            </TextButton>
          </GlassSurface>

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>Authentication</Text>
            {passwordConfigured ? (
              <View style={styles.gap}>
                <View style={styles.configuredRow}>
                  <CheckIcon
                    size={theme.iconSize.md}
                    color={theme.colors.accentSoftText}
                  />
                  <Text style={styles.configuredText}>Password configured</Text>
                </View>
                <TextButton
                  onPress={handleRemovePassword}
                  tone="danger"
                  icon={
                    <KeyIcon
                      size={theme.iconSize.md}
                      color={theme.colors.danger}
                    />
                  }
                >
                  Remove Password
                </TextButton>
              </View>
            ) : (
              <View style={styles.gap}>
                <Text style={styles.hint}>Required to submit observations</Text>
                <TextField
                  label="Password"
                  placeholder="Password"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TextField
                  label="Confirm Password"
                  placeholder="Confirm Password"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            )}
          </GlassSurface>

          {[
            { title: 'Photos', toggles: PHOTO_TOGGLES },
            { title: 'Developer Mode', toggles: DEVELOPER_TOGGLES },
          ].map(
            ({ title, toggles }) =>
              toggles.length > 0 && (
                <GlassSurface kind="card" key={title} style={styles.card}>
                  <Text style={styles.cardTitle}>{title}</Text>
                  {/* Fragment, not a View: the divider must be a direct child
                      of the card so the card gap spaces it evenly above and
                      below. A wrapper View put the gap on one side only. */}
                  {toggles.map(({ key, label, desc }, i) => (
                    <Fragment key={key}>
                      {i > 0 && <View style={styles.divider} />}
                      <ToggleRow
                        label={label}
                        hint={desc}
                        value={draft[key]}
                        onValueChange={(value) => patch(key, value)}
                      />
                    </Fragment>
                  ))}
                </GlassSurface>
              ),
          )}

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>FeralSpotter</Text>
            <Text style={styles.subtitle}>Version {APP_VERSION}</Text>
            <View style={styles.divider} />
            <TextButton
              onPress={() => router.push('/data-agreement')}
              accessibilityRole="link"
              icon={
                <FileTextIcon
                  size={theme.iconSize.md}
                  color={theme.colors.accent}
                />
              }
            >
              Data Policy
            </TextButton>
          </GlassSurface>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ButtonRow>
          <AppButton
            variant="danger"
            onPress={handleDiscard}
            disabled={isVerifying}
          >
            Discard
          </AppButton>
          <AppButton onPress={handleSave} loading={isVerifying}>
            Save
          </AppButton>
        </ButtonRow>
      </View>
    </View>
  )
}
