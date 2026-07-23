import { getPermissionState, requestPermission } from "../permissions";

const mockGetForegroundPermissionsAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
}));

const mockGetMediaLibraryPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
jest.mock("expo-image-picker", () => ({
  getMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockGetMediaLibraryPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
}));

const mockRequestCameraPermission = jest.fn();
let mockCameraPermissionStatus = "not-determined";
jest.mock("react-native-vision-camera", () => ({
  get VisionCamera() {
    return {
      get cameraPermissionStatus() {
        return mockCameraPermissionStatus;
      },
      requestCameraPermission: (...args: unknown[]) =>
        mockRequestCameraPermission(...args),
    };
  },
}));

describe("getPermissionState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCameraPermissionStatus = "not-determined";
  });

  it("location: granted when the OS reports granted", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });
    await expect(getPermissionState("location")).resolves.toBe("granted");
  });

  it("location: ask when not granted but the OS can still prompt", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    await expect(getPermissionState("location")).resolves.toBe("ask");
  });

  it("location: blocked when not granted and the OS can't prompt again", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    await expect(getPermissionState("location")).resolves.toBe("blocked");
  });

  it("camera: maps vision-camera's not-determined to ask", async () => {
    mockCameraPermissionStatus = "not-determined";
    await expect(getPermissionState("camera")).resolves.toBe("ask");
  });

  it("camera: maps vision-camera's authorized to granted", async () => {
    mockCameraPermissionStatus = "authorized";
    await expect(getPermissionState("camera")).resolves.toBe("granted");
  });

  it("camera: maps vision-camera's denied to blocked", async () => {
    mockCameraPermissionStatus = "denied";
    await expect(getPermissionState("camera")).resolves.toBe("blocked");
  });

  it("photo_library: iOS limited access counts as granted", async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      accessPrivileges: "limited",
    });
    await expect(getPermissionState("photo_library")).resolves.toBe(
      "granted",
    );
  });

  it("photo_library: blocked when denied and can't ask again", async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      accessPrivileges: "none",
    });
    await expect(getPermissionState("photo_library")).resolves.toBe(
      "blocked",
    );
  });
});

describe("requestPermission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("location: resolves true when the OS grants it", async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    await expect(requestPermission("location")).resolves.toBe(true);
  });

  it("location: resolves false when the OS denies it", async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    });
    await expect(requestPermission("location")).resolves.toBe(false);
  });

  it("camera: forwards vision-camera's own result", async () => {
    mockRequestCameraPermission.mockResolvedValue(true);
    await expect(requestPermission("camera")).resolves.toBe(true);
  });

  it("photo_library: iOS limited access counts as granted", async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: "denied",
      accessPrivileges: "limited",
    });
    await expect(requestPermission("photo_library")).resolves.toBe(true);
  });

  it("photo_library: resolves false on outright denial", async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: "denied",
      accessPrivileges: "none",
    });
    await expect(requestPermission("photo_library")).resolves.toBe(false);
  });
});
