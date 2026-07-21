/**
 * screens/onboarding/index.tsx
 * First-run flow: tutorial slides (T1–T4) → consent primer sequence
 * (location → camera → photo library) → home.
 *
 * - T3 (data usage agreement) has no skip; acceptance is timestamped.
 * - Each primer fires its OS prompt on affirm, records the outcome, and
 *   advances. "Maybe later" records `deferred` and advances — deferred
 *   permissions are re-primed contextually at point of use.
 * - All primers in PRIMER_SEQUENCE are shown unconditionally; there is no
 *   pre-check that skips a primer whose OS permission is already granted.
 */

import {
  AGREEMENT_SLIDE_INDEX,
  DATA_AGREEMENT_LINK_LABEL,
  PRIMER_SEQUENCE,
  TUTORIAL_SLIDES,
} from "@/src/config/onboardingCopy";
import { AppButton } from "@/src/components/atoms/AppButton";
import { PermissionPrimer } from "@/src/components/organisms/PermissionPrimer";
import { useConsentStore } from "@/src/hooks/useConsentStore";
import { requestPermission } from "@/src/lib/permissions";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "./index.styles";

// ─── Steps: 4 tutorial slides, then N primers ────────────────────────────────

const TOTAL_STEPS = TUTORIAL_SLIDES.length + PRIMER_SEQUENCE.length;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const { acceptDataAgreement, setPrimerStatus, completeOnboarding } =
    useConsentStore();

  const finish = useCallback(() => {
    completeOnboarding();
    router.replace("/");
  }, [completeOnboarding]);

  const advance = useCallback(() => {
    setStep((s) => {
      const next = s + 1;
      if (next >= TOTAL_STEPS) {
        finish();
        return s;
      }
      return next;
    });
  }, [finish]);

  // ── Tutorial slides (steps 0–3) ────────────────────────────────────────────
  if (step < TUTORIAL_SLIDES.length) {
    const slide = TUTORIAL_SLIDES[step];
    const isAgreement = step === AGREEMENT_SLIDE_INDEX;

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
          {isAgreement && (
            <Pressable
              accessibilityRole="link"
              // Route not built yet — see issue #37. Cast until it lands.
              onPress={() => router.push("/data-agreement" as never)}
            >
              <Text style={styles.link}>{DATA_AGREEMENT_LINK_LABEL}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.footer}>
          <AppButton
            onPress={() => {
              if (isAgreement) acceptDataAgreement();
              advance();
            }}
          >
            {slide.button}
          </AppButton>
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

  // ── Primer sequence (steps 4+) ─────────────────────────────────────────────
  const primer = PRIMER_SEQUENCE[step - TUTORIAL_SLIDES.length];

  return (
    <PermissionPrimer
      primer={primer}
      affirmLoading={requesting}
      onAffirm={() => {
        void (async () => {
          setRequesting(true);
          try {
            const granted = await requestPermission(primer);
            setPrimerStatus(primer, granted ? "granted" : "declined");
          } finally {
            setRequesting(false);
            advance();
          }
        })();
      }}
      onDefer={() => {
        setPrimerStatus(primer, "deferred");
        advance();
      }}
    />
  );
}
