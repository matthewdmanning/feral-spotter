/**
 * features/permissions/screens/intro-flow/index.tsx
 * First-run tutorial: four slides (T1–T4) introducing the app, then on to
 * /consent. Data-collection disclosure and device-permission priming happen
 * there, before sign-in — this screen is informational only.
 *
 * Copy: copy/introFlowCopy.json. Spec: tutorial_copy.md (2026-07-13).
 * Rule: never "tracking" in reference to people — cats only.
 */

import { confirmExitApp } from '@/src/shared/hooks/confirmExitApp'
import introFlowCopy from '@/src/features/permissions/copy/introFlowCopy.json'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useBackHandler } from '@/src/shared/hooks/useBackHandler'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { ScrollView, View } from 'react-native'
import { styles } from './index.styles'

const { slides, dataAgreementLinkLabel, exitWarningTitle, exitWarningBody } =
  introFlowCopy

/** Index of the data-usage slide (T3) — it links out to the full agreement. */
const AGREEMENT_SLIDE_INDEX = 2

export default function IntroFlowScreen() {
  const [step, setStep] = useState(0)

  const finish = useCallback(() => {
    router.replace('/consent')
  }, [])

  const advance = useCallback(() => {
    const next = step + 1
    if (next >= slides.length) {
      finish()
      return
    }
    setStep(next)
  }, [step, finish])

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1))
  }, [])

  // Slides are local state, not routes, and this screen is the only stack
  // entry: an unhandled Back exits the app. T1 asks first; T2-T4 step back
  // a slide.
  useBackHandler(
    useCallback(() => {
      if (step === 0) confirmExitApp(exitWarningTitle, exitWarningBody)
      else goBack()
      return true
    }, [step, goBack]),
  )

  const slide = slides[step]
  const isAgreementSlide = step === AGREEMENT_SLIDE_INDEX

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.slideContent}
      >
        <Text style={styles.header} accessibilityRole="header">
          {slide.header}
        </Text>
        {slide.body.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.body}>
            {paragraph}
          </Text>
        ))}
        {isAgreementSlide && (
          <TextButton
            accessibilityRole="link"
            onPress={() => router.push('/data-agreement')}
            underline
          >
            {dataAgreementLinkLabel}
          </TextButton>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <ButtonRow>
          <AppButton onPress={goBack} variant="secondary" disabled={step === 0}>
            Previous
          </AppButton>
          <AppButton onPress={advance}>{slide.button}</AppButton>
        </ButtonRow>
        <View style={styles.dots} accessibilityElementsHidden>
          {slides.map((s, i) => (
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
