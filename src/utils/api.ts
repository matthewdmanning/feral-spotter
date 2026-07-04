/**
 * Google Cloud Run API Integration
 * Handles photo uploads and submission with password authentication
 */

// React Native's FormData.append accepts { uri, name, type } file objects
import type {
  PhotoUploadResponse,
  SubmissionApiPayload,
  SubmissionApiResponse,
} from "@/src/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

declare global {
  interface FormData {
    append(name: string, value: { uri: string; name: string; type: string }): void
  }
}

// Cloud Run endpoint (replace with your actual endpoint)
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://YOUR-SERVICE-PROJECT-ID.REGION.run.app";

// Storage keys
// SecureStore keys may only contain alphanumerics, ".", "-", and "_" — no "@".
const PASSWORD_STORAGE_KEY = "feralspotter_password";
const DEVICE_ID_STORAGE_KEY = "@feralspotter_device_id";

/**
 * Generate or retrieve device ID
 */
async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error("Device ID error:", error);
    return `device_${Date.now()}`;
  }
}

/**
 * Store user password securely
 */
export async function storePassword(password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PASSWORD_STORAGE_KEY, password);
  } catch (error) {
    console.error("Store password error:", error);
    throw new Error("Failed to store password");
  }
}

/**
 * Retrieve stored password
 */
export async function getPassword(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PASSWORD_STORAGE_KEY);
  } catch (error) {
    console.error("Get password error:", error);
    return null;
  }
}

/**
 * Remove stored password
 */
export async function removePassword(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PASSWORD_STORAGE_KEY);
  } catch (error) {
    console.error("Remove password error:", error);
  }
}

/**
 * Check if password is stored
 */
export async function hasPassword(): Promise<boolean> {
  const password = await getPassword();
  return password !== null && password.length > 0;
}

/**
 * Get authentication headers
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const password = await getPassword();
  const deviceId = await getDeviceId();

  if (!password) {
    throw new Error("No password configured. Please set a password first.");
  }

  return {
    "Content-Type": "application/json",
    "X-Auth-Password": password,
    "X-Device-ID": deviceId,
  };
}

/**
 * Upload a photo to Google Cloud Run
 */
export async function uploadPhotoToCloud(
  uri: string,
  filename: string,
  onProgress?: (progress: number) => void,
): Promise<PhotoUploadResponse> {
  try {
    const password = await getPassword();
    if (!password) {
      throw new Error("No password configured");
    }

    const deviceId = await getDeviceId();

    // Create form data — RN's FormData takes { uri, name, type }, not a Blob
    const formData = new FormData();
    formData.append("file", uri);
    formData.append("name", filename);
    formData.append("type", "image/jpeg");
    formData.append("device_id", deviceId);

    // Upload to Cloud Run endpoint
    const uploadResponse = await fetch(`${API_BASE_URL}/upload-photo`, {
      method: "POST",
      body: formData,
      headers: {
        "X-Auth-Password": password,
        "X-Device-ID": deviceId,
      },
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.message || "Upload failed");
    }

    const data: PhotoUploadResponse = await uploadResponse.json();

    return data;
  } catch (error) {
    console.error("Photo upload error:", error);
    throw error;
  }
}

/**
 * Upload photo with progress tracking using XMLHttpRequest
 */
export async function uploadPhotoWithProgress(
  uri: string,
  filename: string,
  onProgress: (progress: number) => void,
): Promise<PhotoUploadResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      const password = await getPassword();
      if (!password) {
        throw new Error("No password configured");
      }

      const deviceId = await getDeviceId();
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      // Prepare form data — RN's FormData takes { uri, name, type }, not a Blob
      const formData = new FormData();
      formData.append("file", { uri, name: filename, type: "image/jpeg" });
      formData.append("device_id", deviceId);

      // Send request
      xhr.open("POST", `${API_BASE_URL}/upload-photo`);
      xhr.setRequestHeader("X-Auth-Password", password);
      xhr.setRequestHeader("X-Device-ID", deviceId);
      xhr.send(formData);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Submit observation to Google Cloud Run
 */
export async function submitObservation(
  payload: SubmissionApiPayload,
): Promise<SubmissionApiResponse> {
  try {
    const headers = await getAuthHeaders();
    const deviceId = await getDeviceId();

    // Add device ID and timestamp to payload
    const enrichedPayload = {
      ...payload,
      device_id: deviceId,
      submitted_at: new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/submit-observation`, {
      method: "POST",
      headers,
      body: JSON.stringify(enrichedPayload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Submission failed");
    }

    const data: SubmissionApiResponse = await response.json();

    return data;
  } catch (error) {
    console.error("Submission error:", error);
    throw error;
  }
}

/**
 * Verify password with Cloud Run
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();

    const response = await fetch(`${API_BASE_URL}/verify-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Password": password,
        "X-Device-ID": deviceId,
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    if (response.ok) {
      await storePassword(password);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Verify password error:", error);
    return false;
  }
}

/**
 * Retry logic wrapper for API calls
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt + 1} failed:`, error);

      if (attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise<void>((resolve) =>
          setTimeout(() => resolve(), delay * Math.pow(2, attempt)),
        );
      }
    }
  }

  throw lastError!;
}

/**
 * Check if device is online
 */
export async function checkNetworkStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "HEAD",
    });
    return response.ok;
  } catch {
    return false;
  }
}
