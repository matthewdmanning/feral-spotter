import {
  FEDERATED_PROVIDERS,
  isFederatedProviderReleased,
} from '@/src/features/auth/lib/authProviders'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'

const allOff = Object.fromEntries(
  Object.keys(FEATURE_FLAGS).map((flag) => [flag, false]),
) as Record<keyof typeof FEATURE_FLAGS, boolean>

describe('federated provider feature flags', () => {
  it('releases google but blocks apple and facebook by default', () => {
    expect(
      FEDERATED_PROVIDERS.map((p) => [p.id, isFederatedProviderReleased(p)]),
    ).toEqual([
      ['google', true],
      ['apple', false],
      ['facebook', false],
    ])
  })

  it.each(FEDERATED_PROVIDERS)(
    'releases $id only when its own flag is on',
    (provider) => {
      expect(isFederatedProviderReleased(provider, allOff)).toBe(false)
      const released = FEDERATED_PROVIDERS.filter((p) =>
        isFederatedProviderReleased(p, { ...allOff, [provider.flag]: true }),
      )
      expect(released.map((p) => p.id)).toEqual([provider.id])
    },
  )
})
