/**
 * The validity rules are the product. Everything here is a combination that cost a day to
 * discover the expensive way — a Worker that compiles and will not boot, a native binding that
 * cannot exist at the edge — now encoded as data and refused before a single file is written.
 */

import { describe, it, expect } from 'vitest'
import { manifest } from '../src/manifest.js'
import { validate, optionsFor, describe as describeProblems } from '../src/validate.js'
import { withDefaults } from '../src/config.js'

const workers = { name: 'x', target: 'workers' as const }
const node = { name: 'x', target: 'node' as const }

describe('manifest', () => {
  it('gives every option a title, and every constraint a reason', () => {
    for (const axis of manifest.axes) {
      expect(axis.options.length).toBeGreaterThan(0)
      for (const option of axis.options) expect(option.title).toBeTruthy()
    }
    for (const constraint of manifest.constraints) {
      expect(constraint.because).toBeTruthy()
      // A rule nobody can act on is not a rule.
      expect(Object.keys(constraint.allow).length).toBeGreaterThan(0)
    }
  })

  it('has defaults that are themselves valid', () => {
    for (const target of ['workers', 'node'] as const) {
      expect(validate(withDefaults({ name: 'x', target })).valid).toBe(true)
    }
  })
})

describe('Workers cannot take what a Worker has not got', () => {
  it('refuses a filesystem data adapter, because there is no disk', () => {
    const { valid, problems } = validate(withDefaults({ ...workers, data: 'filesystem-data' }))
    expect(valid).toBe(false)
    expect(problems[0]).toMatchObject({ axis: 'data', chosen: 'filesystem-data', constraint: 'workers-data' })
    expect(problems[0].because).toMatch(/no disk/i)
  })

  it('refuses Postgres', () => {
    expect(validate(withDefaults({ ...workers, data: 'postgres-data' })).valid).toBe(false)
  })

  it('refuses filesystem media', () => {
    const { problems } = validate(withDefaults({ ...workers, media: 'filesystem-media' }))
    expect(problems.map(p => p.constraint)).toContain('workers-media')
  })

  it('refuses sharp, because Workers runs no native code', () => {
    const { problems } = validate(withDefaults({ ...workers, images: 'sharp' }))
    expect(problems[0].because).toMatch(/native/i)
  })

  it('accepts the edge combination, with or without image processing', () => {
    expect(validate(withDefaults({ ...workers, images: 'cloudflare-images' })).valid).toBe(true)
    expect(validate(withDefaults({ ...workers, images: 'none' })).valid).toBe(true)
  })
})

describe('Node cannot take bindings that only exist in a Worker', () => {
  it('refuses D1 and R2', () => {
    expect(validate(withDefaults({ ...node, data: 'cloudflare-d1' })).valid).toBe(false)
    expect(validate(withDefaults({ ...node, media: 'cloudflare-r2' })).valid).toBe(false)
  })

  it('refuses the Cloudflare Images binding', () => {
    const { problems } = validate(withDefaults({ ...node, images: 'cloudflare-images' }))
    expect(problems[0].because).toMatch(/inside a Worker/i)
  })

  it('accepts filesystem and Postgres, with sharp or without', () => {
    for (const data of ['filesystem-data', 'postgres-data'] as const) {
      for (const images of ['sharp', 'none'] as const) {
        expect(validate(withDefaults({ ...node, data, images })).valid).toBe(true)
      }
    }
  })
})

describe('composition rules that are not about the runtime', () => {
  it('will not build a site with no content model to render', () => {
    const { problems } = validate(withDefaults({ ...workers, parts: 'full-site', content: 'blank' }))
    expect(problems.map(p => p.constraint)).toContain('content-needs-schemas')
  })

  it('is happy with a headless API and no content at all', () => {
    expect(validate(withDefaults({ ...workers, parts: 'api', content: 'blank' })).valid).toBe(true)
  })
})

describe('reporting', () => {
  it('reports every problem, not only the first', () => {
    const { problems } = validate({ name: 'x', target: 'workers', data: 'filesystem-data', media: 'filesystem-media', images: 'sharp', parts: 'api', content: 'blank' })
    expect(problems.map(p => p.axis).sort()).toEqual(['data', 'images', 'media'])
  })

  it('names an unknown value as unknown rather than disallowed', () => {
    const { problems } = validate({ ...withDefaults(workers), data: 'mysql' as never })
    expect(problems.some(p => p.constraint === 'known-option')).toBe(true)
  })

  it('explains itself in a form a person can act on', () => {
    const { problems } = validate(withDefaults({ ...workers, images: 'sharp' }))
    const text = describeProblems(problems)
    expect(text).toContain('images')
    expect(text).toContain('Try:')
  })
})

describe('optionsFor drives a UI without the UI knowing any rules', () => {
  it('narrows the data choices once a target is picked', () => {
    expect(optionsFor('data', { target: 'workers' })).toEqual(['cloudflare-d1'])
    expect(optionsFor('data', { target: 'node' })).toEqual(['filesystem-data', 'postgres-data'])
  })

  it('narrows image processing per target', () => {
    expect(optionsFor('images', { target: 'workers' })).toEqual(['cloudflare-images', 'none'])
    expect(optionsFor('images', { target: 'node' })).toEqual(['sharp', 'none'])
  })

  it('offers everything when nothing has been chosen', () => {
    expect(optionsFor('target', {})).toEqual(['workers', 'node'])
  })
})

describe('the valid space', () => {
  it('is exactly what we expect it to be', () => {
    const ids = (a: string) => manifest.axes.find(x => x.id === a)!.options.map(o => o.id)
    let valid = 0
    for (const target of ids('target'))
      for (const data of ids('data'))
        for (const media of ids('media'))
          for (const images of ids('images'))
            for (const parts of ids('parts'))
              for (const content of ids('content'))
                if (validate({ name: 'x', target, data, media, images, parts, content } as never).valid) valid++

    // parts x content is 5, not 6: only full-site + blank is impossible.
    // Workers: 1 data x 1 media x 2 images x 5 = 10
    // Node:    2 data x 1 media x 2 images x 5 = 20
    expect(valid).toBe(30)
  })
})
