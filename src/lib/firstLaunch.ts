/**
 * lib/firstLaunch.ts
 * Tracks whether the app has been opened before.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "has_launched";

export async function isFirstLaunch(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) !== "true";
}

export async function markLaunched(): Promise<void> {
  await AsyncStorage.setItem(KEY, "true");
}
