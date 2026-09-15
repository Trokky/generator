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
  { id: 'node-full',      flags: ['--target=node', '--parts=full-site', '--content=magazine'] },
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
    if (claim.data.secretRequired !== true) throw new Error('a configured claim secret was not required')
    notes.push('claimable')

    // Claim it, the way the first person to open Studio would. On Workers this is also what
    // triggers the seed; on Node the seed already ran at boot. Either way the instance is now
    // owned, and a second claim must be refused.
    const claimed = await (await fetch(`${base}/api/auth/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'smoke', email: 'smoke@example.org', password: 'a-long-enough-password-9!', secret: claimSecret }),
    })).json()
    if (!claimed?.data?.claimed) throw new Error(`claim refused: ${JSON.stringify(claimed?.error ?? claimed)}`)

    const second = await (await fetch(`${base}/api/auth/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'intruder', email: 'i@example.org', password: 'a-long-enough-password-9!', secret: claimSecret }),
    })).json()
    if (second?.data?.claimed) throw new Error('a claimed instance let itself be claimed again')
    notes.push('claimed once')

    if (!testCase.flags.includes('--parts=api')) {
      const studio = await fetch(`${base}/studio`)
      const html = await studio.text()
      if (!studio.ok || !html.includes('"mode":"production"')) throw new Error('Studio document not served')
      notes.push('studio')
    }

    if (testCase.flags.includes('--parts=full-site')) {
      // The seed uploads and the variants it triggers are the slowest part of a first run.
      let html = ''
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        const home = await fetch(`${base}/`)
        if (!home.ok) throw new Error('site did not render')
        html = await home.text()
        if (html.includes('/articles/')) break
        await sleep(2000)
      }
      if (!html.includes('/articles/')) throw new Error('site rendered but the seed never appeared')
      notes.push('site')

      // A thumbnail is the end of the whole media pipeline: upload, process, store, serve. It
      // 404s quietly when the processor has no variants configured, and the page still looks fine.
      const thumbnail = html.match(/\/api\/media\/[^"']+\/variants\/thumbnail/)?.[0]
      if (!thumbnail) throw new Error('no thumbnail on the home page')
      const image = await fetch(`${base}${thumbnail}`)
      const type = image.headers.get('content-type') ?? ''
      if (!image.ok || !type.startsWith('image/')) throw new Error(`thumbnail did not serve: ${image.status} ${type}`)
      notes.push('thumbnails')
    }
  } finally {
    // wrangler spawns workerd beneath it; give the whole tree a moment to let go of the
    // directory before anything tries to remove it.
    child.kill('SIGTERM')
    await sleep(1500)
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

if (keep) {
  console.log(`\nprojects left in ${root}`)
} else {
  try {
    // A process that has not quite exited can still be writing into node_modules, and a
    // temp directory that refuses to be deleted is not a test failure. Retry, then let it be:
    // the runner is thrown away, and /tmp is the operating system's problem.
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  } catch (error) {
    console.warn(`could not remove ${root}: ${error instanceof Error ? error.message : error}`)
  }
}

process.exit(failed === 0 ? 0 : 1)
