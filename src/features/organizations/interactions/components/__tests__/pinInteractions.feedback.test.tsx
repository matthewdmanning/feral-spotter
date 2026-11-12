import {
  act,
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
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const reactionState = () =>
  REACTIONS.map(({ key }) => ({
    key,
    count: key === 'heart' ? 1 : 0,
    mine: key === 'heart',
  }))
async function mount() {
  const query = queryWrapper()
  await renderRouter(
    { index: () => <PinInteractions organizationId="org" pinId={PIN} /> },
    { wrapper: query.wrapper },
  )
  return query.client
}
beforeEach(() => {
  useAuthStore.setState({ user: { uid: 'member', email: null }, isReady: true })
  useUIStore.setState({ isOnline: true })
  useOrganizationsFlag.setState({ enabled: true })
})

test('a delayed post locks only the submitted draft, then restores the composer', async () => {
  const gate = deferred()
  const user = userEvent.setup()
  const service = await fakeOrganizationsService(async (body) => {
    if (body.action === 'pinComments')
      return { status: 200, body: { comments: [], cursor: null } }
    if (body.action === 'pinReactions')
      return { status: 200, body: { reactions: reactionState() } }
    if (body.action === 'addPinComment') {
      await gate.promise
      return {
        status: 200,
        body: { comment: { id: 'new', body: body.body, mine: true } },
      }
    }
    return { status: 400 }
  })
  await mount()
  await screen.findByText('No comments yet.')
  const input = screen.getByLabelText('Add a comment')
  await user.type(input, 'Original')
  await user.press(screen.getByRole('button', { name: 'Post comment' }))
  await waitFor(() =>
    expect(service.requests.some((r) => r.action === 'addPinComment')).toBe(
      true,
    ),
  )
  expect(input).toHaveProp('editable', false)
  await user.type(input, ' plus unsent details')
  expect(input).toHaveDisplayValue('Original')
  gate.resolve()
  await waitFor(() => expect(input).toHaveDisplayValue(''))
  expect(input).toHaveProp('editable', true)
  expect(service.requests.find((r) => r.action === 'addPinComment')?.body).toBe(
    'Original',
  )
})

test('a confirmed comment stays visible through a failed refresh and joins its page without duplication', async () => {
  const user = userEvent.setup()
  let refreshFails = false
  const comments: PinComment[] = Array.from({ length: 50 }, (_, i) => ({
    id: String(i),
    body: `Earlier comment ${i}`,
    createdAt: '2026-11-09T00:00:00Z',
    author: 'Member',
    mine: false,
  }))
  await fakeOrganizationsService((body) => {
    if (body.action === 'pinComments') {
      if (refreshFails) return { status: 503 }
      return {
        status: 200,
        body: {
          comments: body.cursor ? comments.slice(50) : comments.slice(0, 50),
          cursor: body.cursor ? null : 'next-page',
        },
      }
    }
    if (body.action === 'pinReactions')
      return { status: 200, body: { reactions: reactionState() } }
    if (body.action === 'addPinComment') {
      const comment = {
        id: 'new',
        body: String(body.body),
        createdAt: '2026-11-10T00:00:00Z',
        author: 'Me',
        mine: true,
      }
      comments.push(comment)
      refreshFails = true
      return { status: 200, body: { comment } }
    }
    return { status: 400 }
  })
  await mount()
  await screen.findByText('Earlier comment 0')
  await user.type(screen.getByLabelText('Add a comment'), 'Just posted')
  await user.press(screen.getByRole('button', { name: 'Post comment' }))
  await waitFor(() =>
    expect(screen.getByLabelText('Add a comment')).toHaveDisplayValue(''),
  )
  expect(await screen.findByText('Just posted')).toBeOnTheScreen()
  expect(screen.getByText('Posted')).toBeOnTheScreen()
  expect(await screen.findByRole('alert')).toBeOnTheScreen()
  refreshFails = false
  await user.press(screen.getByRole('button', { name: 'Load more comments' }))
  await waitFor(() => expect(screen.queryByText('Posted')).toBeNull())
  expect(screen.getAllByText('Just posted')).toHaveLength(1)
})

test('reactions wait for known state, retain counts on refresh failure, and clear on lost access', async () => {
  const gate = deferred()
  const user = userEvent.setup()
  let readStatus = 200
  const service = await fakeOrganizationsService(async (body) => {
    if (body.action === 'pinComments')
      return { status: 200, body: { comments: [], cursor: null } }
    if (body.action === 'pinReactions') {
      await gate.promise
      return {
        status: readStatus,
        body: readStatus === 200 ? { reactions: reactionState() } : undefined,
      }
    }
    if (body.action === 'setPinReaction')
      return { status: 200, body: { reactions: reactionState() } }
    return { status: 400 }
  })
  const client = await mount()
  await screen.findByText('No comments yet.')
  expect(screen.queryByRole('button', { name: 'Heart, 0' })).toBeNull()
  expect(screen.getByText('Loading reactions…')).toBeOnTheScreen()
  gate.resolve()
  const heart = await screen.findByRole('button', { name: 'Heart, 1' })
  expect(heart).toBeSelected()
  await user.press(heart)
  await waitFor(() =>
    expect(
      service.requests.find((r) => r.action === 'setPinReaction')?.active,
    ).toBe(false),
  )
  readStatus = 503
  await client.refetchQueries({
    queryKey: ['organizations', 'member', 'org', 'pinReactions'],
  })
  expect(await screen.findByRole('alert')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Heart, 1' })).toBeEnabled()
  readStatus = 403
  await user.press(screen.getByRole('button', { name: 'Retry reactions' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Heart, 1' })).toBeNull(),
  )
  expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled()
})

test('post and reaction failures stay beside their controls and recover independently', async () => {
  const user = userEvent.setup()
  await fakeOrganizationsService((body) => {
    if (body.action === 'pinComments')
      return { status: 200, body: { comments: [], cursor: null } }
    if (body.action === 'pinReactions')
      return { status: 200, body: { reactions: reactionState() } }
    return { status: 503 }
  })
  await mount()
  await user.type(screen.getByLabelText('Add a comment'), 'Still here')
  await user.press(screen.getByRole('button', { name: 'Post comment' }))
  const composer = within(screen.getByTestId('pin-comment-composer'))
  expect(await composer.findByRole('alert')).toBeOnTheScreen()
  expect(screen.getByLabelText('Add a comment')).toHaveDisplayValue(
    'Still here',
  )
  expect(screen.getByLabelText('Add a comment')).toHaveProp('editable', true)
  await user.press(screen.getByRole('button', { name: 'Heart, 1' }))
  const reactions = within(screen.getByTestId('pin-reactions'))
  expect(await reactions.findByRole('alert')).toBeOnTheScreen()
  expect(composer.getByRole('alert')).toBeOnTheScreen()
  await user.press(reactions.getByRole('button', { name: 'Retry reactions' }))
  await waitFor(() => expect(reactions.queryByRole('alert')).toBeNull())
  expect(composer.getByRole('alert')).toBeOnTheScreen()
})

test('a late post response cannot restore a cleared receipt, and retry keeps its identity', async () => {
  const gate = deferred()
  const user = userEvent.setup()
  const stored = new Map<string, PinComment>()
  let posts = 0
  const service = await fakeOrganizationsService(async (body) => {
    if (body.action === 'pinComments')
      return { status: 200, body: { comments: [], cursor: null } }
    if (body.action === 'pinReactions')
      return { status: 200, body: { reactions: reactionState() } }
    if (body.action === 'addPinComment') {
      const mutationId = String(body.mutationId)
      if (!stored.has(mutationId))
        stored.set(mutationId, {
          id: mutationId,
          body: String(body.body),
          createdAt: '2026-11-12T00:00:00Z',
          author: 'Me',
          mine: true,
        })
      if (posts++ === 0) await gate.promise
      return { status: 200, body: { comment: stored.get(mutationId) } }
    }
    return { status: 400 }
  })
  await mount()
  await user.type(screen.getByLabelText('Add a comment'), 'Delayed')
  await user.press(screen.getByRole('button', { name: 'Post comment' }))
  await waitFor(() => expect(stored.size).toBe(1))
  await act(async () => {
    useUIStore.setState({ isOnline: false })
  })
  await act(async () => {
    useUIStore.setState({ isOnline: true })
  })
  gate.resolve()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeEnabled(),
  )
  expect(screen.queryByText('Posted')).toBeNull()
  expect(screen.queryByText('Delayed')).toBeNull()
  expect(screen.getByLabelText('Add a comment')).toHaveDisplayValue('Delayed')
  await user.press(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByText('Posted')).toBeOnTheScreen()
  expect(stored.size).toBe(1)
  const writes = service.requests.filter(
    (request) => request.action === 'addPinComment',
  )
  expect(writes).toHaveLength(2)
  expect(writes[0].mutationId).toBe(writes[1].mutationId)
  await act(async () => {
    useUIStore.setState({ isOnline: false })
  })
  expect(screen.queryByText('Posted')).toBeNull()
  await act(async () => {
    useUIStore.setState({ isOnline: true })
  })
  expect(screen.queryByText('Posted')).toBeNull()
})
