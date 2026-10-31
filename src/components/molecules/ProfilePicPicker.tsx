/**
 * components/molecules/ProfilePicPicker.tsx
 * Cat Form row: one crop per photo this cat is boxed in. Tapping a crop makes
 * it the cat's Profile Pic. Until the user taps one, the first box is the
 * Profile Pic and shows as selected — the same boxes and the same rule
 * Submit applies (lib/submission/profilePhoto.ts), so what is starred is
 * what is saved.
 *
 * Hidden when the cat has no box (a cat described without annotating).
 */

import { GlassSurface } from '@/src/components/atoms/GlassSurface'
import { CatCrop } from '@/src/components/atoms/CatCrop'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { selectionHaptic } from '@/src/lib/haptics'
import { resolveProfileBox } from '@/src/lib/submission/profilePhoto'
import { StarIcon } from 'phosphor-react-native/src/icons/Star'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useShallow } from 'zustand/react/shallow'
import { styles } from './ProfilePicPicker.styles'

/** Above the 48 dp touch target, small enough that three fit a phone row. */
const CROP_SIZE = 72

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
  // Confirmation order, as Submit reads it: the first box is the fallback.
  const boxes = useBoundingBoxStore(useShallow((s) => s.getBoxesForCat(catId)))
  const catColor = useBoundingBoxStore(
    (s) => theme.catPalette[s.catColors[catId]],
  )
  const photos = usePhotoStore((s) => s.photos)
  if (boxes.length === 0) return null

  const selectedPhotoId = resolveProfileBox(boxes, value)?.photo_local_id
  const canChoose = boxes.length > 1

  return (
    <GlassSurface kind="card" style={styles.root}>
      <Text style={styles.label}>Profile Pic</Text>
      <Text style={styles.hint}>
        {canChoose
          ? 'Tap the photo that shows this cat best.'
          : 'Box this cat in another photo to choose between them.'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel="Profile Pic"
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
              accessibilityState={{ checked: selected, disabled: !canChoose }}
              accessibilityLabel={`Use photo ${index + 1} of ${boxes.length} as Profile Pic`}
              style={styles.option}
            >
              <CatCrop
                uri={photo?.uri}
                box={box}
                size={CROP_SIZE}
                borderColor={selected ? catColor : undefined}
                style={selected && styles.selected}
                accessibilityLabel={`Photo ${index + 1}`}
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
    </GlassSurface>
  )
}
