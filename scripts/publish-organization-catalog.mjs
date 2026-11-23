#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
)
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { writeCatalog } = require('../functions/lib/organizations/store.js')
const [file, ...extra] = process.argv.slice(2)
if (!file || extra.length || !process.env.FIREBASE_PROJECT_ID)
  throw new Error(
    'Usage: FIREBASE_PROJECT_ID=PROJECT node scripts/publish-organization-catalog.mjs CATALOG.json',
  )
const catalog = JSON.parse(await readFile(file, 'utf8'))
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
})
await writeCatalog(catalog)
process.stdout.write('Organization catalog published\n')
