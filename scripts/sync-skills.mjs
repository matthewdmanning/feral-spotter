#!/usr/bin/env node
/**
 * scripts/sync-skills.mjs
 * Mirrors .agents/skills (source, read by Codex) into .claude/skills
 * (read by Claude Code, including cloud sessions). Real copies, no symlinks.
 *
 * Usage:
 *   node scripts/sync-skills.mjs          copy source over target
 *   node scripts/sync-skills.mjs --check  exit 1 if target differs
 */
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = '.agents/skills';
const TARGET = '.claude/skills';
const isCheck = process.argv.includes('--check');

/** Lists every file under dir as a relative path, following symlinks. */
function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const rel = join(prefix, name);
    return statSync(join(dir, name)).isDirectory() ? listFiles(join(dir, name), rel) : [rel];
  });
}

function diff() {
  const src = listFiles(SOURCE);
  const dst = new Set(listFiles(TARGET));
  const missing = src.filter((f) => !dst.has(f));
  const extra = [...dst].filter((f) => !src.includes(f));
  const changed = src.filter((f) => dst.has(f) && !readFileSync(join(SOURCE, f)).equals(readFileSync(join(TARGET, f))));
  return { missing, extra, changed };
}

if (isCheck) {
  const { missing, extra, changed } = diff();
  const count = missing.length + extra.length + changed.length;
  if (count) {
    console.error(`${TARGET} differs from ${SOURCE}: ${missing.length} missing, ${extra.length} extra, ${changed.length} changed. Run: node scripts/sync-skills.mjs`);
    process.exit(1);
  }
  console.log(`${TARGET} matches ${SOURCE}`);
} else {
  mkdirSync(TARGET, { recursive: true });
  for (const name of readdirSync(TARGET)) {
    const path = join(TARGET, name);
    if (lstatSync(path).isSymbolicLink()) unlinkSync(path);
    else rmSync(path, { recursive: true });
  }
  cpSync(SOURCE, TARGET, { recursive: true, dereference: true });
  console.log(`Copied ${readdirSync(TARGET).length} skills from ${SOURCE} to ${TARGET}`);
}
