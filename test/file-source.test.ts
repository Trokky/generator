/**
 * The generator must produce the same project whether its files came off a disk or out of a
 * bundle — that equivalence is what lets trokky.build generate in a browser, with no server on
 * the download path, from the same code the CLI runs.
 */

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { generate } from '../src/generate.js'
import { withDefaults } from '../src/config.js'
import { fsFileSource } from '../src/files-node.js'
import { inlineFileSource } from '../src/files.js'

// The bundle is a build artifact, so build it here rather than depending on run order.
execFileSync('node', ['scripts/inline-files.mjs'], { stdio: 'pipe' })
const { text } = await import('../src/generated/files-text.js')
const { binary } = await import('../src/generated/files-binary.js')

const fs = fsFileSource()
const inlined = inlineFileSource({ text, binary })

const compositions = [
  { name: 'a', target: 'workers' as const, parts: 'full-site' as const, content: 'magazine' as const },
  { name: 'b', target: 'node' as const, parts: 'studio' as const, content: 'magazine' as const },
  { name: 'c', target: 'workers' as const, parts: 'api' as const, content: 'blank' as const },
]

describe('disk and bundle are interchangeable', () => {
  for (const composition of compositions) {
    it(`produces an identical tree for ${composition.target}/${composition.parts}`, () => {
      const config = withDefaults(composition)
      const fromDisk = generate(config, fs)
      const fromBundle = generate(config, inlined)

      expect([...fromBundle.keys()].sort()).toEqual([...fromDisk.keys()].sort())

      for (const [path, contents] of fromDisk) {
        const other = fromBundle.get(path)
        if (typeof contents === 'string') {
          expect(other, path).toBe(contents)
        } else {
          // Bytes must survive base64 exactly; a cover that decodes wrong is a broken project.
          expect(other, path).toBeInstanceOf(Uint8Array)
          expect(Array.from(other as Uint8Array), path).toEqual(Array.from(contents))
        }
      }
    })
  }

  it('keeps the magazine photographs out of the text bundle, so a page can defer them', () => {
    // The split is the whole reason trokky.build will not ship 2MB to someone picking "blank".
    expect(Object.keys(text).some(path => /\.(jpg|pdf)$/.test(path))).toBe(false)
    expect(Object.keys(binary).every(path => path.startsWith('content/magazine/'))).toBe(true)
    expect(JSON.stringify(text).length).toBeLessThan(120_000)
  })

  it('says which set is missing rather than generating a project short of files', () => {
    const empty = inlineFileSource({ text: {}, binary: {} })
    expect(() => generate(withDefaults({ name: 'x', target: 'workers' }), empty)).toThrow(/File set missing/)
  })
})
