import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, Stack } from 'expo-router'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import {
  organizationRequest,
  organizationErrorMessage,
  isRequestCancelled,
} from '@/src/features/organizations/lib/api'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/sharing/components/styles'
import {
  useSharedSightings,
  type SharedSighting,
} from '@/src/features/organizations/sharing/hooks/useSharedSightings'
import { SharedSightingsMap } from '@/src/features/organizations/sharing/components/SharedSightingsMap'
import { PinInteractions } from '@/src/features/organizations/interactions/components/PinInteractions'

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
  const [error, setError] = useState('')
  const [attempt, retry] = useState(0)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void organizationRequest<{ image: string }>(
      { action: 'sharedPhoto', organizationId, id: sighting.id, index },
      uid,
      { signal: controller.signal },
    )
      .then((result) => {
        if (active) setImage(result.image)
      })
      .catch((error) => {
        if (active && !isRequestCancelled(error))
          setError(organizationErrorMessage(error))
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [uid, organizationId, sighting.id, index, attempt])
  return image ? (
    <Image
      source={{ uri: image }}
      cachePolicy="none"
      style={layout.photo}
      contentFit="contain"
      accessibilityLabel={`Shared cat photo ${index + 1}`}
    />
  ) : error ? (
    <View>
      <Text accessibilityRole="alert" style={styles.hint}>
        {error}
      </Text>
      <TextButton
        onPress={() => {
          setError('')
          retry((value) => value + 1)
        }}
      >
        Retry photo
      </TextButton>
    </View>
  ) : (
    <OrganizationLoading label="Loading photo…" />
  )
}

export default function SharedSightingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useSharedSightings(id)
  const [selectedId, select] = useState<string | null>(null)
  const uid = query.uid
  const selected = query.sightings.find((s) => s.id === selectedId)
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Stack.Screen options={{ title: 'Shared Sightings' }} />
      <Text style={styles.hint}>
        Shaded areas show approximate locations. Pins show explicitly shared
        precise locations.
      </Text>
      {!query.uid && (
        <Text style={styles.body}>Sign in to view shared Sightings.</Text>
      )}
      {!query.enabled && (
        <Text style={styles.body}>
          Organization sharing is currently unavailable.
        </Text>
      )}
      {query.initialLoading && (
        <OrganizationLoading label="Loading shared Sightings…" />
      )}
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
          void query.refresh()
        }}
        loading={query.busy}
        disabled={!query.online || !query.uid || !query.enabled}
      >
        Refresh shared Sightings
      </AppButton>
      <SharedSightingsMap sightings={query.sightings} onSelect={select} />
      {query.enabled &&
        query.uid &&
        query.loaded &&
        !query.busy &&
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
            void query.loadMore()
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
          {uid &&
            Array.from({ length: selected.photoCount }, (_, index) => (
              <SharedPhoto
                key={`${query.uid}-${selected.id}-${index}`}
                uid={uid}
                organizationId={id}
                sighting={selected}
                index={index}
              />
            ))}
          <PinInteractions
            key={selected.id}
            organizationId={id}
            pinId={selected.id}
          />
        </View>
      )}
    </ScrollView>
  )
}
