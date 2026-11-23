import type { ReactNode } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import { styles } from '@/src/features/organizations/components/styles'

/**
 * The state every organization screen opens with, in one order: signed out,
 * offline, first load, failure, then Refresh. Signed out shows only its notice.
 */
export function OrganizationQueryStatus({
  query,
  copy,
  onRefresh,
  refreshDisabled = false,
  children,
}: {
  query: {
    uid: string | undefined
    online: boolean
    initialLoading: boolean
    error: string
    busy: boolean
  }
  copy: { signIn: string; offline: string; loading: string; refresh: string }
  onRefresh: () => void
  refreshDisabled?: boolean
  /** Screen-specific notices, shown above Refresh. */
  children?: ReactNode
}) {
  if (!query.uid) return <Text style={styles.body}>{copy.signIn}</Text>
  return (
    <>
      {!query.online && <Text style={styles.body}>{copy.offline}</Text>}
      {query.initialLoading && <OrganizationLoading label={copy.loading} />}
      {!!query.error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {query.error}
        </Text>
      )}
      {children}
      <AppButton
        disabled={!query.online || refreshDisabled}
        loading={query.busy}
        onPress={onRefresh}
      >
        {copy.refresh}
      </AppButton>
    </>
  )
}
