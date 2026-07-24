/**
 * Validation-only upload route (issue #10): verifies the requester's Google
 * ID token, checks the tester allowlist, validates the uploaded file, then
 * writes it to GCS. No CV/ecological pipeline integration — deferred to v2.0.
 *
 * GCS auth uses Application Default Credentials (Storage() picks up the
 * Cloud Run service account automatically); see issue #36 if that changes.
 */
import { Storage } from '@google-cloud/storage'
import { OAuth2Client } from 'google-auth-library'

import { isAllowedEmail, parseAllowlist } from '@/src/lib/upload/allowlist'
import { validateUploadFile } from '@/src/lib/upload/fileValidation'

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? 'feral-segmentor-alpha'

const oauthClient = new OAuth2Client()
const storage = new Storage()

interface VerifiedRequester {
  email: string
}

async function verifyRequester(request: Request): Promise<VerifiedRequester | Response> {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 })
  }

  if (!GOOGLE_CLIENT_ID) {
    console.error('upload+api: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  let email: string | undefined
  let emailVerified: boolean | undefined
  try {
    const ticket = await oauthClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    email = payload?.email
    emailVerified = payload?.email_verified
  } catch {
    return Response.json({ error: 'Invalid ID token' }, { status: 401 })
  }

  if (!email || !emailVerified) {
    return Response.json({ error: 'Email not verified' }, { status: 403 })
  }

  const allowlist = parseAllowlist(process.env.TESTER_ALLOWLIST_EMAILS)
  if (!isAllowedEmail(email, allowlist)) {
    return Response.json({ error: 'Not on tester allowlist' }, { status: 403 })
  }

  return { email }
}

export async function POST(request: Request) {
  const requester = await verifyRequester(request)
  if (requester instanceof Response) return requester

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file field' }, { status: 400 })
  }

  const validation = validateUploadFile(file)
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: validation.status })
  }

  const objectName = `uploads/${requester.email}/${Date.now()}.${validation.extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await storage.bucket(BUCKET_NAME).file(objectName).save(buffer, {
      contentType: file.type,
      resumable: false,
    })
  } catch (error) {
    console.error('upload+api: GCS write failed', error)
    return Response.json({ error: 'Upload failed' }, { status: 502 })
  }

  return Response.json({ path: `gs://${BUCKET_NAME}/${objectName}` }, { status: 201 })
}
