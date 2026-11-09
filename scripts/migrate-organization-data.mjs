#!/usr/bin/env node
import { createRequire } from 'node:module'
const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
)
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const {
  migrateOrganizationData,
} = require('../functions/lib/organizations/migration.js')
if (!process.env.FIREBASE_PROJECT_ID || !process.env.GCS_BUCKET_NAME)
  throw new Error(
    'Set FIREBASE_PROJECT_ID and GCS_BUCKET_NAME explicitly. Stop organization writes before --apply.',
  )
const argumentsList = process.argv.slice(2)
if (argumentsList.some((argument) => argument !== '--apply'))
  throw new Error('Usage: node scripts/migrate-organization-data.mjs [--apply]')
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.GCS_BUCKET_NAME,
})
const result = await migrateOrganizationData({
  apply: argumentsList.includes('--apply'),
  catalogPath:
    process.env.ORGANIZATIONS_CATALOG_PATH ?? 'organizations/catalog.json',
})
process.stdout.write(`${JSON.stringify(result)}\n`)
