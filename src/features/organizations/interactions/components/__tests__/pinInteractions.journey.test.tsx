import {
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { PinInteractions } from '@/src/features/organizations/interactions/components/PinInteractions'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { fakeOrganizationsService } from '@/src/test-utils/organizationsService'
import { queryWrapper } from '@/src/test-utils/queryClient'
import {
  REACTIONS,
  type PinComment,
} from '@/functions/src/organizations/interactions/domain'

const PIN = 'a'.repeat(64)

/**
 * A small in-memory server: idempotent by mutation id, like the real one.
 * The first comment post loses its response, so the app must retry with the
 * same mutation id instead of creating a duplicate.
 */
async function serve() {
  const comments: (PinComment & { mutationId?: string })[] = [
    {
      id: 'b'.repeat(64),
      body: 'Seen at dusk.',
      createdAt: '2026-11-09T00:00:00Z',
      author: null,
      mine: false,
    },
  ]
  const hearts = new Set<string>()
  let lostResponses = 1
  const reactions = () =>
    REACTIONS.map(({ key }) => ({
      key,
      count: key === 'heart' ? hearts.size : 0,
      mine: key === 'heart' && hearts.has('me'),
    }))
  const service = await fakeOrganizationsService((body) => {
    if (body.id !== PIN) return { status: 400 }
    switch (body.action) {
      case 'pinComments':
        // A copy, as JSON over HTTP would be.
        return {
          status: 200,
          body: {
            comments: JSON.parse(JSON.stringify(comments)),
            cursor: null,
          },
        }
      case 'pinReactions':
        return { status: 200, body: { reactions: reactions() } }
      case 'setPinReaction':
        if (body.active) hearts.add('me')
        else hearts.delete('me')
        return { status: 200, body: { reactions: reactions() } }
      case 'addPinComment': {
        if (typeof body.mutationId !== 'string') return { status: 400 }
        if (!comments.some((c) => c.mutationId === body.mutationId))
          comments.push({
            id: String(comments.length).repeat(64).slice(0, 64),
            body: String(body.body),
            createdAt: '2026-11-09T01:00:00Z',
            author: 'Me',
            mine: true,
            mutationId: String(body.mutationId),
          })
        if (lostResponses-- > 0) return { status: 503 }
        return { status: 200, body: { comment: comments.at(-1) } }
      }
      case 'deletePinComment': {
        const index = comments.findIndex((c) => c.id === body.commentId)
        if (index >= 0) comments.splice(index, 1)
        return { status: 200, body: { deleted: true } }
      }
      default:
        return { status: 400 }
    }
  })
  return { ...service, comments }
}

test('a member reacts, retries a lost comment once, and deletes only their own', async () => {
  const user = userEvent.setup()
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: true })
  const service = await serve()
  await renderRouter(
    {
      index: () => <PinInteractions organizationId="org" pinId={PIN} />,
    },
    { wrapper: queryWrapper().wrapper },
  )

  // A retained comment from someone who can no longer be named.
  expect(await screen.findByText('Seen at dusk.')).toBeOnTheScreen()
  expect(screen.getByText('Former member')).toBeOnTheScreen()
  expect(
    screen.queryByRole('button', { name: 'Delete your comment' }),
  ).toBeNull()

  await user.press(await screen.findByRole('button', { name: 'Heart, 0' }))
  const heart = await screen.findByRole('button', { name: 'Heart, 1' })
  expect(heart).toBeSelected()
  await user.press(heart)
  expect(
    await screen.findByRole('button', { name: 'Heart, 0' }),
  ).toBeOnTheScreen()

  await user.type(screen.getByLabelText('Add a comment'), 'Two kittens fed')
  await user.press(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByRole('alert')).toBeOnTheScreen()
  expect(
    within(screen.getByTestId('pin-comment-composer')).getByRole('alert'),
  ).toBeOnTheScreen()
  // The typed text survives the failure, and the retry reuses its mutation id.
  await user.press(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByText('Two kittens fed')).toBeOnTheScreen()
  const posts = service.requests.filter((r) => r.action === 'addPinComment')
  expect(posts).toHaveLength(2)
  expect(posts[1].mutationId).toBe(posts[0].mutationId)
  expect(service.comments.filter((c) => c.mine)).toHaveLength(1)
  expect(screen.getByText('You')).toBeOnTheScreen()
  expect(screen.getByLabelText('Add a comment')).toHaveDisplayValue('')

  await user.press(screen.getByRole('button', { name: 'Delete your comment' }))
  await waitFor(() => expect(screen.queryByText('Two kittens fed')).toBeNull())
  expect(screen.getByText('Seen at dusk.')).toBeOnTheScreen()
})
