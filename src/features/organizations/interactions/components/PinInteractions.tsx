import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import { usePinInteractionsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { styles as common } from '@/src/features/organizations/components/styles'
import { usePinInteractions } from '@/src/features/organizations/interactions/hooks/usePinInteractions'
import { pinInteractionCopy as copy } from '@/src/features/organizations/interactions/copy'
import {
  COMMENT_MAX_LENGTH,
  REACTIONS,
  type PinComment,
} from '@/functions/src/organizations/interactions/domain'
import { styles } from './styles'

interface PinInteractionsProps {
  organizationId: string
  pinId: string
}

/** Reactions and comment thread for one shared pin. */
export function PinInteractions(props: PinInteractionsProps) {
  const enabled = usePinInteractionsFlag()
  return enabled ? <EnabledPinInteractions {...props} /> : null
}

function EnabledPinInteractions({
  organizationId,
  pinId,
}: PinInteractionsProps) {
  const pin = usePinInteractions(organizationId, pinId)
  const [text, setText] = useState('')
  const counts = new Map(pin.reactions.map((r) => [r.key, r]))
  const renderComment = (comment: PinComment) => (
    <View key={comment.id} style={styles.comment}>
      <Text style={styles.author}>
        {comment.mine ? copy.you : (comment.author ?? copy.formerMember)}
      </Text>
      <Text style={common.body}>{comment.body}</Text>
      {comment.mine && (
        <TextButton
          tone="danger"
          disabled={!pin.ready}
          accessibilityLabel={copy.deleteOwnComment}
          onPress={() => {
            void pin.deleteComment(comment.id)
          }}
        >
          {pin.deletingId === comment.id ? copy.deleting : copy.delete}
        </TextButton>
      )}
      {pin.deleteError?.commentId === comment.id && (
        <Text accessibilityRole="alert" style={common.body}>
          {pin.deleteError.message}
        </Text>
      )}
    </View>
  )
  return (
    <View style={styles.section}>
      <View style={styles.section} testID="pin-reactions">
        {pin.reactionsLoading && (
          <OrganizationLoading label={copy.loadingReactions} />
        )}
        {pin.reactionsKnown && (
          <View style={styles.reactions}>
            {REACTIONS.map(({ key, emoji, label }) => {
              const reaction = counts.get(key)
              const mine = !!reaction?.mine
              const count = reaction?.count ?? 0
              return (
                <Pressable
                  key={key}
                  disabled={!pin.reactionsReady}
                  onPress={() => {
                    void pin.toggleReaction(key, !mine)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${count}`}
                  accessibilityState={{
                    selected: mine,
                    disabled: !pin.reactionsReady,
                  }}
                  style={[styles.reaction, mine && styles.reactionSelected]}
                >
                  <Text
                    style={[
                      styles.reactionLabel,
                      mine && styles.reactionLabelSelected,
                    ]}
                  >{`${emoji} ${count}`}</Text>
                </Pressable>
              )
            })}
          </View>
        )}
        {pin.reacting && <OrganizationLoading label={copy.updatingReaction} />}
        {!!pin.reactionError && (
          <View>
            <Text accessibilityRole="alert" style={common.body}>
              {pin.reactionError}
            </Text>
            <TextButton
              disabled={pin.reactionsBusy}
              onPress={() => {
                void pin.retryReactions()
              }}
            >
              {copy.retryReactions}
            </TextButton>
          </View>
        )}
      </View>
      <Text style={common.title}>{copy.comments}</Text>
      {pin.initialLoading && (
        <OrganizationLoading label={copy.loadingComments} />
      )}
      {!pin.initialLoading &&
        !pin.threadError &&
        !pin.comments.length &&
        !pin.receipts.length && (
          <Text style={common.hint}>{copy.noComments}</Text>
        )}
      {pin.comments.map(renderComment)}
      {!!pin.threadError && (
        <Text accessibilityRole="alert" style={common.body}>
          {pin.threadError}
        </Text>
      )}
      {!!pin.cursor ? (
        <TextButton
          disabled={pin.commentsBusy}
          onPress={() => {
            void pin.loadMore()
          }}
        >
          {copy.loadMore}
        </TextButton>
      ) : (
        !!pin.threadError && (
          <TextButton
            disabled={pin.commentsBusy}
            onPress={() => {
              void pin.refreshComments()
            }}
          >
            {copy.retryComments}
          </TextButton>
        )
      )}
      {!!pin.receipts.length && (
        <View style={styles.section}>
          <Text style={common.hint}>{copy.posted}</Text>
          {pin.receipts.map(renderComment)}
        </View>
      )}
      <View style={styles.section} testID="pin-comment-composer">
        <TextField
          label={copy.addComment}
          value={text}
          onChangeText={setText}
          editable={!pin.posting}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          autoCapitalize="sentences"
        />
        {!!pin.postError && (
          <Text accessibilityRole="alert" style={common.body}>
            {pin.postError}
          </Text>
        )}
        <AppButton
          disabled={!pin.ready || !text.trim()}
          loading={pin.posting}
          onPress={() => {
            void pin.addComment(text).then((posted) => {
              if (posted) setText('')
            })
          }}
        >
          {copy.postComment}
        </AppButton>
      </View>
    </View>
  )
}
