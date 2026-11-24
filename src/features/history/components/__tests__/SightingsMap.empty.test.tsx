import { act, render, screen } from '@testing-library/react-native'
import * as Location from 'expo-location'
import { AppleMaps } from 'expo-maps'
import { SightingsMap } from '@/src/features/history/components/SightingsMap'
import { FALLBACK_MAP_CENTER } from '@/src/shared/lib/mapView'
import { setConsent } from '@/src/test-utils/consent'

// NAV-5: with no Sightings the map used to vanish. It now opens on the
// user's position, or on the fallback centre when that is unknown.

jest.mock('expo-location', () => ({
  ...jest.requireActual('expo-location'),
  getLastKnownPositionAsync: jest.fn(),
}))
jest.mock('expo-maps', () => ({
  AppleMaps: { View: jest.fn(() => null), MapColorScheme: { LIGHT: 'light' } },
  GoogleMaps: { View: jest.fn(() => null), MapColorScheme: { LIGHT: 'light' } },
}))

async function renderEmptyMap() {
  await render(<SightingsMap spots={[]} onSpotPress={jest.fn()} />)
  await act(async () =>
    screen.getByLabelText('Map of 0 sighting spots').props.onLayout({
      nativeEvent: { layout: { width: 300, height: 200, x: 0, y: 0 } },
    }),
  )
}
const centre = () =>
  jest.mocked(AppleMaps.View).mock.lastCall?.[0].cameraPosition?.coordinates

it.each([
  ['the device position', { latitude: 34.5, longitude: -82.5 }],
  ['the fallback centre', null],
])('centres an empty map on %s', async (_label, position) => {
  setConsent(true)
  jest
    .mocked(Location.getLastKnownPositionAsync)
    .mockResolvedValue(
      position ? ({ coords: position } as Location.LocationObject) : null,
    )

  await renderEmptyMap()

  expect(centre()).toEqual(position ?? FALLBACK_MAP_CENTER)
})
