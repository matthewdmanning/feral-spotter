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
const BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? 'feral-spotter-image-uploads'
// Duplicated from src/config/constants.ts, not imported — that file pulls in
// the RN-only `__DEV__` global, which tsconfig.server.json's compile
// boundary (this route only) doesn't declare. Keep the two in sync by hand.
const MAX_PHOTOS = Number(process.env.EXPO_PUBLIC_MAX_PHOTOS) || 10

// Object paths are built from this directly — restrict to safe path characters.
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const oauthClient = new OAuth2Client()
const storage = new Storage()

interface VerifiedRequester {
  email: string
}

async function verifyRequester(
  request: Request,
): Promise<VerifiedRequester | Response> {
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
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    })
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
    return Response.json(
      { error: 'Expected multipart/form-data' },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file field' }, { status: 400 })
  }

  const submissionId = formData.get('submission_id')
  if (
    typeof submissionId !== 'string' ||
    !SUBMISSION_ID_PATTERN.test(submissionId)
  ) {
    return Response.json(
      { error: 'Missing or invalid submission_id field' },
      { status: 400 },
    )
  }

  const validation = validateUploadFile(file)
  if (!validation.ok) {
    return Response.json(
      { error: validation.error },
      { status: validation.status },
    )
  }

  const submissionPrefix = `uploads/${requester.email}/${submissionId}/`
  const [existing] = await storage
    .bucket(BUCKET_NAME)
    .getFiles({ prefix: submissionPrefix })
  if (existing.length >= MAX_PHOTOS) {
    return Response.json(
      { error: `Submission already has the maximum of ${MAX_PHOTOS} photos` },
      { status: 409 },
    )
  }

  const objectName = `${submissionPrefix}${Date.now()}.${validation.extension}`
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

  return Response.json(
    { path: `gs://${BUCKET_NAME}/${objectName}` },
    { status: 201 },
  )
}
