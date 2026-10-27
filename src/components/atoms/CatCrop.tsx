/**
 * components/atoms/CatCrop.tsx
 * A square that shows one cat's box cut out of its photo — the Profile Pic.
 * Same crop math as the inset-crop bubble (lib/insetCrop/imageRect.ts), so a
 * Profile Pic frames the cat the way Cat Form showed it.
 *
 * With no photo, or a photo that fails to load (a camera file deleted at
 * draft teardown with no cloud copy), it shows a cat glyph instead.
 */

import { bubbleImageRect } from '@/src/lib/insetCrop/imageRect'
import type { NormalisedBox } from '@/src/lib/annotate/cropProjection'
import { Image } from 'expo-image'
import { CatIcon } from 'phosphor-react-native/src/icons/Cat'
import { useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './CatCrop.styles'

interface CatCropProps {
  uri: string | undefined
  box: NormalisedBox | undefined
  size: number
  /** The cat's palette color, when it has one. */
  borderColor?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export function CatCrop({
  uri,
  box,
  size,
  borderColor,
  style,
  accessibilityLabel = 'Profile picture of the cat',
}: CatCropProps) {
  const { theme } = useUnistyles()
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [failed, setFailed] = useState(false)
  const showPhoto = Boolean(uri && box) && !failed

  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size },
        borderColor ? { borderColor } : null,
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {showPhoto && box ? (
        <Image
          source={{ uri }}
          cachePolicy="memory-disk"
          style={[
            styles.image,
            bubbleImageRect(box, natural.w, natural.h, size),
          ]}
          contentFit="cover"
          onLoad={(e) => setNatural({ w: e.source.width, h: e.source.height })}
          onError={() => setFailed(true)}
        />
      ) : (
        <CatIcon
          size={size * 0.5}
          color={theme.colors.accentSoftText}
          weight="duotone"
        />
      )}
    </View>
  )
}
