import { Platform, View } from 'react-native'
import { AppleMaps, GoogleMaps } from 'expo-maps'
import { useUnistyles } from 'react-native-unistyles'
import type { SharedSighting } from '../hooks/useSharedSightings'
import { styles } from './styles'

export function SharedSightingsMap({
  sightings,
  onSelect,
}: {
  sightings: SharedSighting[]
  onSelect: (id: string) => void
}) {
  const { theme } = useUnistyles()
  if (!sightings.length || (Platform.OS !== 'ios' && Platform.OS !== 'android'))
    return null
  const markers = sightings
    .filter((s) => s.preciseLocation)
    .map((s) => ({
      id: s.id,
      coordinates: s.preciseLocation!,
      title: `${s.catCount} cats`,
    }))
  const polygons = sightings
    .filter((s) => !s.preciseLocation)
    .map((s) => {
      const { north, south, east, west } = s.generalLocation
      return {
        id: s.id,
        coordinates: [
          { latitude: south, longitude: west },
          { latitude: north, longitude: west },
          { latitude: north, longitude: east },
          { latitude: south, longitude: east },
        ],
        color: theme.colors.muted,
        lineColor: theme.colors.text,
        lineWidth: 2,
      }
    })
  const first = sightings[0]
  const cameraPosition = {
    coordinates: first.preciseLocation ?? {
      latitude: (first.generalLocation.north + first.generalLocation.south) / 2,
      longitude: (first.generalLocation.east + first.generalLocation.west) / 2,
    },
    zoom: 11,
  }
  const onPress = ({ id }: { id?: string }) => {
    if (id) onSelect(id)
  }
  return (
    <View
      style={styles.map}
      accessibilityLabel="Shared Sightings map; shaded areas are approximate locations"
    >
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={styles.fill}
          cameraPosition={cameraPosition}
          markers={markers}
          polygons={polygons}
          onMarkerClick={onPress}
          onPolygonClick={onPress}
        />
      ) : (
        <GoogleMaps.View
          style={styles.fill}
          cameraPosition={cameraPosition}
          markers={markers}
          polygons={polygons}
          onMarkerClick={onPress}
          onPolygonClick={onPress}
        />
      )}
    </View>
  )
}
