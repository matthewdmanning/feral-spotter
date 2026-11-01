/**
 * shared/types/assets.d.ts
 * Metro resolves an imported image to a numeric asset id. Expo's generated
 * expo-env.d.ts is gitignored and absent in CI's typecheck, so the
 * declaration lives here.
 */
declare module '*.png' {
  const asset: number
  export default asset
}
