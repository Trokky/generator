/**
 * A generated project must be coherent: the files it contains, the dependencies it declares and
 * the adapters it imports all have to agree with what was chosen. These tests read the tree, so
 * they catch a composition that silently ships a Studio it never mounts, or a package.json that
 * installs sharp for a runtime that cannot load it.
 */

import { describe, it, expect } from 'vitest'
import { generate } from '../src/generate.js'
import { fsFileSource } from '../src/files-node.js'

const source = fsFileSource()
import { withDefaults } from '../src/config.js'

const build = (over: Record<string, unknown> = {}) =>
  generate(withDefaults({ name: 'my-site', target: 'workers', ...over } as never), source)

const text = (tree: Map<string, string | Uint8Array>, path: string): string => {
  const value = tree.get(path)
  if (typeof value !== 'string') throw new Error(`${path} is missing or binary`)
  return value
}

describe('the full edge site', () => {
  const tree = build()

  it('emits a Worker, its wiring, Astro pages and the seed', () => {
    for (const path of ['src/worker.ts', 'src/trokky/core.ts', 'wrangler.jsonc', 'package.json', 'astro.config.mjs', 'src/pages/index.astro', 'src/trokky/schemas.ts', 'src/trokky/seed.ts', '.dev.vars.example', 'README.md']) {
      expect(tree.has(path), path).toBe(true)
    }
  })

  it('ships the seed images as bytes, not mangled text', () => {
    const cover = tree.get('public/seed/cover-1.jpg')
    expect(cover).toBeInstanceOf(Uint8Array)
    expect((cover as Uint8Array).length).toBeGreaterThan(10_000)
  })

  it('wires D1, R2 and the Images binding, and nothing else', () => {
    const core = text(tree, 'src/trokky/core.ts')
    expect(core).toContain('CloudflareD1Adapter')
    expect(core).toContain('CloudflareR2Adapter')
    expect(core).toContain("imageProcessor: 'cloudflare-images'")
    expect(core).not.toContain('filesystem')
    expect(core).toContain('await core.init()')
  })

  it('declares the Images binding in wrangler and leaves database_id empty to bind by name', () => {
    const wrangler = text(tree, 'wrangler.jsonc')
    expect(wrangler).toContain('"images": { "binding": "IMAGES" }')
    expect(wrangler).toContain('"database_id": ""')
    expect(wrangler).toContain('"nodejs_compat"')
    expect(wrangler).toContain('"run_worker_first": true')
    expect(wrangler).toContain('"directory": "./dist/client"')
  })

  it('never makes deploy rebuild, because Workers Builds already built', () => {
    expect(JSON.parse(text(tree, 'package.json')).scripts.deploy).toBe('wrangler deploy')
  })
})

describe('an API-only Worker', () => {
  const tree = build({ parts: 'api', content: 'blank' })

  it('has no Studio, no pages and no schemas', () => {
    expect(tree.has('src/trokky/core.ts')).toBe(true)
    expect(text(tree, 'src/trokky/core.ts')).not.toContain('createStudioFetchHandler')
    expect(tree.has('scripts/copy-studio.mjs')).toBe(false)
    expect(tree.has('src/pages/index.astro')).toBe(false)
    expect(tree.has('src/trokky/schemas.ts')).toBe(false)
    expect([...tree.keys()].some(k => k.startsWith('public/seed/'))).toBe(false)
  })

  it('depends on neither Studio nor Astro', () => {
    const pkg = JSON.parse(text(tree, 'package.json'))
    expect(pkg.dependencies['@trokky/studio']).toBeUndefined()
    expect(pkg.dependencies.astro).toBeUndefined()
    expect(pkg.dependencies['@trokky/trokky']).toBeTruthy()
  })

  it('serves nothing outside /api', () => {
    expect(text(tree, 'src/worker.ts')).toContain("return new Response('Not Found', { status: 404 })")
  })
})

describe('a Node install', () => {
  const tree = generate(withDefaults({ name: 'my-cms', target: 'node' }), source)

  it('emits a server and a config, not a Worker', () => {
    expect(tree.has('src/server.ts')).toBe(true)
    expect(tree.has('trokky.config.ts')).toBe(true)
    expect(tree.has('src/worker.ts')).toBe(false)
    expect(tree.has('wrangler.jsonc')).toBe(false)
    expect(tree.has('.env.example')).toBe(true)
  })

  it('uses the filesystem adapters and names all six directories', () => {
    const config = text(tree, 'trokky.config.ts')
    expect(config).toContain("adapter: 'filesystem-data'")
    for (const dir of ['contentDir', 'usersDir', 'tokensDir', 'webhooksDir', 'settingsDir', 'auditLogsDir']) {
      expect(config, dir).toContain(dir)
    }
  })

  it('installs sharp only when sharp was chosen', () => {
    expect(JSON.parse(text(tree, 'package.json')).dependencies.sharp).toBeTruthy()
    const none = generate(withDefaults({ name: 'x', target: 'node', images: 'none' }), source)
    expect(JSON.parse(text(none, 'package.json')).dependencies.sharp).toBeUndefined()
  })

  it('installs pg only for Postgres', () => {
    expect(JSON.parse(text(tree, 'package.json')).dependencies.pg).toBeUndefined()
    const pg = generate(withDefaults({ name: 'x', target: 'node', data: 'postgres-data' }), source)
    expect(JSON.parse(text(pg, 'package.json')).dependencies.pg).toBeTruthy()
    expect(text(pg, '.env.example')).toContain('DATABASE_URL')
  })

  it('imports both adapters for their side effects, or nothing registers them', () => {
    // The failure mode this guards: startup dies with 'Available adapters: .' — the config names
    // an adapter and no import ever registered it.
    const server = text(tree, 'src/server.ts')
    expect(server).toContain("import '@trokky/trokky/adapters/filesystem-data'")
    expect(server).toContain("import '@trokky/trokky/adapters/filesystem-media'")

    const pg = generate(withDefaults({ name: 'x', target: 'node', data: 'postgres-data' }), source)
    expect(text(pg, 'src/server.ts')).toContain("import '@trokky/trokky/adapters/postgres-data'")
  })

  it('mounts the Studio through the Express router', () => {
    expect(text(tree, 'src/server.ts')).toContain("studioRouter({ apiPath: '/api' })")
  })
})

describe('the site is portable: same pages, either runtime', () => {
  const workers = generate(withDefaults({ name: 'x', target: 'workers', parts: 'full-site', content: 'magazine' }), source)
  const node = generate(withDefaults({ name: 'x', target: 'node', parts: 'full-site', content: 'magazine' }), source)

  it('ships byte-identical pages, layouts and query helper to both', () => {
    const shared = [...workers.keys()].filter(k => k.startsWith('src/pages/') || k.startsWith('src/layouts/') || k === 'src/trokky/site.ts')
    expect(shared.length).toBeGreaterThan(8)
    for (const path of shared) {
      expect(node.get(path), path).toBe(workers.get(path))
    }
  })

  it('differs only where it must: the adapter and how a page reaches the core', () => {
    expect(text(workers, 'astro.config.mjs')).toContain('@astrojs/cloudflare')
    expect(text(node, 'astro.config.mjs')).toContain("node({ mode: 'middleware' })")

    expect(text(workers, 'src/trokky/page.ts')).toContain("from 'cloudflare:workers'")
    expect(text(node, 'src/trokky/page.ts')).toContain('astro.locals')
    // Neither reads the API over HTTP: both hand the page a core.
    for (const tree of [workers, node]) expect(text(tree, 'src/trokky/page.ts')).toContain('site(core)')
  })

  it('has every page call load the same way, or they would not be shared', () => {
    for (const path of [...workers.keys()].filter(k => k.endsWith('.astro') && k.startsWith('src/pages/'))) {
      expect(text(workers, path), path).toContain('await load(Astro)')
    }
  })

  it('serves the built site from the Node server, assets first', () => {
    const server = text(node, 'src/server.ts')
    expect(server).toContain("from '../dist/server/entry.mjs'")
    expect(server).toContain("express.static('dist/client')")
    expect(server).toContain('ssrHandler(req, res, next, { trokky: core })')
    expect(JSON.parse(text(node, 'package.json')).dependencies['@astrojs/node']).toBeTruthy()
    expect(JSON.parse(text(node, 'package.json')).scripts.build).toBe('astro build')
  })

  it('gives a Node project without a site no Astro at all', () => {
    const plain = generate(withDefaults({ name: 'x', target: 'node', parts: 'studio' }), source)
    expect(plain.has('astro.config.mjs')).toBe(false)
    expect(JSON.parse(text(plain, 'package.json')).dependencies.astro).toBeUndefined()
  })
})

describe('refusing the impossible', () => {
  it('will not generate a Worker with sharp, and says why', () => {
    expect(() => build({ images: 'sharp' })).toThrow(/native/i)
  })

  it('will not generate a Node project with D1', () => {
    expect(() => generate(withDefaults({ name: 'x', target: 'node', data: 'cloudflare-d1' }), source)).toThrow(/binding/i)
  })
})

describe('the README tells the truth about what was built', () => {
  it('names the actual choices', () => {
    const readme = text(build({ images: 'none' }), 'README.md')
    expect(readme).toContain('cloudflare-d1')
    expect(readme).toContain('originals only')
    expect(readme).toContain('claim')
  })
})
