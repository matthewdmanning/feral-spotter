/**
 * Google Cloud Run API Integration
 * Handles photo uploads and submission with password authentication
 */

// React Native's FormData.append accepts { uri, name, type } file objects
import type { SubmissionApiPayload, SubmissionApiResponse } from '@/src/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// Cloud Run endpoint (replace with your actual endpoint)
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://YOUR-SERVICE-PROJECT-ID.REGION.run.app'

// Storage keys
// SecureStore keys may only contain alphanumerics, ".", "-", and "_" — no "@".
const PASSWORD_STORAGE_KEY = 'feralspotter_password'
const DEVICE_ID_STORAGE_KEY = '@feralspotter_device_id'

/**
 * Generate or retrieve device ID
 */
async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY)
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId)
    }
    return deviceId
  } catch (error) {
    console.error('Device ID error:', error)
    return `device_${Date.now()}`
  }
}

/**
 * Store user password securely
 */
export async function storePassword(password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PASSWORD_STORAGE_KEY, password)
  } catch (error) {
    console.error('Store password error:', error)
    throw new Error('Failed to store password')
  }
}

// Dev builds have no reachable backend to verify a real password against
// (see EXPO_PUBLIC_API_BASE_URL), so auto-provision one on first read to
// keep the submission flow testable without registering first.
const DEV_STUB_PASSWORD = 'dev-stub-password'

/**
 * Retrieve stored password
 */
export async function getPassword(): Promise<string | null> {
  try {
    const password = await SecureStore.getItemAsync(PASSWORD_STORAGE_KEY)
    if (!password && __DEV__) {
      await SecureStore.setItemAsync(PASSWORD_STORAGE_KEY, DEV_STUB_PASSWORD)
      return DEV_STUB_PASSWORD
    }
    return password
  } catch (error) {
    console.error('Get password error:', error)
    return null
  }
}

/**
 * Remove stored password
 */
export async function removePassword(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PASSWORD_STORAGE_KEY)
  } catch (error) {
    console.error('Remove password error:', error)
  }
}

/**
 * Check if password is stored
 */
export async function hasPassword(): Promise<boolean> {
  const password = await getPassword()
  return password !== null && password.length > 0
}

/**
 * Get authentication headers
 *
 * TODO(firebase-auth): this legacy shared-password scheme (superseded per the
 * 2026-07-12 roadmap) needs to become `Authorization: Bearer <Firebase ID
 * token>` once the API route verifies Firebase tokens server-side. Out of
 * scope for the client-side Firebase Auth migration — backend not implemented.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const password = await getPassword()
  const deviceId = await getDeviceId()

  if (!password) {
    throw new Error('You must register first.')
  }

  return {
    'Content-Type': 'application/json',
    'X-Auth-Password': password,
    'X-Device-ID': deviceId,
  }
}

// Dev builds have no reachable backend to submit against (see
// EXPO_PUBLIC_API_BASE_URL) — mock a successful response so the capture ->
// cat-observations -> submission flow stays testable end-to-end during
// manual test-drives without a live Cloud Run deployment.
const IS_MOCK_BACKEND = __DEV__ && !process.env.EXPO_PUBLIC_API_BASE_URL

/**
 * Submit observation to Google Cloud Run
 */
export async function submitObservation(
  payload: SubmissionApiPayload,
): Promise<SubmissionApiResponse> {
  if (IS_MOCK_BACKEND) {
    return { status: 'success', id: `mock-${Date.now()}` }
  }
  try {
    const headers = await getAuthHeaders()
    const deviceId = await getDeviceId()

    // Add device ID and timestamp to payload
    const enrichedPayload = {
      ...payload,
      device_id: deviceId,
      submitted_at: new Date().toISOString(),
    }

    const response = await fetch(`${API_BASE_URL}/submit-observation`, {
      method: 'POST',
      headers,
      body: JSON.stringify(enrichedPayload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Submission failed')
    }

    const data: SubmissionApiResponse = await response.json()

    return data
  } catch (error) {
    console.error('Submission error:', error)
    throw error
  }
}

/**
 * Verify password with Cloud Run
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceId()

    const response = await fetch(`${API_BASE_URL}/verify-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Password': password,
        'X-Device-ID': deviceId,
      },
      body: JSON.stringify({ device_id: deviceId }),
    })

    if (response.ok) {
      await storePassword(password)
      return true
    }

    return false
  } catch (error) {
    console.error('Verify password error:', error)
    return false
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
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall()
    } catch (error) {
      lastError = error as Error
      console.log(`Attempt ${attempt + 1} failed:`, error)

      if (attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise<void>((resolve) =>
          setTimeout(() => resolve(), delay * Math.pow(2, attempt)),
        )
      }
    }
  }

  throw (
    lastError ??
    new Error('retryApiCall: apiCall did not run (maxRetries <= 0)')
  )
}

/**
 * Check if device is online
 */
export async function checkNetworkStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'HEAD',
    })
    return response.ok
  } catch {
    return false
  }
}
