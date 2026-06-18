import { memo } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { useStyles } from 'react-native-unistyles'
import { stylesheet } from './CameraThumb.styles'

export const THUMB_SIZE  = 64
export const THUMB_GAP   = 6
export const THUMB_TOTAL = THUMB_SIZE + THUMB_GAP

interface CameraThumbProps { uri: string; badgeCount: number }

export const CameraThumb = memo(({ uri, badgeCount }: CameraThumbProps) => {
  const { styles } = useStyles(stylesheet)
  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} cachePolicy="memory-disk"
        style={styles.image} contentFit="cover" />
      {badgeCount > 1 && (
        <View style={styles.badge}><Text style={styles.badgeText}>{badgeCount}</Text></View>
      )}
    </View>
  )
})

