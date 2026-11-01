import {
  FEDERATED_PROVIDERS,
  isFederatedProviderReleased,
  type FederatedProviderConfig,
} from '../authProviders'

const byId = (id: string): FederatedProviderConfig =>
  FEDERATED_PROVIDERS.find((p) => p.id === id) as FederatedProviderConfig

describe('federated provider release/version gate', () => {
  it('lists google, apple and facebook', () => {
    expect(FEDERATED_PROVIDERS.map((p) => p.id)).toEqual([
      'google',
      'apple',
      'facebook',
    ])
  })

  it('releases google but blocks apple and facebook at the current 0.1.0 line', () => {
    expect(isFederatedProviderReleased(byId('google'), '0.1.0')).toBe(true)
    expect(isFederatedProviderReleased(byId('apple'), '0.1.0')).toBe(false)
    expect(isFederatedProviderReleased(byId('facebook'), '0.1.0')).toBe(false)
  })

  it('unblocks apple and facebook once the app reaches their release version', () => {
    expect(isFederatedProviderReleased(byId('apple'), '1.0.0')).toBe(true)
    expect(isFederatedProviderReleased(byId('facebook'), '1.2.0')).toBe(true)
  })
})
