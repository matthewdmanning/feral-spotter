import type { CacheStatus } from '@/src/lib/cache/submissionCache';
import { CheckCircle, Clock, Send, XCircle } from 'lucide-react-native';
import { useStyles } from 'react-native-unistyles';
import { STATUS_COLOR_KEY, stylesheet } from './StatusIcon.styles';

interface StatusIconProps { status: CacheStatus; size?: number }

export function StatusIcon({ status, size = 20 }: StatusIconProps) {
  const { theme } = useStyles(stylesheet)
  const color = theme.colors[STATUS_COLOR_KEY[status]]
  switch (status) {
    case 'In Progress': return <Clock size={size} color={color} />
    case 'Sending': return <Send size={size} color={color} />
    case 'Submitted': return <CheckCircle size={size} color={color} />
    case 'Failed': return <XCircle size={size} color={color} />
  }
}

export { STATUS_COLOR_KEY };

