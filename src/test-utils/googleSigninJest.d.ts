// The package's Jest setup ships as JS only. jest.config.js maps this path;
// this gives its export a type so tests type-check.
declare module '@react-native-google-signin/google-signin/jest/build/jest/setup' {
  import type { SignInSuccessResponse } from '@react-native-google-signin/google-signin'
  export const mockGoogleSignInResponse: SignInSuccessResponse
}
