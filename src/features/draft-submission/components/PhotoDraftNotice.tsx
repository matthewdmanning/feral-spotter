/**
 * features/draft-submission/components/PhotoDraftNotice.tsx
 *
 * Why one photo entrypoint on Home is disabled, and the one action that frees
 * it. Reset (discard, after a confirmation owned by the caller) is always
 * offered. A draft restored from an earlier session also offers Finish (open
 * the report).
 */
import { commonCopy, submissionCopy } from '@/src/shared/config/text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import type { PhotoSource } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { Text } from '@/src/shared/ui/atoms/Text'
import { View } from 'react-native'
import { styles } from './PhotoDraftNotice.styles'

type DraftOrigin = 'restored' | 'in-session'

// One complete sentence per case (STYLE-3): no spliced nouns.
function photoDraftNoticeCopy(
  source: NonNullable<PhotoSource>,
  origin: DraftOrigin,
): string {
  const { photoNotice } = submissionCopy
  return origin === 'restored'
    ? photoNotice.restored[source]
    : photoNotice.inSession[source]
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
            {commonCopy.finish}
          </AppButton>
        )}
        <AppButton onPress={onReset} variant="danger" size="compact">
          {commonCopy.reset}
        </AppButton>
      </View>
    </View>
  )
}
