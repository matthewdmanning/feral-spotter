/**
 * app.config.js variant handling. A release APK must not be pre-release unless
 * APP_VARIANT=prerelease is set at build time. If either direction breaks,
 * release builds get treated as pre-release, or pre-release builds are
 * indistinguishable from release (#454).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../app.config.js') as (ctx: {
  config: Record<string, unknown>
}) => {
  name: string
  extra: { isPrerelease: boolean }
  android: { package?: string }
}

const base = {
  name: 'feral-spotter',
  extra: {},
  android: { package: 'com.mmanning.feralspotter' },
}

describe('app.config.js APP_VARIANT', () => {
  const original = process.env.APP_VARIANT
  afterEach(() => {
    if (original === undefined) delete process.env.APP_VARIANT
    else process.env.APP_VARIANT = original
  })

  it('is not pre-release when APP_VARIANT is unset', () => {
    delete process.env.APP_VARIANT
    const out = appConfig({ config: base })
    expect(out.extra.isPrerelease).toBe(false)
    expect(out.name).toBe('feral-spotter')
  })

  it('is not pre-release for any other APP_VARIANT value', () => {
    process.env.APP_VARIANT = 'production'
    expect(appConfig({ config: base }).extra.isPrerelease).toBe(false)
  })

  it('is pre-release, labelled, with the same applicationId', () => {
    process.env.APP_VARIANT = 'prerelease'
    const out = appConfig({ config: base })
    expect(out.extra.isPrerelease).toBe(true)
    expect(out.name).toBe('feral-spotter (pre)')
    expect(out.android.package).toBe('com.mmanning.feralspotter')
  })
})
