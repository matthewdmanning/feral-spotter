import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, Stack } from 'expo-router'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { organizationRequest } from '../../lib/api'
import { styles } from '../../components/styles'
import { styles as layout } from '../components/styles'
import {
  useSharedSightings,
  type SharedSighting,
} from '../hooks/useSharedSightings'
import { SharedSightingsMap } from '../components/SharedSightingsMap'

function SharedPhoto({
  uid,
  organizationId,
  sighting,
  index,
}: {
  uid: string
  organizationId: string
  sighting: SharedSighting
  index: number
}) {
  const [image, setImage] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void organizationRequest<{ image: string }>(
      { action: 'sharedPhoto', organizationId, id: sighting.id, index },
      uid,
    )
      .then((result) => {
        if (active) setImage(result.image)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [uid, organizationId, sighting.id, index])
  return image ? (
    <Image
      source={{ uri: image }}
      cachePolicy="none"
      style={layout.photo}
      contentFit="contain"
      accessibilityLabel={`Shared cat photo ${index + 1}`}
    />
  ) : (
    <Text style={styles.hint}>
      {error ? 'Photo unavailable. Refresh to retry.' : 'Loading photo…'}
    </Text>
  )
}

export default function SharedSightingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useSharedSightings(id)
  const [selectedId, select] = useState<string | null>(null)
  const selected = query.sightings.find((s) => s.id === selectedId)
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Stack.Screen options={{ title: 'Shared Sightings' }} />
      <Text style={styles.hint}>
        Shaded areas show approximate locations. Pins show explicitly shared
        precise locations.
      </Text>
      {!query.online && (
        <Text style={styles.body}>Connect to view shared Sightings.</Text>
      )}
      {!!query.error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {query.error}
        </Text>
      )}
      <AppButton
        onPress={() => {
          select(null)
          void query.load()
        }}
        loading={query.busy}
      >
        Refresh shared Sightings
      </AppButton>
      <SharedSightingsMap sightings={query.sightings} onSelect={select} />
      {!query.busy &&
        !query.error &&
        query.online &&
        !query.sightings.length && (
          <Text style={styles.body}>
            {query.cursor
              ? 'No shared Sightings on this page. Load more to continue.'
              : 'No shared Sightings.'}
          </Text>
        )}
      {query.sightings.map((s, index) => (
        <TextButton
          key={s.id}
          onPress={() => select(s.id)}
        >{`Sighting ${index + 1}: ${s.catCount} cats · ${s.preciseLocation ? 'Precise location' : 'Approximate area'}`}</TextButton>
      ))}
      {!!query.cursor && (
        <AppButton
          disabled={query.busy}
          onPress={() => {
            void query.load(query.cursor!, true)
          }}
        >
          Load more Sightings
        </AppButton>
      )}
      {selected && (
        <View style={styles.card}>
          <Text style={styles.title}>{selected.catCount} cats</Text>
          <Text style={styles.body}>
            {selected.preciseLocation
              ? `${selected.preciseLocation.latitude}, ${selected.preciseLocation.longitude}`
              : `Approximate area: ${selected.generalLocation.south}–${selected.generalLocation.north} latitude, ${selected.generalLocation.west}–${selected.generalLocation.east} longitude`}
          </Text>
          {selected.cats?.map((cat, index) => (
            <Text key={index} style={styles.body}>
              {Object.entries(cat)
                .map(([key, value]) => `${key}: ${value}`)
                .join(' · ')}
            </Text>
          ))}
          {query.uid &&
            Array.from({ length: selected.photoCount }, (_, index) => (
              <SharedPhoto
                key={`${query.uid}-${selected.id}-${index}`}
                uid={query.uid!}
                organizationId={id}
                sighting={selected}
                index={index}
              />
            ))}
        </View>
      )}
    </ScrollView>
  )
}
