import { ActivityIndicator, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './styles'

export function OrganizationLoading({
  label = 'Loading organizations…',
}: {
  label?: string
}) {
  const { theme } = useUnistyles()
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={styles.card}
    >
      <ActivityIndicator color={theme.colors.text} accessibilityLabel={label} />
      <Text style={styles.body}>{label}</Text>
    </View>
  )
}
