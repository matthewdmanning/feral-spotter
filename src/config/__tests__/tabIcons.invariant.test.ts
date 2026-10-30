import fs from 'fs'
import path from 'path'
import tabIcons from '../tabIcons.json'

// The failure this guards: a renamed route file or a mistyped icon key leaves
// a tab missing or blank, and a Phosphor name that has no SVG fails the
// Android prebuild. Read from the real route folder and the real icon package.
const tabRoutes = ['index', 'feral-reports', 'settings']
const routeDir = path.join(__dirname, '../../app/(home-tabs)')
// The package's exports map hides package.json, so resolve an asset instead.
const phosphorAssets = path.resolve(
  require.resolve('@phosphor-icons/core/assets/regular/camera.svg'),
  '../../..',
)

describe.each(Object.entries(tabIcons))('tab %s', (name, icon) => {
  it('has a route file', () => {
    expect(fs.existsSync(path.join(routeDir, `${name}.tsx`))).toBe(true)
  })

  it('names an icon for every platform and state', () => {
    for (const set of [icon.drawable, icon.sf]) {
      expect(set.default).toBeTruthy()
      expect(set.selected).toBeTruthy()
    }
  })

  it('has regular and fill Phosphor SVGs for the Android drawables', () => {
    for (const file of [
      `regular/${icon.phosphor}.svg`,
      `fill/${icon.phosphor}-fill.svg`,
    ]) {
      expect(fs.existsSync(path.join(phosphorAssets, 'assets', file))).toBe(
        true,
      )
    }
  })
})

it('declares an icon entry for every tab route', () => {
  expect(Object.keys(tabIcons).sort()).toEqual([...tabRoutes].sort())
})
