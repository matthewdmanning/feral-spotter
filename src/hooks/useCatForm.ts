/**
 * hooks/useCatForm.ts
 * Manages the 8 cat observation fields + photo IDs.
 * No store, API, or navigation dependencies — pure form state.
 */

import type { ObservedCat } from "@/src/hooks/useSubmissionStore";
import { CAT_DEFAULTS } from "@/src/screens/submission/cats/constants";
import type {
  CatAge,
  CatColor,
  CatPattern,
  CatSex,
  EarTipped,
  HairLength,
  HealthLevel,
  Owned,
} from "@/src/types";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatFormValues {
  age: CatAge;
  earTipped: EarTipped;
  owned: Owned;
  pattern: CatPattern;
  hairLength: HairLength;
  color: CatColor;
  sex: CatSex;
  health: HealthLevel;
  photoIds: string[];
}

export interface CatFormActions {
  setAge: (v: CatAge) => void;
  setEarTipped: (v: EarTipped) => void;
  setOwned: (v: Owned) => void;
  setPattern: (v: CatPattern) => void;
  setHairLength: (v: HairLength) => void;
  setColor: (v: CatColor) => void;
  setSex: (v: CatSex) => void;
  setHealth: (v: HealthLevel) => void;
  handleTogglePhoto: (photoId: string) => void;
  handleClear: () => void; // shows confirmation Alert, then resets
}

export type CatForm = CatFormValues & CatFormActions;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCatForm(existingCat?: ObservedCat): CatForm {
  const [age, setAge] = useState<CatAge>(
    (existingCat?.age as CatAge) ?? CAT_DEFAULTS.age,
  );
  const [earTipped, setEarTipped] = useState<EarTipped>(
    (existingCat?.ear_tipped as EarTipped) ?? CAT_DEFAULTS.earTipped,
  );
  const [owned, setOwned] = useState<Owned>(
    (existingCat?.owned_domesticated as Owned) ?? CAT_DEFAULTS.owned,
  );
  const [pattern, setPattern] = useState<CatPattern>(
    (existingCat?.pattern as CatPattern) ?? CAT_DEFAULTS.pattern,
  );
  const [hairLength, setHairLength] = useState<HairLength>(
    (existingCat?.hair_length as HairLength) ?? CAT_DEFAULTS.hairLength,
  );
  const [color, setColor] = useState<CatColor>(
    (existingCat?.color as CatColor) ?? CAT_DEFAULTS.color,
  );
  const [sex, setSex] = useState<CatSex>(
    (existingCat?.sex as CatSex) ?? CAT_DEFAULTS.sex,
  );
  const [health, setHealth] = useState<HealthLevel>(
    (existingCat?.health as HealthLevel) ?? CAT_DEFAULTS.health,
  );
  const [photoIds, setPhotoIds] = useState<string[]>(
    existingCat?.photo_local_ids ?? [],
  );

  const handleTogglePhoto = useCallback((photoId: string) => {
    setPhotoIds((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId],
    );
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert(
      "Clear form?",
      "All fields will be reset to defaults. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setAge(CAT_DEFAULTS.age);
            setEarTipped(CAT_DEFAULTS.earTipped);
            setOwned(CAT_DEFAULTS.owned);
            setPattern(CAT_DEFAULTS.pattern);
            setHairLength(CAT_DEFAULTS.hairLength);
            setColor(CAT_DEFAULTS.color);
            setSex(CAT_DEFAULTS.sex);
            setHealth(CAT_DEFAULTS.health);
            setPhotoIds([]);
          },
        },
      ],
    );
  }, []);

  return {
    age,
    earTipped,
    owned,
    pattern,
    hairLength,
    color,
    sex,
    health,
    photoIds,
    setAge,
    setEarTipped,
    setOwned,
    setPattern,
    setHairLength,
    setColor,
    setSex,
    setHealth,
    handleTogglePhoto,
    handleClear,
  };
}
