/** Shared, platform-independent organization and permission rules. */
export type Position = [number, number]
export type Coverage =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }
export interface Organization {
  id: string
  name: string
  active: boolean
  coverage: Coverage
}
export interface Catalog {
  version: string
  organizations: Organization[]
}
export interface SharingFields {
  name: boolean
  email: boolean
  phone: boolean
  catDetails: boolean
  preciseLocation: boolean
  photos: boolean
}
export interface SharingSettings {
  fields: SharingFields
  name: string
  phone: string
}
export const DEFAULT_CACHE_RADIUS_KM = 50
export const DEFAULT_SHARING: SharingSettings = {
  fields: {
    name: false,
    email: false,
    phone: false,
    catDetails: false,
    preciseLocation: false,
    photos: false,
  },
  name: '',
  phone: '',
}
export const SHARING_FIELD_KEYS = Object.keys(
  DEFAULT_SHARING.fields,
) as (keyof SharingFields)[]
/** Fields that identify the observer; Anonymous suppresses all of them. */
export const CONTACT_FIELDS = ['name', 'email', 'phone'] as const
export interface GrantRequest {
  contactEmail?: string | null
  submissionId: string
  organizationId: string
  catalogVersion: string
  epoch: number
  anonymous: boolean
  settings: SharingSettings
  disclosureVersion: 1
}
export interface Permission {
  submissionId: string
  organizationId: string
  organizationName: string
  catalogVersion: string
  epoch: number
  confirmedAt: string
  revokedAt?: string
  anonymous: boolean
  fields: SharingFields
  injured: boolean
  disclosureVersion: 1
  data: {
    catCount: number
    generalLocation: {
      south: number
      west: number
      north: number
      east: number
    }
    contact?: { name?: string; email?: string; phone?: string }
    preciseLocation?: Location
    cats?: Record<string, string>[]
    photoPaths?: string[]
  }
}
export interface PermissionLedger {
  blockedOrganizations?: Record<string, string>
  revokedPairs?: string[]
  epochs: Record<string, number>
  permissions: Permission[]
}
export interface Location {
  latitude: number
  longitude: number
}
export function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(value) &&
    !Object.hasOwn(Object.prototype, value) &&
    value !== 'prototype'
  )
}
export function validLocation(value: {
  latitude?: unknown
  longitude?: unknown
}): value is Location {
  const { latitude, longitude } = value
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  )
}
function polygonsOf(coverage: Coverage): Position[][][] {
  return coverage.type === 'Polygon'
    ? [coverage.coordinates]
    : coverage.coordinates
}
function relativeLongitude(longitude: number, origin: number): number {
  return ((longitude - origin + 540) % 360) - 180
}
// Unwrap each segment relative to the tested point, including dateline crossings.
function ringState(
  point: Position,
  ring: Position[],
): 'inside' | 'outside' | 'boundary' {
  let inside = false
  let ax = relativeLongitude(ring[0][0], point[0])
  let ay = ring[0][1] - point[1]
  for (let i = 0; i < ring.length - 1; i++) {
    const bx = ax + relativeLongitude(ring[i + 1][0], ring[i][0])
    const by = ring[i + 1][1] - point[1]
    const cross = ax * by - bx * ay
    if (Math.abs(cross) < 1e-10 && ax * bx <= 0 && ay * by <= 0)
      return 'boundary'
    if (ay > 0 !== by > 0 && ax + ((bx - ax) * -ay) / (by - ay) > 0)
      inside = !inside
    ax = bx
    ay = by
  }
  return inside ? 'inside' : 'outside'
}
export function covers(
  coverage: Coverage,
  latitude: number,
  longitude: number,
): boolean {
  if (!validLocation({ latitude, longitude })) return false
  return polygonsOf(coverage).some(
    ([outer, ...holes]) =>
      ringState([longitude, latitude], outer) !== 'outside' &&
      holes.every(
        (hole) => ringState([longitude, latitude], hole) === 'outside',
      ),
  )
}
/** Conservative cache envelope: includes intersecting areas, never center-only matching. */
export function nearby(
  organization: Organization,
  latitude: number,
  longitude: number,
  radiusKm: number,
): boolean {
  if (covers(organization.coverage, latitude, longitude)) return true
  const latSpan = radiusKm / 110.5
  const lonSpan = Math.min(
    180,
    radiusKm / (110.5 * Math.max(0.001, Math.cos((latitude * Math.PI) / 180))),
  )
  return polygonsOf(organization.coverage).some(([outer]) => {
    const xs = outer.map((p) => relativeLongitude(p[0], longitude))
    const ys = outer.map((p) => p[1] - latitude)
    return (
      Math.min(...xs) <= lonSpan &&
      Math.max(...xs) >= -lonSpan &&
      Math.min(...ys) <= latSpan &&
      Math.max(...ys) >= -latSpan
    )
  })
}
// All rings in one polygon use the same longitude origin, including across the dateline.
function planarRing(ring: Position[], origin: number): Position[] {
  let x = relativeLongitude(ring[0][0], origin)
  return ring.map((point, index) => {
    if (index) x += relativeLongitude(point[0], ring[index - 1][0])
    return [x, point[1]]
  })
}
function segmentsIntersect(
  a: Position,
  b: Position,
  c: Position,
  d: Position,
): boolean {
  const epsilon = 1e-10
  if (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0]) - epsilon ||
    Math.max(c[0], d[0]) < Math.min(a[0], b[0]) - epsilon ||
    Math.max(a[1], b[1]) < Math.min(c[1], d[1]) - epsilon ||
    Math.max(c[1], d[1]) < Math.min(a[1], b[1]) - epsilon
  )
    return false
  const orientation = (p: Position, q: Position, r: Position) => {
    const cross = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return Math.abs(cross) < epsilon ? 0 : Math.sign(cross)
  }
  return (
    orientation(a, b, c) * orientation(a, b, d) <= 0 &&
    orientation(c, d, a) * orientation(c, d, b) <= 0
  )
}
function validatePolygon(polygon: Position[][]): void {
  const rings = polygon.map((ring) => planarRing(ring, polygon[0][0][0]))
  for (const ring of rings)
    for (let i = 0; i < ring.length - 1; i++)
      if (ring[i][0] === ring[i + 1][0] && ring[i][1] === ring[i + 1][1])
        throw new Error('Repeated ring vertex')
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      for (let j = i + 2; j < ring.length - 1; j++) {
        if (i === 0 && j === ring.length - 2) continue
        if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1]))
          throw new Error('Self-intersecting ring')
      }
    }
  }
  for (let hole = 1; hole < polygon.length; hole++) {
    if (ringState(polygon[hole][0], polygon[0]) !== 'inside')
      throw new Error('Hole outside coverage')
    for (let previous = 0; previous < hole; previous++) {
      if (
        previous > 0 &&
        (ringState(polygon[hole][0], polygon[previous]) !== 'outside' ||
          ringState(polygon[previous][0], polygon[hole]) !== 'outside')
      )
        throw new Error('Overlapping coverage holes')
      for (let i = 0; i < rings[hole].length - 1; i++) {
        for (let j = 0; j < rings[previous].length - 1; j++) {
          if (
            segmentsIntersect(
              rings[hole][i],
              rings[hole][i + 1],
              rings[previous][j],
              rings[previous][j + 1],
            )
          )
            throw new Error('Intersecting coverage rings')
        }
      }
    }
  }
}
/** Rejects malformed catalog data before it reaches geographic predicates. */
export function parseCatalog(input: unknown): Catalog {
  const catalog = input as Catalog
  if (
    !catalog ||
    typeof catalog.version !== 'string' ||
    !catalog.version ||
    !Array.isArray(catalog.organizations) ||
    catalog.organizations.length > 10000
  )
    throw new Error('Invalid organization catalog')
  const ids = new Set<string>()
  for (const org of catalog.organizations) {
    if (
      !org ||
      !validId(org.id) ||
      ids.has(org.id) ||
      typeof org.name !== 'string' ||
      !org.name.trim() ||
      org.name.length > 200 ||
      typeof org.active !== 'boolean' ||
      !org.coverage ||
      !['Polygon', 'MultiPolygon'].includes(org.coverage.type)
    )
      throw new Error('Invalid organization')
    ids.add(org.id)
    const polygons = polygonsOf(org.coverage)
    if (!Array.isArray(polygons) || !polygons.length)
      throw new Error('Invalid coverage')
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length)
        throw new Error('Invalid polygon')
      for (const ring of polygon) {
        if (
          !Array.isArray(ring) ||
          ring.length < 4 ||
          ring.length > 10000 ||
          ring.some(
            (p) =>
              !Array.isArray(p) ||
              p.length !== 2 ||
              !validLocation({ latitude: p[1], longitude: p[0] }),
          )
        )
          throw new Error('Invalid ring')
        if (
          ring[0][0] !== ring[ring.length - 1][0] ||
          ring[0][1] !== ring[ring.length - 1][1]
        )
          throw new Error('Unclosed ring')
        const area = ring
          .slice(1)
          .reduce(
            (sum, p, i) =>
              sum +
              relativeLongitude(ring[i][0], ring[0][0]) * p[1] -
              relativeLongitude(p[0], ring[0][0]) * ring[i][1],
            0,
          )
        if (Math.abs(area) < 1e-10) throw new Error('Degenerate ring')
      }
      validatePolygon(polygon)
    }
  }
  return catalog
}
/** Fixed grid cells (~1.1 km north/south); never returns the source point. */
export function generalLocation(
  latitude: number,
  longitude: number,
): Permission['data']['generalLocation'] {
  const south = Math.min(89.99, Math.floor(latitude * 100) / 100)
  const west = Math.min(179.99, Math.floor(longitude * 100) / 100)
  return {
    south,
    west,
    north: +(south + 0.01).toFixed(2),
    east: +(west + 0.01).toFixed(2),
  }
}
const CAT_DETAIL_KEYS = [
  'age',
  'ear_tipped',
  'owned_domesticated',
  'pattern',
  'hair_length',
  'color',
  'sex',
  'health_label',
]
/** Explicit allowlist prevents internal IDs, URLs and boxes escaping as cat details. */
export function projectData(input: {
  cats: Record<string, unknown>[]
  location: Location
  photoPaths: string[]
  settings: SharingSettings
  anonymous: boolean
  email?: string
}): Permission['data'] {
  const { location } = input
  const { fields, name, phone } = effectiveSharingSettings(
    input.settings,
    input.anonymous,
  )
  const result: Permission['data'] = {
    catCount: input.cats.length,
    generalLocation: generalLocation(location.latitude, location.longitude),
  }
  const contact = {
    ...(name ? { name } : {}),
    ...(fields.email && input.email ? { email: input.email } : {}),
    ...(phone ? { phone } : {}),
  }
  if (Object.keys(contact).length) result.contact = contact
  if (fields.preciseLocation)
    result.preciseLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
    }
  if (fields.catDetails)
    result.cats = input.cats.map((cat) =>
      Object.fromEntries(
        CAT_DETAIL_KEYS.filter((key) => typeof cat[key] === 'string').map(
          (key) => [key, cat[key] as string],
        ),
      ),
    )
  if (fields.photos) result.photoPaths = input.photoPaths
  return result
}

/** Removes contact values that were not offered by this submission. */
export function effectiveSharingSettings(
  settings: SharingSettings,
  anonymous: boolean,
): SharingSettings {
  const fields = { ...settings.fields }
  if (anonymous) for (const key of CONTACT_FIELDS) fields[key] = false
  return {
    fields,
    name: fields.name ? settings.name : '',
    phone: fields.phone ? settings.phone : '',
  }
}

/** The optional fields actually offered once Anonymous is applied. */
export function offeredFields(
  settings: SharingSettings,
  anonymous: boolean,
): (keyof SharingFields)[] {
  const { fields } = effectiveSharingSettings(settings, anonymous)
  return SHARING_FIELD_KEYS.filter((key) => fields[key])
}
