import { useSettingsDraft } from '@/src/hooks/useSettingsDraft'
import { Check, Key, Trash2 } from 'lucide-react-native'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { useUnistyles, withUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

// trackColor/thumbColor are component props, not style props —
// withUnistyles is the documented pattern for mapping theme to such props.
const UniSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: { false: theme.colors.border, true: theme.colors.accent },
  thumbColor: theme.colors.text,
}))

const PHOTO_TOGGLES = [
  { key: 'delete_unused_photos', label: 'Delete Unused Photos', desc: 'Remove unchecked session photos after submission' },
  { key: 'delete_all_photos', label: 'Delete All Photos', desc: 'Remove all session photos after submission' },
  { key: 'keep_photos_on_device', label: 'Keep Photos on Device', desc: 'Save captured photos to your camera roll' },
] as const

export default function SettingsScreen() {
  const { theme } = useUnistyles()
  const { draft, patch, passwordConfigured, newPassword, confirmPassword, isVerifying,
    setNewPassword, setConfirmPassword, handleSave, handleDiscard,
    handleClearCache, handleRemovePassword } = useSettingsDraft()

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Configure authentication and storage</Text>
          </View>

          {/* Auth */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Authentication</Text>
            {passwordConfigured ? (
              <View style={styles.gap}>
                <View style={styles.configuredRow}>
                  <Check size={18} color={theme.colors.accentText} />
                  <Text style={styles.configuredText}>Password configured</Text>
                </View>
                <Pressable onPress={handleRemovePassword} style={styles.linkRow} accessibilityRole="button">
                  <Key size={16} color={theme.colors.danger} />
                  <Text style={[styles.linkText, { color: theme.colors.danger }]}>Remove Password</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.gap}>
                <Text style={styles.hint}>Required to submit observations</Text>
                {(['Password', 'Confirm Password'] as const).map((lbl, i) => (
                  <View key={lbl} style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{lbl}</Text>
                    <TextInput secureTextEntry placeholder={lbl} placeholderTextColor={theme.colors.muted}
                      value={i === 0 ? newPassword : confirmPassword}
                      onChangeText={i === 0 ? setNewPassword : setConfirmPassword}
                      autoCapitalize="none" style={styles.input} />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Cache */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cache</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Keep cache for (days)</Text>
              <TextInput keyboardType="numeric" placeholderTextColor={theme.colors.muted}
                value={String(draft.cache_ttl_days)}
                onChangeText={(v) => patch('cache_ttl_days', Math.max(1, parseInt(v) || 1))}
                style={styles.input} />
            </View>
            <View style={styles.divider} />
            <Pressable onPress={handleClearCache} style={styles.linkRow} accessibilityRole="button">
              <Trash2 size={16} color={theme.colors.danger} />
              <Text style={[styles.linkText, { color: theme.colors.danger }]}>Clear Cache</Text>
            </Pressable>
            <Text style={styles.hint}>Removes expired and all cached submissions. Does not delete photos.</Text>
          </View>

          {/* Photos */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photos</Text>
            {PHOTO_TOGGLES.map(({ key, label, desc }, i) => (
              <View key={key}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextGroup}>
                    <Text style={styles.toggleLabel}>{label}</Text>
                    <Text style={styles.hint}>{desc}</Text>
                  </View>
                  <UniSwitch
                    value={key === 'keep_photos_on_device' ? draft[key] !== false : Boolean(draft[key])}
                    onValueChange={(v) => patch(key, v)}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* App info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>FeralSpotter</Text>
            <Text style={styles.subtitle}>Version 1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleDiscard} disabled={isVerifying} style={[styles.footerBtn, styles.footerBtnSecondary]}>
          <Text style={styles.footerBtnSecondaryText}>Discard</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={isVerifying} style={[styles.footerBtn, styles.footerBtnPrimary]}>
          <Text style={styles.footerBtnPrimaryText}>{isVerifying ? 'Verifying...' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

