#!/usr/bin/env node
// Operator-only tooling. Uses Application Default Credentials and never grants app users admin rights.
import { createRequire } from 'node:module'
const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
)
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const {
  createInvite,
  moderateMembership,
} = require('../functions/lib/organizations/membership/service.js')
const [action, organizationId, uid] = process.argv.slice(2)
if (
  !['invite', 'approve', 'reject', 'remove'].includes(action) ||
  !organizationId ||
  (action !== 'invite' && !uid)
) {
  throw new Error(
    'Usage: node scripts/organization-membership.mjs invite ORGANIZATION | approve|reject|remove ORGANIZATION UID',
  )
}
if (!process.env.FIREBASE_PROJECT_ID)
  throw new Error(
    'Set FIREBASE_PROJECT_ID explicitly to the intended Firestore project',
  )
if (!process.env.GCS_BUCKET_NAME)
  throw new Error('Set GCS_BUCKET_NAME explicitly to the intended bucket')
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.GCS_BUCKET_NAME,
})
if (action === 'invite')
  process.stdout.write(`${await createInvite(organizationId)}\n`)
else {
  await moderateMembership(uid, organizationId, action)
  process.stdout.write(`${action} completed\n`)
}
