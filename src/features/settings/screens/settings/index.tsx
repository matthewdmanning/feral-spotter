import { settingsCopy } from '@/src/features/settings/copy/settingsCopy'
import {
  authCopy,
  commonCopy,
  formatCopy,
  navigationCopy,
} from '@/src/shared/config/text'
import { SharingSettings } from '@/src/features/organizations/components/SharingSettings'
import { OrganizationPermissions } from '@/src/features/organizations/components/OrganizationPermissions'
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
import { saveEmailOptIn } from '@/src/features/permissions/hooks/saveEmailOptIn'
import { useChangeEmail } from '@/src/features/auth/hooks/useChangeEmail'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useSettingsDraft } from '@/src/features/settings/hooks/useSettingsDraft'
import { APP_VERSION, FEATURE_FLAGS } from '@/src/shared/config/constants'
import { router } from 'expo-router'
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText'
import { Fragment, useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: settingsCopy.themeSystem },
  { value: 'light', label: settingsCopy.themeLight },
  { value: 'dark', label: settingsCopy.themeDark },
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
  const { draft, patch, handleSave, handleDiscard } = useSettingsDraft()

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AmbientBackground />
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>{navigationCopy.settings}</Text>
            <Text style={styles.subtitle}>{settingsCopy.screenSubtitle}</Text>
          </View>

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>{settingsCopy.appearance}</Text>
            <SegmentedControl
              label={settingsCopy.theme}
              options={THEME_OPTIONS}
              value={themeMode}
              required
              onChange={(next) => {
                if (!next) return // never: required
                setThemeMode(next)
                setSelectedThemeMode(next)
              }}
              accessibilityLabel={settingsCopy.theme}
            />
            <Text style={styles.hint}>{settingsCopy.systemAppearanceHint}</Text>
          </GlassSurface>

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>{settingsCopy.hapticFeedback}</Text>
            <ToggleRow
              label={settingsCopy.vibrationOnTouch}
              hint={settingsCopy.hapticHint}
              value={hapticsOn}
              onValueChange={toggleHaptics}
            />
          </GlassSurface>

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>{settingsCopy.communications}</Text>
            <ToggleRow
              label={settingsCopy.emailUpdates}
              hint={settingsCopy.emailUpdatesHint}
              value={emailOptIn}
              onValueChange={saveEmailOptIn}
            />
            <View style={styles.divider} />
            <Text style={styles.hint}>
              {formatCopy(settingsCopy.yourEmailTemplate, {
                email: accountEmail ?? commonCopy.notAvailable,
              })}
            </Text>
            <TextField
              label={settingsCopy.newEmail}
              placeholder={settingsCopy.newEmail}
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
              {authCopy.sendVerificationLink}
            </TextButton>
          </GlassSurface>

          <SharingSettings />
          <OrganizationPermissions />

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>{settingsCopy.photos}</Text>
            {[
              { title: settingsCopy.photos, toggles: PHOTO_TOGGLES },
              { title: settingsCopy.developer, toggles: DEVELOPER_TOGGLES },
            ].map(
              ({ title, toggles }) =>
                toggles.length > 0 && (
                  <View key={title} style={styles.toggleGroup}>
                    {title === settingsCopy.developer && (
                      <Text style={styles.groupTitle}>{title}</Text>
                    )}
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
                  </View>
                ),
            )}
            <ButtonRow>
              <AppButton variant="secondary" onPress={handleDiscard}>
                {settingsCopy.discardPhotos}
              </AppButton>
              <AppButton onPress={handleSave}>
                {settingsCopy.savePhotos}
              </AppButton>
            </ButtonRow>
          </GlassSurface>

          <GlassSurface kind="card" style={styles.card}>
            <Text style={styles.cardTitle}>{commonCopy.brand}</Text>
            <Text style={styles.subtitle}>
              {formatCopy(settingsCopy.versionTemplate, {
                version: APP_VERSION,
              })}
            </Text>
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
              {settingsCopy.dataPolicy}
            </TextButton>
          </GlassSurface>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
