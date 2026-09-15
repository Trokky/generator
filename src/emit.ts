/**
 * The files a composition produces that are not simply copied: anything whose *contents* depend
 * on the choices. Copied files live under `files/`; computed ones are built here.
 */

import type { ProjectConfig } from './config.js'
import { hasFrontend, hasStudio } from './config.js'
import { manifest } from './manifest.js'

const TROKKY = '@trokky/trokky'
const STUDIO = '@trokky/studio'

export function packageJson(config: ProjectConfig): string {
  const dependencies: Record<string, string> = { [TROKKY]: config.trokkyVersion }
  const devDependencies: Record<string, string> = { typescript: '^5.6.0' }
  const scripts: Record<string, string> = {}

  if (hasStudio(config)) dependencies[STUDIO] = config.trokkyVersion

  if (config.target === 'workers') {
    devDependencies['@cloudflare/workers-types'] = '^5.20260914.1'
    devDependencies.wrangler = '^4.131.2'
    // Workers Builds runs the build command and then the deploy command; a deploy that also
    // builds doubles every deploy.
    scripts.deploy = 'wrangler deploy'
    scripts.preview = 'wrangler dev'
    scripts.types = 'wrangler types'

    if (hasFrontend(config)) {
      dependencies.astro = '^7.3.2'
      dependencies['@astrojs/cloudflare'] = '^14.3.1'
      dependencies['@trokky/client'] = config.trokkyVersion
      scripts.dev = hasStudio(config) ? 'node scripts/copy-studio.mjs && astro dev' : 'astro dev'
      scripts.build = hasStudio(config) ? 'node scripts/copy-studio.mjs && astro build' : 'astro build'
      scripts.check = 'astro check'
    } else {
      scripts.dev = 'wrangler dev'
      // Without Astro there is no bundler of our own: wrangler builds the Worker at deploy time.
      scripts.build = hasStudio(config) ? 'node scripts/copy-studio.mjs' : 'echo "nothing to build"'
    }
  } else {
    dependencies.express = '^4.21.2'
    dependencies.dotenv = '^16.4.7'
    devDependencies['@types/express'] = '^4.17.21'
    devDependencies['@types/node'] = '^22.0.0'
    devDependencies.tsx = '^4.19.2'
    if (config.data === 'postgres-data') dependencies.pg = '^8.13.1'
    if (config.images === 'sharp') dependencies.sharp = '^0.33.5'
    scripts.dev = 'tsx watch src/server.ts'
    scripts.build = 'tsc -p tsconfig.json'
    scripts.start = 'node dist/server.js'
  }

  return JSON.stringify(
    {
      name: config.name,
      private: true,
      type: 'module',
      version: '0.1.0',
      engines: { node: config.target === 'workers' ? '>=22.12.0' : '>=20' },
      scripts,
      dependencies,
      devDependencies,
    },
    null,
    2,
  ) + '\n'
}

export function wranglerConfig(config: ProjectConfig): string {
  const assets = hasFrontend(config)
    ? `"./dist/client"`
    : hasStudio(config)
      ? `"./public"`
      : null

  const lines = [
    '{',
    '  "$schema": "node_modules/wrangler/config-schema.json",',
    `  "name": ${JSON.stringify(config.name)},`,
    `  "main": "./src/worker.ts",`,
    '  "compatibility_date": "2026-09-01",',
    '  // Trokky\'s core imports crypto, events and module directly.',
    '  "compatibility_flags": ["nodejs_compat"],',
  ]

  if (assets) {
    lines.push(
      '  "assets": {',
      `    "directory": ${assets},`,
      '    "binding": "ASSETS",',
      '    // Every request goes through the Worker: /studio needs its config injected, and /api',
      '    // is not a file. Static files are fetched through the binding by the handlers.',
      '    "run_worker_first": true,',
      '    "html_handling": "none",',
      '    "not_found_handling": "none"',
      '  },',
    )
  }

  lines.push(
    '  "d1_databases": [',
    `    { "binding": "DB", "database_name": ${JSON.stringify(config.name)}, "database_id": "" }`,
    '  ],',
    '  "r2_buckets": [',
    `    { "binding": "MEDIA", "bucket_name": ${JSON.stringify(config.name + '-media')} }`,
    '  ],',
  )
  if (config.images === 'cloudflare-images') {
    lines.push('  // Thumbnails are made through the Images binding at upload time.', '  "images": { "binding": "IMAGES" },')
  }
  lines.push('  "observability": { "enabled": true }', '}', '')
  return lines.join('\n')
}

/** The Worker's Trokky wiring: which adapters are imported is the composition, literally. */
export function workersCore(config: ProjectConfig): string {
  const imports = [
    `import { TrokkyCore } from '${TROKKY}'`,
    `import { createFetchHandler, type FetchHandler } from '${TROKKY}/workers'`,
    `import { CloudflareD1Adapter } from '${TROKKY}/adapters/cloudflare-d1'`,
    `import { CloudflareR2Adapter } from '${TROKKY}/adapters/cloudflare-r2'`,
  ]
  if (hasStudio(config)) imports.push(`import { createStudioFetchHandler } from '${STUDIO}/workers'`)
  if (config.content !== 'blank') {
    imports.push(`import { schemas } from './schemas'`)
    imports.push(`import { structure } from './structure'`)
  }

  const mediaConfig =
    config.images === 'cloudflare-images'
      ? `      media: {
        imageProcessor: 'cloudflare-images',
        imageProcessorOptions: { images: env.IMAGES },
        imageVariants: [
          { name: 'thumbnail', width: 480, height: 320, format: 'webp', quality: 80, fit: 'cover' },
          { name: 'large', width: 1600, height: 1000, format: 'webp', quality: 85, fit: 'inside' },
        ],
      },
`
      : ''

  return `/**
 * One Trokky per isolate.
 *
 * Bindings only exist inside \`fetch\`, so the core is built on the first request and kept for
 * the life of the isolate. Building it per request would re-check the D1 schema every time.
 */
${imports.join('\n')}

export interface TrokkyEnv {
  DB: D1Database
  MEDIA: R2Bucket
${config.images === 'cloudflare-images' ? '  IMAGES: ImagesBinding\n' : ''}${hasStudio(config) || config.content !== 'blank' ? '  ASSETS: { fetch(request: Request): Promise<Response> }\n' : ''}  TROKKY_JWT_SECRET?: string
  TROKKY_CLAIM_SECRET?: string
}

export const API_PATH = '/api'
${hasStudio(config) ? "export const STUDIO_PATH = '/studio'\n" : ''}
export interface Trokky {
  core: TrokkyCore
  api: FetchHandler
${hasStudio(config) ? '  studio: (request: Request) => Promise<Response>\n' : ''}}

let instance: Promise<Trokky> | undefined

export function getTrokky(env: TrokkyEnv): Promise<Trokky> {
  instance ??= build(env)
  return instance
}

async function build(env: TrokkyEnv): Promise<Trokky> {
  const core = new TrokkyCore(
    {
      // Required by the type even though the adapters below are passed directly.
      storage: { adapter: 'cloudflare-d1', options: {} },
      schemas: ${config.content === 'blank' ? '[]' : 'schemas as never'},
${mediaConfig}    },
    {
      data: new CloudflareD1Adapter({ database: env.DB }),
      media: new CloudflareR2Adapter({ bucket: env.MEDIA }),
    },
    {
      jwtSecret: env.TROKKY_JWT_SECRET,
      claimSecret: env.TROKKY_CLAIM_SECRET,
    },
  )
  // Creates the image processor; nothing serves images without it.
  await core.init()

  const api = createFetchHandler({ core, basePath: API_PATH${config.content === 'blank' ? '' : ', structureConfig: structure'} })
${hasStudio(config) ? `  const studio = createStudioFetchHandler({ basePath: STUDIO_PATH, apiPath: API_PATH, assets: env.ASSETS })
  return { core, api, studio }` : '  return { core, api }'}
}
`
}

export function workersEntry(config: ProjectConfig): string {
  const seeds = config.content === 'magazine'
  const parts = [
    `/**
 * The Worker.
 *
${hasFrontend(config) ? ' *   /api/*     the Trokky API\n *   /studio/*  the Studio, served from static assets\n *   /*         the site, rendered on request\n' : hasStudio(config) ? ' *   /api/*     the Trokky API\n *   /studio/*  the Studio, served from static assets\n' : ' *   /api/*     the Trokky API\n'} */`,
  ]
  if (hasFrontend(config)) parts.push(`import { handle } from '@astrojs/cloudflare/handler'`)
  parts.push(`import { getTrokky, API_PATH${hasStudio(config) ? ', STUDIO_PATH' : ''}, type TrokkyEnv } from './trokky/core'`)
  if (seeds) parts.push(`import { seedSampleContent } from './trokky/seed'`)

  const seedBlock = seeds
    ? `
      // The first administrator has just claimed the instance: give them something to look at.
      // Runs after the response so the claim itself is never slowed or failed by seeding.
      if (request.method === 'POST' && pathname === \`\${API_PATH}/auth/claim\` && response.ok) {
        const origin = new URL(request.url).origin
        const readAsset = async (path: string): Promise<ArrayBuffer> => {
          const asset = await env.ASSETS.fetch(new Request(\`\${origin}/seed/\${path}\`))
          if (!asset.ok) throw new Error(\`seed asset missing: /seed/\${path} (\${asset.status})\`)
          return asset.arrayBuffer()
        }
        ctx.waitUntil(seedSampleContent(core, readAsset).catch(error => console.error('seed failed', error)))
      }
`
    : ''

  parts.push(`
export default {
  async fetch(request: Request, env: TrokkyEnv, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === API_PATH || pathname.startsWith(\`\${API_PATH}/\`)) {
      const { core, api } = await getTrokky(env)
      const response = await api(request)
${seedBlock}      return response
    }
${hasStudio(config) ? `
    if (pathname === STUDIO_PATH || pathname.startsWith(\`\${STUDIO_PATH}/\`)) {
      const { studio } = await getTrokky(env)
      return studio(request)
    }
` : ''}${hasFrontend(config) ? `
    return handle(request, env as unknown as Env, ctx)` : `
    return new Response('Not Found', { status: 404 })`}
  },
} satisfies ExportedHandler<TrokkyEnv>
`)
  return parts.join('\n')
}

export function nodeEntry(config: ProjectConfig): string {
  const seeds = config.content === 'magazine'
  return `/**
 * The server.
 *
 * \`startServer\` builds the Express app, mounts the API and installs shutdown handlers.
 * ${hasStudio(config) ? 'The Studio is mounted separately, before any catch-all of your own.' : 'No Studio here: this is a headless API.'}
 */
import { startServer } from '${TROKKY}/express'
// Adapters register themselves as a side effect of being imported. Without these two lines the
// config below names an adapter that nothing registered, and startup fails.
import '${TROKKY}/adapters/${config.data}'
import '${TROKKY}/adapters/${config.media}'
${hasStudio(config) ? `import { studioRouter } from '${STUDIO}/express'\n` : ''}${seeds ? `import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { seedSampleContent } from './trokky/seed.js'
` : ''}import config from '../trokky.config.js'

const server = await startServer(config)
${hasStudio(config) ? `
// Mount Studio before anything that could swallow it.
server.app.use('/studio', studioRouter({ apiPath: '/api' }))
` : ''}${seeds ? `
// Sample content, on a store that has none. A Worker seeds after the claim, inside waitUntil;
// a server has no such hook and boots under the operator's control, so first run is the moment.
const core = server.integration.core
if (core) {
  const seedDir = path.join(process.cwd(), 'public', 'seed')
  seedSampleContent(core, async file => {
    const bytes = await readFile(path.join(seedDir, file))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }).catch(error => console.error('seed failed', error))
}
` : ''}
const info = server.getInfo()
console.log(\`Trokky listening on http://localhost:\${info.port}\${info.apiPath}\`)
`
}

export function trokkyConfig(config: ProjectConfig): string {
  const dataOptions =
    config.data === 'postgres-data'
      ? `      options: {
        connection: process.env.DATABASE_URL,
        schema: 'public',
        tablePrefix: 'trokky_',
      },`
      : `      options: {
        // All six directories, or none: naming only one leaves the rest beside the process.
        contentDir: path.join(dataDir, 'content'),
        usersDir: path.join(dataDir, 'users'),
        tokensDir: path.join(dataDir, 'tokens'),
        webhooksDir: path.join(dataDir, 'webhooks'),
        settingsDir: path.join(dataDir, 'settings'),
        auditLogsDir: path.join(dataDir, 'audit-logs'),
      },`

  return `/**
 * Trokky configuration.
 */
import path from 'node:path'
import dotenv from 'dotenv'
${config.content === 'blank' ? '' : "import { schemas } from './src/trokky/schemas.js'\nimport { structure } from './src/trokky/structure.js'\n"}
dotenv.config()

const dataDir = process.env.TROKKY_DATA_DIR ?? path.join(process.cwd(), 'data')

export default {
  schemas: ${config.content === 'blank' ? '[]' : 'schemas'},
${config.content === 'blank' ? '' : '  structure,\n'}
  storage: {
    data: {
      adapter: '${config.data}' as const,
${dataOptions}
    },
    media: {
      adapter: 'filesystem-media' as const,
      options: {
        mediaDir: path.join(dataDir, 'media'),
        createDirs: true,
      },
    },
  },

  media: {
    processor: '${config.images}' as const,
  },

  security: {
    enabled: true,
    // Generate it; do not invent it. A missing secret means every restart invalidates sessions.
    jwtSecret: process.env.TROKKY_JWT_SECRET,
    claimSecret: process.env.TROKKY_CLAIM_SECRET,
  },

  server: {
    port: Number(process.env.PORT ?? 3000),
  },
}
`
}

export function envExample(config: ProjectConfig): string {
  const secrets = manifest.secrets[config.target] ?? []
  const lines = [
    '# Generate these; do not invent them:',
    '#   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    '',
  ]
  for (const secret of secrets) lines.push(`# ${secret.why}`, `${secret.name}=`, '')
  if (config.data === 'postgres-data') lines.push('# Postgres connection string.', 'DATABASE_URL=', '')
  lines.push('# Where content and uploads are written. Must survive a restart.', 'TROKKY_DATA_DIR=./data', '')
  return lines.join('\n')
}

export function tsconfig(config: ProjectConfig): string {
  return config.target === 'workers'
    ? JSON.stringify({
        extends: hasFrontend(config) ? 'astro/tsconfigs/strict' : undefined,
        compilerOptions: {
          target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
          types: ['@cloudflare/workers-types/2023-07-01'],
          strict: true, skipLibCheck: true, noEmit: true,
        },
        include: ['src/**/*', 'scripts/**/*'],
      }, (_k, v) => (v === undefined ? undefined : v), 2) + '\n'
    : JSON.stringify({
        compilerOptions: {
          target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
          outDir: 'dist', rootDir: '.', strict: true, skipLibCheck: true,
          esModuleInterop: true, types: ['node'],
        },
        include: ['src/**/*', 'trokky.config.ts'],
      }, null, 2) + '\n'
}
