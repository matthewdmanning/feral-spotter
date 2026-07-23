/**
 * lib/consent.ts
 * Tracks whether the user has accepted the data-collection consent disclosure.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "has_accepted_consent";
const CONSENT_VERSION = 1; // bump when disclosure copy changes materially

export async function hasAcceptedConsent(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return false;
  try {
    return JSON.parse(raw).version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export async function markConsentAccepted(): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ version: CONSENT_VERSION }));
}
