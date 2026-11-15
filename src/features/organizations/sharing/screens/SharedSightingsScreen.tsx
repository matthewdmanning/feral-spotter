import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Text } from '@/src/shared/ui/atoms/Text'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { FieldRow } from '@/src/shared/ui/molecules/FieldRow'
import { formatCopy, organizationCopy } from '@/src/shared/config/text'
import { describeCat } from '@/src/features/draft-submission/lib/attributes'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import { OrganizationQueryStatus } from '@/src/features/organizations/components/OrganizationQueryStatus'
import {
  organizationRequest,
  organizationErrorMessage,
  isRequestCancelled,
} from '@/src/features/organizations/lib/api'
import { styles } from '@/src/features/organizations/components/styles'
import { styles as layout } from '@/src/features/organizations/membership/components/styles'
import { styles as sharing } from '@/src/features/organizations/sharing/components/styles'
import {
  useSharedSightings,
  type SharedSighting,
} from '@/src/features/organizations/sharing/hooks/useSharedSightings'
import {
  catCountLabel,
  sightingLocationLabel,
} from '@/src/features/organizations/sharing/lib/sightings'
import { SharedSightingsMap } from '@/src/features/organizations/sharing/components/SharedSightingsMap'
import { PinInteractions } from '@/src/features/organizations/interactions/components/PinInteractions'

const copy = organizationCopy.sharedSightings

/** One photo; reports when it has loaded or failed so the next can start. */
function SharedPhoto({
  uid,
  organizationId,
  sighting,
  index,
  onSettled,
}: {
  uid: string
  organizationId: string
  sighting: SharedSighting
  index: number
  onSettled: () => void
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
      .finally(() => {
        if (active) onSettled()
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [uid, organizationId, sighting.id, index, attempt, onSettled])
  return image ? (
    <Image
      source={{ uri: image }}
      // Shared photos stay memory-only, like the rest of the shared view.
      cachePolicy="none"
      style={sharing.photo}
      contentFit="contain"
      accessibilityLabel={formatCopy(copy.photo, { number: index + 1 })}
    />
  ) : error ? (
    <View style={styles.fieldGroup}>
      <Text accessibilityRole="alert" style={styles.hint}>
        {error}
      </Text>
      <TextButton
        onPress={() => {
          setError('')
          retry((value) => value + 1)
        }}
      >
        {copy.retryPhoto}
      </TextButton>
    </View>
  ) : (
    <OrganizationLoading label={copy.loadingPhoto} />
  )
}

/**
 * Photos load one at a time: each is a resized image from a single-instance
 * function, so requesting all at once only queues them behind each other.
 */
function SharedPhotos({
  uid,
  organizationId,
  sighting,
}: {
  uid: string
  organizationId: string
  sighting: SharedSighting
}) {
  const [settled, setSettled] = useState(0)
  const [onSettled] = useState(() => () => setSettled((count) => count + 1))
  return Array.from(
    { length: Math.min(sighting.photoCount, settled + 1) },
    (_, index) => (
      <SharedPhoto
        key={index}
        uid={uid}
        organizationId={organizationId}
        sighting={sighting}
        index={index}
        onSettled={onSettled}
      />
    ),
  )
}

function SightingDetails({
  uid,
  organizationId,
  sighting,
}: {
  uid: string
  organizationId: string
  sighting: SharedSighting
}) {
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {catCountLabel(sighting.catCount)}
      </Text>
      <Text style={styles.body}>{sightingLocationLabel(sighting)}</Text>
      {sighting.cats?.map((cat, index) => (
        <View key={index} style={styles.fieldGroup}>
          <Text style={styles.subtitle}>
            {formatCopy(copy.cat, { number: index + 1 })}
          </Text>
          {describeCat(cat).map(({ label, value }) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
        </View>
      ))}
      <SharedPhotos
        uid={uid}
        organizationId={organizationId}
        sighting={sighting}
      />
      <PinInteractions organizationId={organizationId} pinId={sighting.id} />
    </GlassSurface>
  )
}

export default function SharedSightingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useSharedSightings(id)
  const [selectedId, select] = useState<string | null>(null)
  const [mapTouched, setMapTouched] = useState(false)
  const uid = query.uid
  const selected = query.sightings.find((s) => s.id === selectedId)
  return (
    <ScrollView
      contentContainerStyle={layout.content}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!mapTouched}
    >
      <Stack.Screen options={{ title: copy.title }} />
      <Text style={styles.hint}>{copy.mapNotice}</Text>
      <OrganizationQueryStatus
        query={query}
        copy={copy}
        refreshDisabled={!query.enabled}
        onRefresh={() => {
          select(null)
          void query.refresh()
        }}
      >
        {!query.enabled && <Text style={styles.body}>{copy.unavailable}</Text>}
      </OrganizationQueryStatus>
      <SharedSightingsMap
        sightings={query.sightings}
        onSelect={select}
        onTouchActiveChange={setMapTouched}
      />
      {/* Beside the map, not below the list: a map tap shows its result. */}
      {uid && selected && (
        <SightingDetails
          key={`${uid}-${id}-${selected.id}`}
          uid={uid}
          organizationId={id}
          sighting={selected}
        />
      )}
      {query.enabled &&
        query.uid &&
        query.loaded &&
        !query.busy &&
        !query.error &&
        query.online &&
        !query.sightings.length && (
          <Text style={styles.body}>
            {query.cursor ? copy.emptyPage : copy.empty}
          </Text>
        )}
      {query.sightings.map((s, index) => (
        <TextButton key={s.id} onPress={() => select(s.id)}>
          {formatCopy(copy.item, {
            number: index + 1,
            cats: catCountLabel(s.catCount),
            location: s.preciseLocation
              ? copy.preciseLocation
              : copy.approximateArea,
          })}
        </TextButton>
      ))}
      {!!query.cursor && (
        <AppButton
          disabled={query.busy}
          onPress={() => {
            void query.loadMore()
          }}
        >
          {copy.loadMore}
        </AppButton>
      )}
    </ScrollView>
  )
}
