/**
 * features/draft-submission/components/ProfilePicPicker.tsx
 * Cat Form row: one crop per photo this cat is boxed in. Tapping a crop makes
 * it the cat's Profile Pic. Until the user taps one, the first box is the
 * Profile Pic and shows as selected — the same boxes and the same rule
 * Submit applies (lib/submission/profilePhoto.ts), so what is starred is
 * what is saved.
 *
 * Hidden when the cat has no box (a cat described without annotating).
 */

import { formatCopy, submissionCopy } from '@/src/shared/config/text'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { CatCrop } from '@/src/shared/ui/atoms/CatCrop'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { selectionHaptic } from '@/src/shared/lib/haptics'
import { resolveProfileBox } from '@/src/features/draft-submission/lib/profilePhoto'
import { StarIcon } from 'phosphor-react-native/src/icons/Star'
import { Text } from '@/src/shared/ui/atoms/Text'
import { Pressable, ScrollView, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useShallow } from 'zustand/react/shallow'
import { styles } from './ProfilePicPicker.styles'

const catCopy = submissionCopy.cat

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
      <Text style={styles.label}>{catCopy.profilePic}</Text>
      <Text style={styles.hint}>
        {canChoose ? catCopy.profilePicChoose : catCopy.profilePicSingle}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={catCopy.profilePic}
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
              accessibilityLabel={formatCopy(catCopy.useProfilePic, {
                number: index + 1,
                count: boxes.length,
              })}
              style={styles.option}
            >
              <CatCrop
                uri={photo?.uri}
                box={box}
                size={CROP_SIZE}
                borderColor={selected ? catColor : undefined}
                style={selected && styles.selected}
                accessibilityLabel={formatCopy(catCopy.photo, {
                  number: index + 1,
                })}
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
