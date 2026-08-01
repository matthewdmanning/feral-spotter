import {
  classifyLibraryPickTime,
  parseExifDateTime,
} from '../libraryPickTime'

// Purpose: EXIF `DateTime` is "YYYY:MM:DD HH:MM:SS" — `new Date()` cannot
// parse it directly (colons in the date segment), and `captured_at` must be
// a real ISO string or the backend silently records the wrong sighting time
// (ADR 0003). This is the landmine step in the whole Library-pick time flow.
describe('parseExifDateTime', () => {
  it('parses a valid EXIF DateTime into an ISO string', () => {
    const iso = parseExifDateTime('2024:03:15 14:30:00')
    expect(iso).toBe(new Date('2024-03-15T14:30:00').toISOString())
  })

  it('rejects a zeroed-clock EXIF DateTime ("no real timestamp")', () => {
    expect(parseExifDateTime('0000:00:00 00:00:00')).toBeUndefined()
  })

  it('rejects a malformed or missing DateTime', () => {
    expect(parseExifDateTime('not-a-date')).toBeUndefined()
    expect(parseExifDateTime(undefined)).toBeUndefined()
  })
})

// Purpose: ADR 0003's interim multi-select rule — every photo has EXIF time
// -> earliest wins; any one missing -> whole batch falls back to manual.
// Wrong here either silently drops a real timestamp (any-missing branch) or
// fabricates one (earliest-wins branch returning the wrong element).
describe('classifyLibraryPickTime', () => {
  it('picks the earliest timestamp when all photos have EXIF time, out of order', () => {
    const t1 = '2024-03-15T14:30:00.000Z'
    const t2 = '2024-01-01T00:00:00.000Z' // earliest, but not first in the array
    const t3 = '2024-06-01T00:00:00.000Z'

    expect(classifyLibraryPickTime([t1, t2, t3])).toEqual({
      time_type: 'device',
      captured_at: t2,
    })
  })

  it('falls back to manual when one of several photos is missing EXIF time', () => {
    const t1 = '2024-03-15T14:30:00.000Z'
    expect(classifyLibraryPickTime([t1, undefined])).toEqual({
      time_type: 'manual',
    })
  })

  it('classifies a single present-EXIF photo as device with its timestamp', () => {
    const t1 = '2024-03-15T14:30:00.000Z'
    expect(classifyLibraryPickTime([t1])).toEqual({
      time_type: 'device',
      captured_at: t1,
    })
  })

  it('classifies a single missing-EXIF photo as manual', () => {
    expect(classifyLibraryPickTime([undefined])).toEqual({
      time_type: 'manual',
    })
  })
})
