/**
 * components/molecules/PhotoDraftNotice.tsx
 *
 * Why one photo entrypoint on Home is disabled, and the one action that frees
 * it. Reset (discard, after a confirmation owned by the caller) is always
 * offered. A draft restored from an earlier session also offers Finish (open
 * the report).
 */
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import type { PhotoSource } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { Text, View } from 'react-native'
import { styles } from './PhotoDraftNotice.styles'

type DraftOrigin = 'restored' | 'in-session'

const BLOCKED_ENTRYPOINT: Record<
  NonNullable<PhotoSource>,
  { used: string; blocked: string }
> = {
  camera: { used: 'camera', blocked: 'Upload Photos' },
  library: { used: 'library', blocked: 'Take Photos' },
}

function photoDraftNoticeCopy(
  source: NonNullable<PhotoSource>,
  origin: DraftOrigin,
): string {
  const { used, blocked } = BLOCKED_ENTRYPOINT[source]
  return origin === 'restored'
    ? `You have an unfinished submission with ${used} photos. Finish or reset it to use ${blocked}.`
    : `This submission uses ${used} photos. Reset it to use ${blocked}.`
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
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{photoDraftNoticeCopy(source, origin)}</Text>
      <View style={styles.actions}>
        {origin === 'restored' && (
          <AppButton onPress={onFinish} variant="primary" size="compact">
            Finish
          </AppButton>
        )}
        <AppButton onPress={onReset} variant="danger" size="compact">
          Reset
        </AppButton>
      </View>
    </View>
  )
}
