import { SegmentedControl } from "@/src/components/atoms/SegmentedControl";
import {
  AUTOSAVE_CLEAR_MS,
  AUTOSAVE_INSTANT_MS,
  AUTOSAVE_TEXT_MS,
} from "@/src/config/constants";
import { useSubmissionStore } from "@/src/hooks";
import type {
  LocationMethod,
  TimeMethod,
} from "@/src/lib/cache/submissionCache";
import {
  createSubmissionCache,
  getCurrentCacheId,
  updateSubmissionCache,
} from "@/src/lib/cache/submissionCache";
import { validateSubmission } from "@/src/utils/validation";
import { router } from "expo-router";
import { nanoid } from "nanoid";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { styles } from "./index.styles";

const LOCATION_OPTIONS: { value: LocationMethod; label: string }[] = [
  { value: "device", label: "Device" },
  { value: "pin", label: "Pin Drop" },
  { value: "address", label: "Address" },
];
const TIME_OPTIONS: { value: TimeMethod; label: string }[] = [
  { value: "device", label: "Device" },
  { value: "manual", label: "Manual" },
  { value: "metadata", label: "From Photo" },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function CreateSubmissionScreen() {
  const { theme } = useUnistyles();

  const submission = useSubmissionStore((s) => s.submission);
  const setSubmission = useSubmissionStore((s) => s.setSubmission);
  const setLocationType = useSubmissionStore((s) => s.setLocationType);
  const setTimeType = useSubmissionStore((s) => s.setTimeType);
  const setAddress = useSubmissionStore((s) => s.setAddress);
  const saveDraft = useSubmissionStore((s) => s.saveDraft);
  const setCurrentStep = useSubmissionStore((s) => s.setCurrentStep);
  const cats = useSubmissionStore((s) => s.cats);

  const [locationType, setLocationTypeLocal] = useState<LocationMethod>(
    submission.location_type,
  );
  const [timeType, setTimeTypeLocal] = useState<TimeMethod>(
    submission.time_type,
  );
  const [address, setAddressLocal] = useState(submission.address ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isDirtyRef = useRef(false);
  const formRef = useRef({ locationType, timeType, address });
  useEffect(() => {
    formRef.current = { locationType, timeType, address };
  });

  useEffect(() => {
    setCurrentStep("create");
    (async () => {
      if (!(await getCurrentCacheId())) {
        await createSubmissionCache(nanoid(), {
          location_method: submission.location_type,
          time_method: submission.time_type,
          address: submission.address,
        });
      }
    })();
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    setCurrentStep,
    submission.address,
    submission.location_type,
    submission.time_type,
  ]);

  const performSave = useCallback(async () => {
    const { locationType: lt, timeType: tt, address: addr } = formRef.current;
    isDirtyRef.current = false;
    if (isMountedRef.current) startTransition(() => setSaveStatus("saving"));
    try {
      setSubmission({
        location_type: lt,
        time_type: tt,
        address: addr || undefined,
      });
      await Promise.resolve(saveDraft());
      const cId = await getCurrentCacheId();
      if (cId)
        await updateSubmissionCache(cId, {
          metadata: {
            location_method: lt,
            time_method: tt,
            address: addr || undefined,
          },
        });
      if (!isMountedRef.current) return;
      startTransition(() => setSaveStatus("saved"));
      setTimeout(() => {
        if (isMountedRef.current) startTransition(() => setSaveStatus("idle"));
      }, AUTOSAVE_CLEAR_MS);
    } catch {
      if (isMountedRef.current) startTransition(() => setSaveStatus("error"));
    }
  }, [setSubmission, saveDraft]);

  const scheduleAutosave = useCallback(
    (ms: number) => {
      isDirtyRef.current = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(performSave, ms);
    },
    [performSave],
  );

  const handleLocationTypeChange = useCallback(
    (v: LocationMethod) => {
      setLocationTypeLocal(v);
      setLocationType(v);
      scheduleAutosave(AUTOSAVE_INSTANT_MS);
    },
    [setLocationType, scheduleAutosave],
  );
  const handleTimeTypeChange = useCallback(
    (v: TimeMethod) => {
      setTimeTypeLocal(v);
      setTimeType(v);
      scheduleAutosave(AUTOSAVE_INSTANT_MS);
    },
    [setTimeType, scheduleAutosave],
  );
  const handleAddressChange = useCallback(
    (v: string) => {
      setAddressLocal(v);
      setAddress(v);
      scheduleAutosave(AUTOSAVE_TEXT_MS);
    },
    [setAddress, scheduleAutosave],
  );
  const handleAddressBlur = useCallback(() => {
    if (!isDirtyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    performSave();
  }, [performSave]);

  const handleContinue = useCallback(async () => {
    const errors = validateSubmission({
      location_type: locationType,
      time_type: timeType,
      address,
    });
    if (errors.length > 0) {
      Alert.alert(errors[0].message);
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await performSave();
    router.push("/submission/cats");
  }, [locationType, timeType, address, performSave]);

  const saveIndicatorText =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "✓ Saved"
        : saveStatus === "error"
          ? "Save failed"
          : "";

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Submission</Text>
      <View style={styles.card}>
        <SegmentedControl
          label="Location Type"
          options={LOCATION_OPTIONS}
          value={locationType}
          onChange={handleLocationTypeChange}
        />
        <SegmentedControl
          label="Time Type"
          options={TIME_OPTIONS}
          value={timeType}
          onChange={handleTimeTypeChange}
        />
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Address (Optional)</Text>
          <TextInput
            placeholder="Enter address"
            placeholderTextColor={theme.colors.muted}
            value={address}
            onChangeText={handleAddressChange}
            onBlur={handleAddressBlur}
            style={styles.input}
          />
        </View>
        <View style={styles.footerGroup}>
          {saveIndicatorText !== "" && (
            <Text style={styles.saveIndicator}>{saveIndicatorText}</Text>
          )}
          <Pressable
            onPress={handleContinue}
            disabled={!locationType || !timeType}
            style={styles.continueBtn}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>

      {cats.length > 0 && (
        <View style={styles.catList}>
          <Text style={styles.catListTitle}>Cats Recorded</Text>
          {cats.map((cat) => (
            <Pressable
              key={cat.local_id}
              onPress={() =>
                router.push({
                  pathname: "/submission/cats",
                  params: { edit: cat.local_id },
                })
              }
              style={styles.catRow}
            >
              <Text style={styles.catRowText}>
                {cat.age.charAt(0).toUpperCase() + cat.age.slice(1)} ·{" "}
                {cat.pattern} · {cat.hair_length} hair
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
