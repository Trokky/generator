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
  // full-site, not studio: the thumbnail check below only runs for full-site, and a media
  // adapter that stores nothing is exactly what this case exists to catch.
  { id: 'node-s3',        flags: ['--target=node', '--parts=full-site', '--content=magazine', '--media=s3-media'], env: 's3' },
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
  const env = [
    `TROKKY_JWT_SECRET=${randomBytes(32).toString('hex')}`,
    `TROKKY_CLAIM_SECRET=${claimSecret}`,
    'TROKKY_DATA_DIR=./data',
    'PORT=8877',
  ]

  if (testCase.env === 's3') {
    // A composition can need more than the two generated secrets. These point at whatever is
    // answering on S3_ENDPOINT -- MinIO in CI, anything S3-shaped locally.
    env.push(
      `S3_ENDPOINT=${process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000'}`,
      `S3_BUCKET=${process.env.S3_BUCKET ?? 'trokky-smoke'}`,
      `S3_ACCESS_KEY_ID=${process.env.S3_ACCESS_KEY_ID ?? 'minioadmin'}`,
      `S3_SECRET_ACCESS_KEY=${process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin'}`,
      'S3_REGION=auto',
    )
  }

  writeFileSync(join(dir, workers ? '.dev.vars' : '.env'), `${env.join('\n')}\n`)

  run('npm', ['install', '--no-audit', '--no-fund'], dir)

  if (testCase.env === 's3') {
    // The bucket has to exist before the first upload and object stores do not create one on
    // demand. Signing uses the generated project's own aws4fetch -- a dependency of
    // @trokky/trokky since the s3-media adapter shipped -- so this needs no S3 client of its
    // own and no second container in CI. `--input-type=module` because top-level await in
    // `node -e` otherwise relies on syntax detection that is only default-on from Node 22.7,
    // and engines allows 20.
    run('node', ['--input-type=module', '-e', `
      const { AwsClient } = await import('aws4fetch')
      const aws = new AwsClient({
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
        region: 'auto', service: 's3',
      })
      const endpoint = process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000'
      const bucket = process.env.S3_BUCKET ?? 'trokky-smoke'
      const response = await aws.fetch(endpoint + '/' + bucket, { method: 'PUT' })
      // 409 is BucketAlreadyOwnedByYou, which is the state we wanted anyway.
      if (!response.ok && response.status !== 409) {
        throw new Error('could not create ' + bucket + ': ' + response.status + ' ' + await response.text())
      }
    `.trim()], dir)
    notes.push('bucket')
  }

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
    console.log(`FAILED — ${error instanceof Error ? [error.message.split('\n')[0], error.stderr?.toString().trim()].filter(Boolean).join(' — ') : error}`)
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
