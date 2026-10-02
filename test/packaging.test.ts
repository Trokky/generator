/**
 * What npm will actually ship.
 *
 * The generator is nothing without its `files/` sets, and npm has opinions about what belongs in
 * a package: a `.gitignore` is never included, whatever the `files` field says. A set whose only
 * member is one of those disappears entirely, and the failure surfaces at *generate* time on a
 * user's machine — `scandir ... files/base` — long after publishing looked fine.
 */

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { generate } from '../src/generate.js'
import { fsFileSource } from '../src/files-node.js'

const source = fsFileSource()
import { withDefaults } from '../src/config.js'
import { validate } from '../src/validate.js'
import { manifest } from '../src/manifest.js'

/**
 * `npm pack` runs `prepare`, and anything that script writes to stdout lands in front of the
 * JSON. Ours writes to stderr for that reason, but npm's own output is not ours to control, so
 * the parse starts at the first opening value and stops at the last closing bracket rather
 * than assuming a clean, single-document stream.
 *
 * The shape itself changed under npm 12 (release.yml upgrades npm past what Node 22 bundles,
 * while CI keeps the bundled one — this test runs under both): ≤ 11 emits an array of
 * packuments, ≥ 12 wraps the same packument in an object keyed by the package name. The two
 * are normalized here, and npm 12's brackets sit deep inside that map — a first-bracket slice
 * would have taken npm's file listing and thrown on the keys after it, not parsed the packument.
 */
type Packument = { files: { path: string }[] }
const packOutput = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' })
const start = Math.min(...['{', '['].map(c => packOutput.indexOf(c)).filter(i => i !== -1))
const end = Math.max(packOutput.lastIndexOf(']'), packOutput.lastIndexOf('}'))
const parsed = JSON.parse(packOutput.slice(start, end + 1)) as
  | Packument[]
  | Packument
  | Record<string, Packument>
// Whatever the wrapper — an array, a name-keyed map, or a bare packument a future npm might
// emit — the file list is one hop away. Object.values takes it from the last two alike.
const packument: Packument = Array.isArray(parsed)
  ? parsed[0]
  : Object.values(parsed as Record<string, Packument>)[0]
const packed: string[] = packument.files.map(f => f.path)

describe('the published tarball', () => {
  it('ships every file set the generator copies from', () => {
    // No 'node': a Node project is entirely emitted, so there is nothing to copy for it.
    for (const set of ['base', 'workers', 'content/magazine', 'site/magazine']) {
      expect(packed.some(path => path.startsWith(`files/${set}/`)), `files/${set}/`).toBe(true)
    }
  })

  it('ships the manifest, the build output and the seed assets', () => {
    expect(packed).toContain('manifest.json')
    expect(packed.some(path => path === 'dist/cli.js')).toBe(true)
    expect(packed.filter(path => path.startsWith('files/content/magazine/public/seed/')).length).toBeGreaterThan(8)
  })

  it('carries no file npm will silently drop', () => {
    // If this ever fails, the file needs a dotless name in `files/` and a rename in generate().
    // The non-empty guard makes the exclusion mean something: an empty list proves nothing.
    expect(packed.length).toBeGreaterThan(8)
    expect(packed.filter(path => /(^|\/)\.gitignore$/.test(path))).toEqual([])
  })
})

describe('every set the generator can ask for exists', () => {
  it('is true for all 50 valid compositions, not just the ones smoke-tested', () => {
    // An empty directory survives neither git nor npm. This is the test that would have caught
    // `files/node/` — created locally, never committed, fine until someone else cloned it.
    const ids = (axis: string) => manifest.axes.find(a => a.id === axis)!.options.map(o => o.id)
    let built = 0
    for (const target of ids('target'))
      for (const data of ids('data'))
        for (const media of ids('media'))
          for (const images of ids('images'))
            for (const parts of ids('parts'))
              for (const content of ids('content')) {
                const config = { name: 'x', target, data, media, images, parts, content, trokkyVersion: '^3.4.1' } as never
                if (!validate(config).valid) continue
                expect(() => generate(config, source), JSON.stringify({ target, parts, content })).not.toThrow()
                built++
              }
    expect(built).toBe(50)
  })
})

describe('a generated project still gets the dotfiles it needs', () => {
  it('has a real .gitignore, restored from its dotless template', () => {
    const tree = generate(withDefaults({ name: 'x', target: 'workers' }), source)
    expect(tree.has('.gitignore')).toBe(true)
    expect(tree.has('gitignore')).toBe(false)
    expect(String(tree.get('.gitignore'))).toContain('node_modules')
  })
})
