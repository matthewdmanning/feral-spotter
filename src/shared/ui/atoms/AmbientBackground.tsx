import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './AmbientBackground.styles'

/**
 * The backdrop that glass surfaces sit on: soft pools of colored light over
 * the page color. Render it as the first child of a screen's root view; it
 * fills the root and takes no touches.
 */
export function AmbientBackground() {
  const { theme } = useUnistyles()
  return (
    <View
      pointerEvents="none"
      style={[
        styles.fill,
        { experimental_backgroundImage: theme.gradients.ambient },
      ]}
    />
  )
}
