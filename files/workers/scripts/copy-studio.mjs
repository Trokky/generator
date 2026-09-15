/**
 * Put the built Studio where the Worker serves it from.
 *
 * `@trokky/studio` ships its SPA in `dist/`. Astro copies `public/` into the build output, and
 * the Worker serves `/studio/*` from the assets binding — so Studio has to sit at
 * `public/studio/` before `astro build` runs. It is copied, never committed: `.gitignore`
 * excludes it so an upgrade of the package is the whole upgrade.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// ESM-only package: resolve its entry (dist/index.js) the ESM way and take the directory.
const studioDist = dirname(fileURLToPath(import.meta.resolve('@trokky/studio')))
const target = join(root, 'public', 'studio')

if (!existsSync(join(studioDist, 'index.html'))) {
  console.error(`@trokky/studio has no built dist at ${studioDist}`)
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(dirname(target), { recursive: true })
// Only what the browser needs: the document and the hashed assets. Not the server helpers.
cpSync(join(studioDist, 'index.html'), join(target, 'index.html'))
cpSync(join(studioDist, 'assets'), join(target, 'assets'), { recursive: true })
console.log(`Studio copied to public/studio from ${studioDist}`)
