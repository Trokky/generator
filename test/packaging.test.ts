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
import { withDefaults } from '../src/config.js'
import { validate } from '../src/validate.js'
import { manifest } from '../src/manifest.js'

const packed: string[] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' }),
)[0].files.map((f: { path: string }) => f.path)

describe('the published tarball', () => {
  it('ships every file set the generator copies from', () => {
    // No 'node': a Node project is entirely emitted, so there is nothing to copy for it.
    for (const set of ['base', 'workers', 'content/magazine', 'frontend']) {
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
    expect(packed.filter(path => /(^|\/)\.gitignore$/.test(path))).toEqual([])
  })
})

describe('every set the generator can ask for exists', () => {
  it('is true for all 30 valid compositions, not just the ones smoke-tested', () => {
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
                expect(() => generate(config), JSON.stringify({ target, parts, content })).not.toThrow()
                built++
              }
    expect(built).toBe(30)
  })
})

describe('a generated project still gets the dotfiles it needs', () => {
  it('has a real .gitignore, restored from its dotless template', () => {
    const tree = generate(withDefaults({ name: 'x', target: 'workers' }))
    expect(tree.has('.gitignore')).toBe(true)
    expect(tree.has('gitignore')).toBe(false)
    expect(String(tree.get('.gitignore'))).toContain('node_modules')
  })
})
