/**
 * components/molecules/PhotoPreviewModal.tsx
 *
 * insets handled via rt.insets in the stylesheet — no prop needed,
 * no useSafeAreaInsets hook.
 */
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import type { SubmissionPhoto } from '@/src/types'
import { Canvas, Group, Paint, Rect } from '@shopify/react-native-skia'
import { X } from 'lucide-react-native'
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { styles } from './PhotoPreviewModal.styles'

interface PhotoPreviewModalProps {
  photo: SubmissionPhoto; isChecked: boolean
  onClose: () => void; onToggle: () => void
}

function BoundingBoxRect({ nx, ny, nw, nh }: { nx: number; ny: number; nw: number; nh: number }) {
  const { theme } = useUnistyles()
  const { width: SW, height: SH } = useWindowDimensions()
  const x = nx * SW; const y = ny * SH * 0.75
  const w = nw * SW; const h = nh * SH * 0.75
  return (
    <Group>
      <Rect x={x} y={y} width={w} height={h} color="rgba(110,168,254,0.25)" />
      <Rect x={x} y={y} width={w} height={h}><Paint style="stroke" strokeWidth={2} color={theme.colors.accent} /></Rect>
    </Group>
  )
}

export function PhotoPreviewModal({ photo, isChecked, onClose, onToggle }: PhotoPreviewModalProps) {
  const boxes = useBoundingBoxStore((s) => s.getBoxesForPhoto(photo.local_id))

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>

        <Pressable onPress={onClose} style={styles.closeBtn}
          accessibilityLabel="Close preview" accessibilityRole="button">
          <X size={22} color="white" />
        </Pressable>

        <View style={styles.imageWrap}>
          <Image source={{ uri: photo.uri }} cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill} contentFit="contain" />
          {boxes.length > 0 && (
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              {boxes.map((box) => (
                <BoundingBoxRect key={box.id} nx={box.lowerLeftX} ny={box.upperRightY}
                  nw={box.upperRightX - box.lowerLeftX} nh={box.lowerLeftY - box.upperRightY} />
              ))}
            </Canvas>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => { onToggle(); onClose() }}
            style={[styles.toggleBtn, isChecked ? styles.toggleRemove : styles.toggleAdd]}
            accessibilityRole="button">
            <Text style={isChecked ? styles.toggleTextRemove : styles.toggleTextAdd}>
              {isChecked ? 'Remove from Submission' : 'Include in Submission'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
