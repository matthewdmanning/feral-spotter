import { useCallback } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './CatPhotoSelector.styles'
import { router } from 'expo-router'
import { Check, ScanLine } from 'lucide-react-native'
import { usePhotoStore } from '@/src/hooks'

interface CatPhotoSelectorProps {
  catLocalId: string; selectedPhotoIds: string[]
  onTogglePhoto: (photoId: string) => void
  annotationEnabled: boolean; photosReviewed: boolean
}

export function CatPhotoSelector({ catLocalId, selectedPhotoIds, onTogglePhoto, annotationEnabled, photosReviewed }: CatPhotoSelectorProps) {
  const { theme } = useUnistyles()
  const photos      = usePhotoStore((s) => s.photos)
  const handleReview = useCallback(() => {
    router.push({ pathname: '/submission/annotate', params: { cat_id: catLocalId } })
  }, [catLocalId])

  if (photos.length === 0) return <Text style={styles.empty}>Add photos to the submission first.</Text>

  const canReview = annotationEnabled && selectedPhotoIds.length > 0 && catLocalId !== ''

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((photo) => {
          const isSelected = selectedPhotoIds.includes(photo.local_id)
          return (
            <Pressable key={photo.local_id} onPress={() => onTogglePhoto(photo.local_id)}
              accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }}>
              <View>
                <Image
                  source={{ uri: photo.uri }}
                  cachePolicy="memory-disk"
                  style={[styles.thumb, isSelected ? styles.thumbSelected : styles.thumbUnselected]}
                  contentFit="cover"
                />
                <View style={[styles.check, isSelected ? styles.checkSelected : styles.checkUnselected]}>
                  {isSelected && <Check size={10} color={theme.colors.accentText} />}
                </View>
                {isSelected && annotationEnabled && photosReviewed && <View style={styles.dot} />}
              </View>
            </Pressable>
          )
        })}
      </ScrollView>

      {canReview && (
        <Pressable onPress={handleReview}
          style={[styles.reviewBtn, photosReviewed ? styles.reviewBtnReviewed : styles.reviewBtnActive]}
          accessibilityRole="button">
          <ScanLine size={14} color={photosReviewed ? theme.colors.muted : theme.colors.accentText} />
          <Text style={photosReviewed ? styles.reviewTextReviewed : styles.reviewTextActive}>
            {photosReviewed ? 'Re-review Photos' : 'Review Photos'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
