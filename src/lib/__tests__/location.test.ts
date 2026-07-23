import { captureCurrentLocation } from "@/src/lib/location";
import { useConsentStore } from "@/src/hooks/useConsentStore";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("react-native-mmkv", () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) =>
    mockGetCurrentPositionAsync(...args),
  PermissionStatus: { GRANTED: "granted" },
  Accuracy: { Balanced: 3 },
}));

describe("captureCurrentLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConsentStore.setState({ accepted: false, acceptedVersion: null });
  });

  it("never touches expo-location when consent has not been accepted", async () => {
    const result = await captureCurrentLocation();

    expect(result).toBeUndefined();
    expect(mockGetForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("captures a fix once consent has been accepted and permission is granted", async () => {
    useConsentStore.getState().markAccepted();
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 1, longitude: 2 },
      timestamp: 1700000000000,
    });

    const result = await captureCurrentLocation();

    expect(result).toEqual({
      latitude: 1,
      longitude: 2,
      timestamp: new Date(1700000000000).toISOString(),
    });
  });
});
