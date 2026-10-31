/**
 * components/molecules/PhotoDraftNotice.tsx
 *
 * Why one photo entrypoint on Home is disabled, and the one action that frees
 * it. A draft restored from an earlier session offers Finish (open the
 * report); a draft started this session offers Reset (discard, after a
 * confirmation owned by the caller).
 */
import { AppButton } from '@/src/components/atoms/AppButton'
import type { PhotoSource } from '@/src/hooks/usePhotoStore'
import { Text, View } from 'react-native'
import { styles } from './PhotoDraftNotice.styles'

export type DraftOrigin = 'restored' | 'in-session'

const BLOCKED_ENTRYPOINT: Record<
  NonNullable<PhotoSource>,
  { used: string; blocked: string }
> = {
  camera: { used: 'camera', blocked: 'Upload Photos' },
  library: { used: 'library', blocked: 'Take Photos' },
}

export function photoDraftNoticeCopy(
  source: NonNullable<PhotoSource>,
  origin: DraftOrigin,
): { message: string; actionLabel: string } {
  const { used, blocked } = BLOCKED_ENTRYPOINT[source]
  return origin === 'restored'
    ? {
        message: `You have an unfinished submission with ${used} photos. Finish it to use ${blocked}.`,
        actionLabel: 'Finish',
      }
    : {
        message: `This submission uses ${used} photos. Reset it to use ${blocked}.`,
        actionLabel: 'Reset',
      }
}

interface PhotoDraftNoticeProps {
  source: NonNullable<PhotoSource>
  origin: DraftOrigin
  onFinish: () => void
  onReset: () => void
}

export function PhotoDraftNotice({
  source,
  origin,
  onFinish,
  onReset,
}: PhotoDraftNoticeProps) {
  const { message, actionLabel } = photoDraftNoticeCopy(source, origin)
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <AppButton
        onPress={origin === 'restored' ? onFinish : onReset}
        variant={origin === 'restored' ? 'primary' : 'danger'}
        size="compact"
      >
        {actionLabel}
      </AppButton>
    </View>
  )
}
