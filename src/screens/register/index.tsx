import { useState, useCallback } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

interface FormState {
  email:     string
  city:      string
  state:     string
  firstName: string
  lastName:  string
}

interface FormErrors {
  email?: string
  city?:  string
  state?: string
}

function validate(f: FormState): FormErrors {
  const e: FormErrors = {}
  if (!f.email.trim())                        e.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email'
  if (!f.city.trim())  e.city  = 'City is required'
  if (!f.state.trim()) e.state = 'State is required'
  return e
}

async function registerUser(form: FormState): Promise<void> {
  // Placeholder — replace with real API call
  console.log('[register] payload:', form)
  await new Promise((r) => setTimeout(r, 800))
}

export default function RegisterScreen() {
  const { theme } = useUnistyles()

  const [form, setForm] = useState<FormState>({ email: '', city: '', state: '', firstName: '', lastName: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy,   setBusy]   = useState(false)

  const patch = useCallback((key: keyof FormState, val: string) => {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }, [])

  const handleSubmit = useCallback(async () => {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setBusy(true)
    try {
      await registerUser(form)
      router.replace('/(home-tabs)/')
    } catch (err) {
      console.error('[register] failed:', err)
    } finally {
      setBusy(false)
    }
  }, [form])

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Register to submit cat observations.</Text>

        {/* Required */}
        <Text style={styles.section}>Required</Text>

        <TextInput
          placeholder="Email" placeholderTextColor={theme.colors.muted}
          value={form.email} onChangeText={(v) => patch('email', v)}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          style={[styles.field, errors.email && styles.fieldError]}
          accessibilityLabel="Email"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

        <TextInput
          placeholder="City" placeholderTextColor={theme.colors.muted}
          value={form.city} onChangeText={(v) => patch('city', v)}
          style={[styles.field, errors.city && styles.fieldError]}
          accessibilityLabel="City"
        />
        {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}

        <TextInput
          placeholder="State" placeholderTextColor={theme.colors.muted}
          value={form.state} onChangeText={(v) => patch('state', v)}
          style={[styles.field, errors.state && styles.fieldError]}
          accessibilityLabel="State"
        />
        {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}

        {/* Optional */}
        <Text style={styles.section}>Optional</Text>

        <TextInput
          placeholder="First Name" placeholderTextColor={theme.colors.muted}
          value={form.firstName} onChangeText={(v) => patch('firstName', v)}
          autoComplete="name-given"
          style={styles.field} accessibilityLabel="First Name"
        />
        <TextInput
          placeholder="Last Name" placeholderTextColor={theme.colors.muted}
          value={form.lastName} onChangeText={(v) => patch('lastName', v)}
          autoComplete="name-family"
          style={styles.field} accessibilityLabel="Last Name"
        />

        <Pressable
          onPress={handleSubmit} disabled={busy}
          style={[styles.submitBtn, busy && styles.submitBusy]}
          accessibilityRole="button" accessibilityLabel="Submit registration"
        >
          {busy
            ? <ActivityIndicator color={theme.colors.accentText} />
            : <Text style={styles.submitText}>Submit</Text>
          }
        </Pressable>
      </ScrollView>
    </View>
  )
}
