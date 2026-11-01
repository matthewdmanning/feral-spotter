import type { CacheStatus } from '@/src/features/draft-submission/lib/submissionCache'
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle'
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock'
import { PaperPlaneRightIcon } from 'phosphor-react-native/src/icons/PaperPlaneRight'
import { XCircleIcon } from 'phosphor-react-native/src/icons/XCircle'
import { useUnistyles } from 'react-native-unistyles'
import { STATUS_COLOR_KEY } from './StatusIcon.styles'

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

export { STATUS_COLOR_KEY }
