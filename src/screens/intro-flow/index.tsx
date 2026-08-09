/**
 * screens/intro-flow/index.tsx
 * First-run tutorial: four slides (T1–T4) introducing the app, then on to
 * /consent. Data-collection disclosure and device-permission priming happen
 * there, before sign-in — this screen is informational only.
 */

import {
  AGREEMENT_SLIDE_INDEX,
  DATA_AGREEMENT_LINK_LABEL,
  EXIT_WARNING_BODY,
  EXIT_WARNING_TITLE,
  ONBOARDING_SLIDES,
} from '@/src/config/introFlowCopy'
import { AppButton } from '@/src/components/atoms/AppButton'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import { styles } from './index.styles'

export default function IntroFlowScreen() {
  const [step, setStep] = useState(0)

  // T1 has no route to pop to — hardware back would otherwise fall through
  // to native stack pop and exit past the first screen unconfirmed. T2-T4
  // are left to their default pop (returns to the previous slide), matching
  // the rest of this flow's unhandled-back behavior.
  useBackHandler(
    useCallback(() => {
      if (step !== 0) return false
      Alert.alert(EXIT_WARNING_TITLE, EXIT_WARNING_BODY, [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS === 'android') BackHandler.exitApp()
          },
        },
      ])
      return true
    }, [step]),
  )

  const finish = useCallback(() => {
    router.replace('/consent')
  }, [])

  const advance = useCallback(() => {
    const next = step + 1
    if (next >= ONBOARDING_SLIDES.length) {
      finish()
      return
    }
    setStep(next)
  }, [step, finish])

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1))
  }, [])

  const slide = ONBOARDING_SLIDES[step]
  const isAgreementSlide = step === AGREEMENT_SLIDE_INDEX

  return (
    <View style={styles.root}>
      <View style={styles.slideContent}>
        <Text style={styles.header} accessibilityRole="header">
          {slide.header}
        </Text>
        {slide.body.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.body}>
            {paragraph}
          </Text>
        ))}
        {isAgreementSlide && (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/data-agreement')}
          >
            <Text style={styles.link}>{DATA_AGREEMENT_LINK_LABEL}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <AppButton
            onPress={goBack}
            variant="secondary"
            disabled={step === 0}
            flex1
          >
            Previous
          </AppButton>
          <AppButton onPress={advance} flex1>
            {slide.button}
          </AppButton>
        </View>
        <View style={styles.dots} accessibilityElementsHidden>
          {ONBOARDING_SLIDES.map((s, i) => (
            <View
              key={s.header}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>
      </View>
    </View>
  )
}
