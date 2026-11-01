/**
 * components/molecules/ButtonRow.tsx
 *
 * Two or more equal-width buttons side by side, with one gap for every row in
 * the app. At a large OS font size the row stacks instead, so no label is
 * squeezed onto extra lines or clipped (WCAG 1.4.10 reflow).
 *
 * Children are the buttons themselves, without `flex1`: each one sits in an
 * equal-width cell here, so a caller cannot make the cells uneven by accident.
 */
import { BUTTON_ROW_STACK_FONT_SCALE } from '@/src/shared/config/constants'
import { Children, type ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { styles } from './ButtonRow.styles'

interface ButtonRowProps {
  children: ReactNode
}

export function ButtonRow({ children }: ButtonRowProps) {
  // useWindowDimensions updates when the OS font size changes.
  const { fontScale } = useWindowDimensions()
  const stacked = fontScale >= BUTTON_ROW_STACK_FONT_SCALE
  styles.useVariants({ stacked })

  return (
    <View style={styles.row}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={styles.cell}>
          {child}
        </View>
      ))}
    </View>
  )
}
