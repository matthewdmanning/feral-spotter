import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { OrganizationLoading } from '@/src/features/organizations/components/OrganizationLoading'
import { styles as common } from '@/src/features/organizations/components/styles'
import { usePinInteractions } from '@/src/features/organizations/interactions/hooks/usePinInteractions'
import {
  COMMENT_MAX_LENGTH,
  REACTIONS,
} from '@/functions/src/organizations/interactions/domain'
import { styles } from './styles'

/** Reactions and comment thread for one shared pin. */
export function PinInteractions({
  organizationId,
  pinId,
}: {
  organizationId: string
  pinId: string
}) {
  const pin = usePinInteractions(organizationId, pinId)
  const [text, setText] = useState('')
  const counts = new Map(pin.reactions.map((r) => [r.key, r]))
  return (
    <View style={styles.section}>
      <View style={styles.reactions}>
        {REACTIONS.map(({ key, emoji, label }) => {
          const reaction = counts.get(key)
          const mine = !!reaction?.mine
          const count = reaction?.count ?? 0
          return (
            <Pressable
              key={key}
              disabled={!pin.ready}
              onPress={() => {
                void pin.toggleReaction(key, !mine)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${count}`}
              accessibilityState={{ selected: mine, disabled: !pin.ready }}
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
      <Text style={common.title}>Comments</Text>
      {pin.initialLoading && <OrganizationLoading label="Loading comments…" />}
      {!!pin.error && (
        <Text accessibilityRole="alert" style={common.body}>
          {pin.error}
        </Text>
      )}
      {!pin.initialLoading && !pin.error && !pin.comments.length && (
        <Text style={common.hint}>No comments yet.</Text>
      )}
      {pin.comments.map((comment) => (
        <View key={comment.id} style={styles.comment}>
          <Text style={styles.author}>
            {comment.mine ? 'You' : (comment.author ?? 'Former member')}
          </Text>
          <Text style={common.body}>{comment.body}</Text>
          {comment.mine && (
            <TextButton
              tone="danger"
              disabled={!pin.ready}
              accessibilityLabel="Delete your comment"
              onPress={() => {
                void pin.deleteComment(comment.id)
              }}
            >
              Delete
            </TextButton>
          )}
        </View>
      ))}
      {!!pin.cursor && (
        <TextButton
          onPress={() => {
            void pin.loadMore()
          }}
        >
          Load more comments
        </TextButton>
      )}
      <TextField
        label="Add a comment"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={COMMENT_MAX_LENGTH}
        autoCapitalize="sentences"
      />
      <AppButton
        disabled={!pin.ready || !text.trim()}
        loading={pin.busy}
        onPress={() => {
          void pin.addComment(text).then((posted) => {
            if (posted) setText('')
          })
        }}
      >
        Post comment
      </AppButton>
    </View>
  )
}
