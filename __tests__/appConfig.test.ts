/**
 * app.config.js variant handling. A stable APK must not be a release candidate
 * unless APP_VARIANT=rc is set at build time. If either direction breaks,
 * stable builds get treated as release candidates, or release candidates are
 * indistinguishable from stable (#454).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../app.config.js') as (ctx: {
  config: Record<string, unknown>
}) => {
  name: string
  extra: { isReleaseCandidate: boolean }
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

  it('is stable when APP_VARIANT is unset', () => {
    delete process.env.APP_VARIANT
    const out = appConfig({ config: base })
    expect(out.extra.isReleaseCandidate).toBe(false)
    expect(out.name).toBe('feral-spotter')
  })

  it('is stable for any other APP_VARIANT value', () => {
    process.env.APP_VARIANT = 'prerelease'
    expect(appConfig({ config: base }).extra.isReleaseCandidate).toBe(false)
  })

  it('is a release candidate, labelled, with the same applicationId', () => {
    process.env.APP_VARIANT = 'rc'
    const out = appConfig({ config: base })
    expect(out.extra.isReleaseCandidate).toBe(true)
    expect(out.name).toBe('feral-spotter (rc)')
    expect(out.android.package).toBe('com.mmanning.feralspotter')
  })
})
