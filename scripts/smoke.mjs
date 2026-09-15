#!/usr/bin/env node
/**
 * Generate a composition, install it, build it, boot it, and ask it questions.
 *
 * This is the test that matters. Unit tests prove the tree is coherent; only this proves the
 * project actually runs — and it is what caught the generator emitting a Node project with no
 * adapter imports, which typechecked, generated cleanly and died on startup.
 *
 *   node scripts/smoke.mjs                      # the representative set
 *   node scripts/smoke.mjs --only=workers-full  # one of them
 *   node scripts/smoke.mjs --keep               # leave the generated projects on disk
 */

import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

/**
 * One per distinct code path, not all 30 combinations: the axes that change what is *emitted*
 * are target, parts and content. Adapter choice within a target changes only a string and a
 * dependency, and the package's own conformance suites cover the adapters themselves.
 */
const CASES = [
  { id: 'workers-full',   flags: ['--target=workers', '--parts=full-site', '--content=magazine'] },
  { id: 'workers-studio', flags: ['--target=workers', '--parts=studio', '--content=magazine'] },
  { id: 'workers-api',    flags: ['--target=workers', '--parts=api', '--content=blank'] },
  { id: 'node-studio',    flags: ['--target=node', '--parts=studio', '--content=magazine'] },
  { id: 'node-api',       flags: ['--target=node', '--parts=api', '--content=blank'] },
  { id: 'node-postgres',  flags: ['--target=node', '--parts=studio', '--content=magazine', '--data=postgres-data'], skipBoot: 'needs a database' },
]

const flags = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']))
const only = flags.only
const keep = flags.keep === 'true'
const root = mkdtempSync(join(tmpdir(), 'trokky-smoke-'))
const claimSecret = randomBytes(24).toString('hex')

const run = (cmd, args, cwd, quiet = true) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitFor(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {}
    await sleep(1000)
  }
  return false
}

async function smoke(testCase) {
  const dir = join(root, testCase.id)
  const notes = []

  run('node', [join(process.cwd(), 'dist/cli.js'), testCase.id, '--yes', `--out=${dir}`, ...testCase.flags])
  const workers = testCase.flags.includes('--target=workers')
  writeFileSync(
    join(dir, workers ? '.dev.vars' : '.env'),
    `TROKKY_JWT_SECRET=${randomBytes(32).toString('hex')}\nTROKKY_CLAIM_SECRET=${claimSecret}\nTROKKY_DATA_DIR=./data\nPORT=8877\n`,
  )

  run('npm', ['install', '--no-audit', '--no-fund'], dir)
  run('npm', ['run', 'build'], dir)
  notes.push('built')

  if (testCase.skipBoot) return `${notes.join(', ')}, boot skipped (${testCase.skipBoot})`

  const port = workers ? 8876 : 8877
  const base = `http://127.0.0.1:${port}`
  const child = workers
    ? spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1'], { cwd: dir, stdio: 'ignore' })
    : spawn('npx', ['tsx', 'src/server.ts'], { cwd: dir, stdio: 'ignore', env: { ...process.env, PORT: String(port) } })

  try {
    if (!(await waitFor(`${base}/api/health`))) throw new Error('never became healthy')
    notes.push('healthy')

    const claim = await (await fetch(`${base}/api/auth/claim`)).json()
    if (!claim?.data?.claimable) throw new Error('not claimable on a fresh instance')
    notes.push('claimable')

    if (!testCase.flags.includes('--parts=api')) {
      const studio = await fetch(`${base}/studio`)
      const html = await studio.text()
      if (!studio.ok || !html.includes('"mode":"production"')) throw new Error('Studio document not served')
      notes.push('studio')
    }

    if (testCase.flags.includes('--parts=full-site')) {
      const home = await fetch(`${base}/`)
      if (!home.ok) throw new Error('site did not render')
      notes.push('site')
    }
  } finally {
    child.kill('SIGTERM')
    await sleep(500)
  }

  return notes.join(', ')
}

let failed = 0
for (const testCase of CASES) {
  if (only && testCase.id !== only) continue
  process.stdout.write(`${testCase.id.padEnd(16)} `)
  try {
    console.log(`ok — ${await smoke(testCase)}`)
  } catch (error) {
    failed++
    console.log(`FAILED — ${error instanceof Error ? error.message.split('\n')[0] : error}`)
  }
}

if (!keep) rmSync(root, { recursive: true, force: true })
else console.log(`\nprojects left in ${root}`)
process.exit(failed === 0 ? 0 : 1)
