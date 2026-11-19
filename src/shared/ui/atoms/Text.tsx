import type { ComponentProps } from 'react'
import { Text as NativeText } from 'react-native'
import { MAX_FONT_SIZE_MULTIPLIER } from '@/src/shared/config/text'

/** Keep nested text and local props from disabling scaling or removing the ceiling. */
export function Text(props: ComponentProps<typeof NativeText>) {
  return (
    <NativeText
      {...props}
      allowFontScaling
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
    />
  )
}
