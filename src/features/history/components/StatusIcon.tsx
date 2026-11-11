import type { CacheStatus } from '@/src/shared/lib/submissionCache'
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle'
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock'
import { PaperPlaneRightIcon } from 'phosphor-react-native/src/icons/PaperPlaneRight'
import { XCircleIcon } from 'phosphor-react-native/src/icons/XCircle'
import { Text } from '@/src/shared/ui/atoms/Text'
import {
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { STATUS_COLOR_KEY } from './StatusIcon.constants'

interface StatusIconProps {
  status: CacheStatus
  size?: number
}

export function StatusIcon({ status, size = 20 }: StatusIconProps) {
  const { theme } = useUnistyles()
  const color = theme.colors[STATUS_COLOR_KEY[status]]
  switch (status) {
    case 'In Progress':
      return <ClockIcon size={size} color={color} />
    case 'Sending':
      return <PaperPlaneRightIcon size={size} color={color} />
    case 'Submitted':
      return <CheckCircleIcon size={size} color={color} />
    case 'Failed':
      return <XCircleIcon size={size} color={color} />
    default:
      return null
  }
}

/** The status word in its status colour. Typography comes from `style`. */
export function StatusText({
  status,
  style,
}: {
  status: CacheStatus
  style?: StyleProp<TextStyle>
}) {
  const { theme } = useUnistyles()
  return (
    <Text style={[style, { color: theme.colors[STATUS_COLOR_KEY[status]] }]}>
      {status}
    </Text>
  )
}

/** A dot in the status colour, for a legend. Size and shape from `style`. */
export function StatusDot({
  status,
  style,
}: {
  status: CacheStatus
  style?: StyleProp<ViewStyle>
}) {
  const { theme } = useUnistyles()
  return (
    <View
      style={[
        style,
        { backgroundColor: theme.colors[STATUS_COLOR_KEY[status]] },
      ]}
    />
  )
}
