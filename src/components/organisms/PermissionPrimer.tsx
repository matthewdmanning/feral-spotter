/**
 * components/organisms/PermissionPrimer.tsx
 * Reusable consent pre-warning screen shown immediately before an OS
 * permission prompt. Also exports the shared denied-state shell.
 *
 * Copy lives in config/onboardingCopy.ts — do not inline strings here.
 * The location primer body is a Play prominent disclosure; wording is
 * compliance-critical.
 */

import { PRIMERS, type PrimerKey } from "@/src/config/onboardingCopy";
import { AppButton } from "@/src/components/atoms/AppButton";
import { Camera, Images, MapPin, Settings } from "lucide-react-native";
import type { ReactNode } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { styles } from "./PermissionPrimer.styles";

// ─── Icon per primer ──────────────────────────────────────────────────────────

function PrimerIcon({ primer }: { primer: PrimerKey }): ReactNode {
  const { theme } = useUnistyles();
  const props = { size: 44, color: theme.colors.accent, strokeWidth: 1.75 };
  switch (primer) {
    case "location":
      return <MapPin {...props} />;
    case "camera":
      return <Camera {...props} />;
    case "photo_library":
      return <Images {...props} />;
    default:
      return null;
  }
}

// ─── Primer ───────────────────────────────────────────────────────────────────

interface PermissionPrimerProps {
  primer: PrimerKey;
  /** Fire the OS permission request; resolve true if granted. */
  onAffirm: () => void;
  /** "Maybe later" — record deferred and move on. */
  onDefer: () => void;
  affirmLoading?: boolean;
}

export function PermissionPrimer({
  primer,
  onAffirm,
  onDefer,
  affirmLoading = false,
}: PermissionPrimerProps) {
  const copy = PRIMERS[primer];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <PrimerIcon primer={primer} />
        </View>
        <Text style={styles.header} accessibilityRole="header">
          {copy.header}
        </Text>
        {copy.body.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.body}>
            {paragraph}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.buttons}>
        <AppButton onPress={onAffirm} loading={affirmLoading}>
          {copy.button}
        </AppButton>
        <AppButton onPress={onDefer} variant="ghost">
          {copy.deferButton}
        </AppButton>
      </View>
    </View>
  );
}

// ─── Denied state (shared shell, per-primer copy) ─────────────────────────────

interface PermissionDeniedProps {
  primer: PrimerKey;
  /** Optional escape hatch (e.g. back to home). */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function PermissionDenied({
  primer,
  onDismiss,
  dismissLabel = "Not now",
}: PermissionDeniedProps) {
  const { theme } = useUnistyles();
  const copy = PRIMERS[primer].denied;

  return (
    <View style={styles.root}>
      <View style={styles.deniedContent}>
        <View style={styles.iconWrap}>
          <Settings size={40} color={theme.colors.muted} strokeWidth={1.75} />
        </View>
        <Text style={styles.header} accessibilityRole="header">
          {copy.header}
        </Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>

      <View style={styles.buttons}>
        <AppButton onPress={() => void Linking.openSettings()}>
          Open Settings
        </AppButton>
        {onDismiss && (
          <AppButton onPress={onDismiss} variant="ghost">
            {dismissLabel}
          </AppButton>
        )}
      </View>
    </View>
  );
}
