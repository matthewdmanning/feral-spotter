import {
  CONSENT_TOMBSTONE_RETENTION_DAYS,
  handleConsentRecords,
  retireConsentRecords,
  tombstoneKey,
  type ConsentEvent,
  type ConsentRecordDb,
  type ConsentSnapshot,
  type ConsentTombstone,
} from '../consentRecords'

/**
 * ADR-0009's rules over the ConsentRecordDb port (its Firestore adapter has
 * its own emulator test). Catches: a caller recording for another uid, a
 * malformed choice stored as proof, an erased account recreating records,
 * a tombstone that keeps identifying data or expires at the wrong time, and
 * an erasure retry that loses or duplicates history.
 */

function memoryDb(): ConsentRecordDb & {
  records: Map<string, ConsentEvent[]>
  tombstones: Map<string, ConsentTombstone>
} {
  const records = new Map<string, ConsentEvent[]>()
  const tombstones = new Map<string, ConsentTombstone>()
  return {
    records,
    tombstones,
    append: async (uid, event) => {
      if (tombstones.has(tombstoneKey(uid))) return false
      records.set(uid, [...(records.get(uid) ?? []), event])
      return true
    },
    snapshot: async (uid) => {
      const snapshot: ConsentSnapshot = {}
      for (const e of records.get(uid) ?? []) {
        snapshot[e.kind] = {
          granted: e.granted,
          version: e.version,
          chosenAt: e.chosenAt,
        }
      }
      return snapshot
    },
    events: async (uid) => records.get(uid) ?? [],
    tombstone: async (key) => tombstones.get(key) ?? null,
    beginRetirement: async (key, tombstone) => {
      if (!tombstones.has(key)) tombstones.set(key, tombstone)
      return tombstones.get(key)!.expireAt
    },
    retire: async (uid, key, tombstone) => {
      const existing = tombstones.get(key)!
      const events = new Map(
        [...existing.events, ...tombstone.events].map((event) => [
          JSON.stringify(event),
          event,
        ]),
      )
      tombstones.set(key, { ...existing, events: [...events.values()] })
      records.delete(uid)
    },
  }
}

const verify = async (token: string) => {
  if (token === 'bad') throw new Error('invalid token')
  return { uid: token }
}

const choice = {
  kind: 'analytics',
  granted: true,
  version: 2,
  chosenAt: '2026-11-25T10:00:00.000Z',
  platform: 'android',
  appVersion: '1.0.0',
}

const NOW = new Date('2026-11-25T12:00:00.000Z')

function post(db: ConsentRecordDb, body: unknown, token = 'u1') {
  return handleConsentRecords(
    { method: 'POST', authorization: `Bearer ${token}`, body },
    db,
    verify,
    () => NOW,
  )
}

describe('handleConsentRecords', () => {
  it('records under the token uid and returns it as current', async () => {
    const db = memoryDb()

    expect(await post(db, { ...choice, uid: 'someone-else' })).toEqual({
      status: 204,
    })
    const read = await handleConsentRecords(
      { method: 'GET', authorization: 'Bearer u1', body: undefined },
      db,
      verify,
    )

    expect(db.records.get('u1')).toEqual([
      { ...choice, recordedAt: NOW.toISOString() },
    ])
    expect(db.records.has('someone-else')).toBe(false)
    expect(read).toEqual({
      status: 200,
      body: {
        analytics: { granted: true, version: 2, chosenAt: choice.chosenAt },
      },
    })
  })

  it.each([
    ['unknown kind', { ...choice, kind: 'marketing' }],
    ['granted not boolean', { ...choice, granted: 'yes' }],
    ['fractional version', { ...choice, version: 1.5 }],
    ['unparseable chosenAt', { ...choice, chosenAt: 'yesterday' }],
    ['missing platform', { ...choice, platform: undefined }],
    ['oversized appVersion', { ...choice, appVersion: 'x'.repeat(65) }],
    ['no body', null],
  ])('refuses %s and stores nothing', async (_, body) => {
    const db = memoryDb()
    expect(await post(db, body)).toEqual({ status: 400 })
    expect(db.records.size).toBe(0)
  })

  it.each([
    ['no header', undefined],
    ['not Bearer', 'Basic u1'],
    ['invalid token', 'Bearer bad'],
  ])('refuses %s', async (_, authorization) => {
    const db = memoryDb()
    const result = await handleConsentRecords(
      { method: 'POST', authorization, body: choice },
      db,
      verify,
    )
    expect(result).toEqual({ status: 401 })
  })

  it('refuses an erased account so it cannot recreate records', async () => {
    const db = memoryDb()
    await post(db, choice)
    await retireConsentRecords('u1', db, NOW)

    expect(await post(db, choice)).toEqual({ status: 410 })
    expect(db.records.has('u1')).toBe(false)
  })
})

describe('retireConsentRecords', () => {
  it('keeps only a pseudonymous minimal history for three years', async () => {
    const db = memoryDb()
    await post(db, choice)
    await post(db, { ...choice, kind: 'email_updates', granted: false })

    await retireConsentRecords('u1', db, NOW)

    const tombstone = db.tombstones.get(tombstoneKey('u1'))
    expect(tombstoneKey('u1')).not.toContain('u1')
    expect(db.records.has('u1')).toBe(false)
    expect(JSON.stringify(tombstone)).not.toMatch(/u1|android|1\.0\.0/)
    expect(tombstone?.events.map((e) => [e.kind, e.granted])).toEqual([
      ['analytics', true],
      ['email_updates', false],
    ])
    const days =
      (tombstone!.expireAt.getTime() - NOW.getTime()) / (24 * 3600 * 1000)
    expect(days).toBe(CONSENT_TOMBSTONE_RETENTION_DAYS)
  })

  it('a retry after a partial delete neither loses nor duplicates history', async () => {
    const db = memoryDb()
    await post(db, choice)
    await post(db, { ...choice, kind: 'email_updates' })
    const events = [...db.records.get('u1')!]
    await retireConsentRecords('u1', db, NOW)
    // The delete was cut short: one event is still there.
    db.records.set('u1', [events[1]])

    await retireConsentRecords('u1', db, new Date('2026-12-01T00:00:00Z'))

    const tombstone = db.tombstones.get(tombstoneKey('u1'))!
    expect(tombstone.events).toHaveLength(2)
    expect(tombstone.erasedAt).toBe(NOW.toISOString())
  })

  it('blocks a first consent write once erasure starts', async () => {
    const db = memoryDb()
    const append = db.append
    db.append = async (uid, event) => {
      await retireConsentRecords(uid, db, NOW)
      return append(uid, event)
    }

    expect(await post(db, choice)).toEqual({ status: 410 })
    expect(db.tombstones.get(tombstoneKey('u1'))?.events).toEqual([])
    expect(db.records.size).toBe(0)
  })
})
