import { memo } from 'react'
import { Pressable, View, Text } from 'react-native'
import { Image } from 'expo-image'
import { X } from 'lucide-react-native'
import { styles } from './CameraThumb.styles'

export { THUMB_SIZE, THUMB_GAP, THUMB_TOTAL } from './CameraThumb.constants'

interface CameraThumbProps { uri: string; badgeCount: number; onRemove: () => void }

export const CameraThumb = memo(function CameraThumb({ uri, badgeCount, onRemove }: CameraThumbProps) {
  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} cachePolicy="memory-disk"
        style={styles.image} contentFit="cover" />
      {badgeCount > 1 && (
        <View style={styles.badge}><Text style={styles.badgeText}>{badgeCount}</Text></View>
      )}
      <Pressable onPress={onRemove} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel="Discard photo">
        <X size={12} color="#fff" />
      </Pressable>
    </View>
  )
})

