import {
  createSubmissionCache,
  deleteSubmissionCache,
  getAllSubmissionCaches,
  getSubmissionCache,
  transitionSubmission,
  updateSubmissionCache,
} from '../submissionCache'

/**
 * Each cache mutation is a read-modify-write across separate storage calls.
 * Draft sync writes during Submit; run concurrently, a write built on an
 * older read put a sent row back to 'In Progress', and two index writes
 * dropped an id so a row vanished from Reports.
 */

const meta = { location_method: 'device', time_method: 'device' } as const

it('a concurrent draft sync never undoes a status write', async () => {
  await createSubmissionCache('row-1', meta)
  await Promise.all([
    updateSubmissionCache('row-1', { cats: [] }, ['In Progress', 'Failed']),
    updateSubmissionCache('row-1', { status: 'Submitted' }),
    updateSubmissionCache('row-1', { photos: [] }, ['In Progress', 'Failed']),
  ])
  expect((await getSubmissionCache('row-1'))?.status).toBe('Submitted')
})

it('concurrent creates and deletes keep every surviving row listed', async () => {
  await Promise.all([
    createSubmissionCache('row-a', meta),
    createSubmissionCache('row-b', meta),
    createSubmissionCache('row-c', meta),
  ])
  await Promise.all([
    deleteSubmissionCache('row-b'),
    createSubmissionCache('row-d', meta),
  ])
  const ids = (await getAllSubmissionCaches()).map((row) => row.id).sort()
  expect(ids).toEqual(expect.arrayContaining(['row-a', 'row-c', 'row-d']))
  expect(ids).not.toContain('row-b')
})

// The status machine has one owner: an illegal move (a sent row back to
// 'In Progress', a finished row re-sent) is refused, not written.
it.each([
  ['In Progress', 'Sending', true],
  ['Failed', 'Sending', true],
  ['Sending', 'Submitted', true],
  ['Sending', 'Failed', true],
  ['In Progress', 'Submitted', false],
  ['Submitted', 'Sending', false],
  ['Submitted', 'Failed', false],
  ['Failed', 'Submitted', false],
] as const)('%s → %s allowed: %s', async (from, to, allowed) => {
  await createSubmissionCache('row-t', meta)
  if (from !== 'In Progress') {
    await updateSubmissionCache('row-t', { status: from })
  }
  const written = await transitionSubmission('row-t', to)
  expect(written?.status ?? null).toBe(allowed ? to : null)
  expect((await getSubmissionCache('row-t'))?.status).toBe(allowed ? to : from)
})
