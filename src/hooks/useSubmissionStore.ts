/**
 * hooks/useSubmissionStore.ts
 * Persisted Zustand store for the in-progress submission draft, its
 * observed cats, and the history of previously submitted submissions.
 */

import { asyncStorage } from "@/src/lib/cache/storage";
import type { LocationMethod, TimeMethod } from "@/src/lib/cache/submissionCache";
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
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObservedCat {
  local_id: string;
  age: CatAge;
  ear_tipped: EarTipped;
  owned_domesticated: Owned;
  pattern: CatPattern;
  hair_length: HairLength;
  color: CatColor;
  sex: CatSex;
  health: HealthLevel;
  photo_local_ids: string[];
  photos_reviewed: boolean;
}

export interface SubmissionDraft {
  location_type: LocationMethod;
  time_type: TimeMethod;
  address?: string;
}

export interface SubmissionHistoryEntry extends SubmissionDraft {
  id: string;
  cats: ObservedCat[];
  photo_urls: string[];
  created_at: Date;
  submitted_at: Date;
  status: string;
}

interface SubmissionState {
  cats: ObservedCat[];
  submission: SubmissionDraft;
  history: SubmissionHistoryEntry[];
  currentStep: string;

  addCat: (cat: ObservedCat) => void;
  updateCat: (localId: string, patch: Partial<ObservedCat>) => void;
  setSubmission: (patch: Partial<SubmissionDraft>) => void;
  setLocationType: (v: LocationMethod) => void;
  setTimeType: (v: TimeMethod) => void;
  setAddress: (v: string) => void;
  saveDraft: () => void;
  setCurrentStep: (step: string) => void;
  addToHistory: (entry: SubmissionHistoryEntry) => void;
  clearDraft: () => void;
}

const DEFAULT_SUBMISSION: SubmissionDraft = {
  location_type: "device",
  time_type: "device",
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSubmissionStore = create<SubmissionState>()(
  persist(
    (set) => ({
      cats: [],
      submission: { ...DEFAULT_SUBMISSION },
      history: [],
      currentStep: "create",

      addCat: (cat) => set((s) => ({ cats: [...s.cats, cat] })),

      updateCat: (localId, patch) =>
        set((s) => ({
          cats: s.cats.map((c) =>
            c.local_id === localId ? { ...c, ...patch } : c,
          ),
        })),

      setSubmission: (patch) =>
        set((s) => ({ submission: { ...s.submission, ...patch } })),

      setLocationType: (v) =>
        set((s) => ({ submission: { ...s.submission, location_type: v } })),

      setTimeType: (v) =>
        set((s) => ({ submission: { ...s.submission, time_type: v } })),

      setAddress: (v) =>
        set((s) => ({ submission: { ...s.submission, address: v } })),

      // Draft fields already live in persisted state; nothing further to flush.
      saveDraft: () => {},

      setCurrentStep: (step) => set({ currentStep: step }),

      addToHistory: (entry) =>
        set((s) => ({ history: [...s.history, entry] })),

      clearDraft: () =>
        set({
          cats: [],
          submission: { ...DEFAULT_SUBMISSION },
          currentStep: "create",
        }),
    }),
    {
      name: "submission-store",
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
