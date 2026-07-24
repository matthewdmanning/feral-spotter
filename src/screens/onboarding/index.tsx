/**
 * screens/onboarding/index.tsx
 * First-run tutorial: four slides (T1–T4) introducing the app, then on to
 * /register. Permission priming and data-collection consent are handled
 * downstream by /register → /consent — this screen is informational only.
 */

import {
  AGREEMENT_SLIDE_INDEX,
  DATA_AGREEMENT_LINK_LABEL,
  TUTORIAL_SLIDES,
} from "@/src/config/onboardingCopy";
import { AppButton } from "@/src/components/atoms/AppButton";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "./index.styles";

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    router.replace("/register");
  }, []);

  const advance = useCallback(() => {
    setStep((s) => {
      const next = s + 1;
      if (next >= TUTORIAL_SLIDES.length) {
        finish();
        return s;
      }
      return next;
    });
  }, [finish]);

  const slide = TUTORIAL_SLIDES[step];
  const isAgreementSlide = step === AGREEMENT_SLIDE_INDEX;

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
            onPress={() => router.push("/data-agreement")}
          >
            <Text style={styles.link}>{DATA_AGREEMENT_LINK_LABEL}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.footer}>
        <AppButton onPress={advance}>{slide.button}</AppButton>
        <View style={styles.dots} accessibilityElementsHidden>
          {TUTORIAL_SLIDES.map((s, i) => (
            <View
              key={s.header}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
