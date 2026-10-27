/**
 * components/molecules/ProfilePicPicker.tsx
 * Cat Form row: one crop per photo this cat is boxed in. Tapping a crop makes
 * it the cat's Profile Pic. Until the user taps one, the first box is the
 * Profile Pic and shows as selected — the same rule Submit applies
 * (lib/submission/profilePhoto.ts), so what is starred is what is saved.
 *
 * Hidden when the cat has no box (a cat described without annotating).
 */

import { CatCrop } from '@/src/components/atoms/CatCrop'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { selectionHaptic } from '@/src/lib/haptics'
import { resolveProfileBox } from '@/src/lib/submission/profilePhoto'
import { StarIcon } from 'phosphor-react-native/src/icons/Star'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './ProfilePicPicker.styles'

export const PROFILE_PIC_SIZE = 72

interface ProfilePicPickerProps {
  catId: string
  value: string | undefined
  onChange: (photoLocalId: string) => void
}

export function ProfilePicPicker({
  catId,
  value,
  onChange,
}: ProfilePicPickerProps) {
  const { theme } = useUnistyles()
  // Subscribe to the map, then derive: a selector returning a fresh array
  // would re-render forever. Key order is confirmation order, as in
  // getBoxesForCat, so the first entry is the fallback Profile Pic.
  const boxMap = useBoundingBoxStore((s) => s.boxes)
  const catColor = useBoundingBoxStore(
    (s) => theme.catPalette[s.catColors[catId]],
  )
  const photos = usePhotoStore((s) => s.photos)
  const boxes = Object.entries(boxMap)
    .filter(([key]) => key.startsWith(`${catId}:`))
    .flatMap(([, catBoxes]) => catBoxes)
    .filter((b) => photos.some((p) => p.local_id === b.photo_local_id))
  if (boxes.length === 0) return null

  const selectedPhotoId = resolveProfileBox(boxes, value)?.photo_local_id
  const canChoose = boxes.length > 1

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Profile Pic</Text>
      {canChoose && (
        <Text style={styles.hint}>Tap the photo that shows this cat best.</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {boxes.map((box, index) => {
          const photo = photos.find((p) => p.local_id === box.photo_local_id)
          const selected = box.photo_local_id === selectedPhotoId
          return (
            <Pressable
              key={box.id}
              disabled={!canChoose}
              onPress={() => {
                selectionHaptic()
                onChange(box.photo_local_id)
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !canChoose }}
              accessibilityLabel={`Photo ${index + 1} of ${boxes.length}`}
              style={styles.option}
            >
              <CatCrop
                uri={photo?.uri}
                box={box}
                size={PROFILE_PIC_SIZE}
                borderColor={selected ? catColor : undefined}
                style={selected ? styles.selected : styles.unselected}
              />
              {selected && (
                <View style={styles.badge}>
                  <StarIcon
                    size={theme.iconSize.sm}
                    color={theme.colors.accentText}
                    weight="fill"
                  />
                </View>
              )}
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}
