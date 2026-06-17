import { useRef, useEffect, useCallback, useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useStyles } from 'react-native-unistyles'
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import { AlertCircle } from 'lucide-react-native'
import type { ValidationError } from '@/src/types'
import { stylesheet } from './ValidationSheet.styles'

interface ValidationSheetProps { open: boolean; errors: ValidationError[]; onClose: () => void }

export function ValidationSheet({ open, errors, onClose }: ValidationSheetProps) {
  const { styles, theme } = useStyles(stylesheet)
  const sheetRef   = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['40%', '70%'], [])

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0)
    else      sheetRef.current?.close()
  }, [open])

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} pressBehavior="close" onPress={onClose} />
  ), [onClose])

  return (
    <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.background, borderRadius: 20 }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 40 }}
      style={styles.sheet}>
      <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <AlertCircle size={24} color={theme.colors.danger} />
          <Text style={styles.title}>Missing Information</Text>
        </View>
        <Text style={styles.subtitle}>Please complete the required fields before submitting.</Text>
        <View style={styles.errorList}>
          {errors.map((e, i) => (
            <View key={`${e.field}-${i}`} style={[styles.errorCard, e.severity === 'error' ? styles.cardError : styles.cardWarn]}>
              <Text style={styles.errorText}>{e.message}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
          <Text style={styles.closeBtnText}>Continue Editing</Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

