/**
 * config → file tree. Pure: nothing here touches the disk, so it is testable, and the same
 * function serves the CLI, a zip download and an API install.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ProjectConfig } from './config.js'
import { hasFrontend, hasStudio } from './config.js'
import { validate, describe } from './validate.js'
import * as emit from './emit.js'

const here = dirname(fileURLToPath(import.meta.url))
/** `files/` sits beside `dist/` in the published package and beside `src/` in the repo. */
const FILES = join(here, '..', 'files')

export type FileTree = Map<string, string | Uint8Array>

/** Which copied file sets a composition pulls in, in order. */
function sources(config: ProjectConfig): string[] {
  const sets = ['base']
  if (config.target === 'workers') sets.push('workers')
  else sets.push('node')
  if (config.content !== 'blank') sets.push(`content/${config.content}`)
  if (hasFrontend(config)) sets.push('frontend')
  return sets
}

function copyInto(tree: FileTree, root: string, prefixToStrip = ''): void {
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      const rel = relative(root, full).split(sep).join('/')
      const target = prefixToStrip && rel.startsWith(prefixToStrip) ? rel.slice(prefixToStrip.length) : rel
      // Text where we can, bytes where we must: the seed images and PDFs are binary.
      const binary = /\.(jpg|jpeg|png|gif|webp|pdf|ico|woff2?)$/i.test(rel)
      tree.set(target, binary ? new Uint8Array(readFileSync(full)) : readFileSync(full, 'utf8'))
    }
  }
  walk(root)
}

export function generate(config: ProjectConfig): FileTree {
  const result = validate(config)
  if (!result.valid) {
    throw new Error(`This combination cannot be built:\n${describe(result.problems)}`)
  }

  const tree: FileTree = new Map()
  for (const set of sources(config)) copyInto(tree, join(FILES, set))

  // Files whose contents depend on the choices.
  tree.set('package.json', emit.packageJson(config))
  tree.set('tsconfig.json', emit.tsconfig(config))
  tree.set('README.md', readme(config))

  if (hasFrontend(config)) {
    tree.set('astro.config.mjs', emit.astroConfig(config))
    tree.set('src/trokky/page.ts', emit.pageHelper(config))
  }

  if (config.target === 'workers') {
    tree.set('wrangler.jsonc', emit.wranglerConfig(config))
    tree.set('src/worker.ts', emit.workersEntry(config))
    tree.set('src/trokky/core.ts', emit.workersCore(config))
    tree.set('.dev.vars.example', emit.envExample(config))
  } else {
    tree.set('src/server.ts', emit.nodeEntry(config))
    tree.set('trokky.config.ts', emit.trokkyConfig(config))
    tree.set('.env.example', emit.envExample(config))
  }

  // A Studio-less project has nothing to copy Studio into.
  if (!hasStudio(config)) {
    tree.delete('scripts/copy-studio.mjs')
  }
  // Without a frontend there are no pages to render, and no Astro to render them.
  if (!hasFrontend(config)) {
    for (const path of [...tree.keys()]) {
      if (path.startsWith('src/pages/') || path.startsWith('src/layouts/') || path === 'src/trokky/site.ts') {
        tree.delete(path)
      }
    }
  }
  // Seed assets are only reachable when something serves static files.
  if (config.content === 'blank' || (config.target === 'workers' && !hasStudio(config) && !hasFrontend(config))) {
    for (const path of [...tree.keys()]) if (path.startsWith('public/seed/')) tree.delete(path)
  }

  return tree
}

function readme(config: ProjectConfig): string {
  const edge = config.target === 'workers'
  const parts = hasFrontend(config) ? 'a site, the Studio and the API' : hasStudio(config) ? 'the Studio and the API' : 'the API'

  return `# ${config.name}

A [Trokky](https://trokky.dev) project: ${parts}, on ${edge ? 'Cloudflare Workers' : 'Node'}.

Generated with \`npm create trokky@latest\`.

## What is in it

| | |
|---|---|
| Content | ${config.data} |
| Uploads | ${config.media} |
| Thumbnails | ${config.images === 'none' ? 'not generated — originals only' : config.images} |
| Parts | ${parts} |
| Starting content | ${config.content} |

## Run it

\`\`\`
${edge ? `cp .dev.vars.example .dev.vars   # fill both secrets
npm install
npm run build && npm run preview` : `cp .env.example .env             # fill both secrets
npm install
npm run dev`}
\`\`\`

${edge ? `## Deploy

\`\`\`
npm run build && npm run deploy
\`\`\`

Wrangler provisions the D1 database and R2 bucket named in \`wrangler.jsonc\` on first deploy.
\`database_id\` is intentionally empty: it is bound by name.

` : ''}## The first minute

Open ${hasStudio(config) ? '`/studio`' : 'the API'}. Nobody owns this instance yet, so the first
screen asks you to **claim** it: pick a username and password, and paste \`TROKKY_CLAIM_SECRET\`.
${config.content === 'magazine' ? 'Sample content appears a moment later — edit it or delete it.' : ''}

Without a claim secret the claim is open to whoever reaches the URL first. That is fine for the
minute between deploying and opening the link; it is not fine for an instance left sitting.

## Make it yours

${config.content === 'blank' ? '- `src/trokky/` — add your schemas; the Studio follows them.' : '- `src/trokky/schemas.ts` — the content model. The Studio follows it.\n- `src/trokky/structure.ts` — the Studio sidebar.'}
${hasFrontend(config) ? '- `src/pages/` and `src/layouts/` — the site.\n' : ''}${edge ? '- `wrangler.jsonc` — the Worker name and its resources.' : '- `trokky.config.ts` — storage, media and security.'}
`
}
