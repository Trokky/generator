/**
 * Adding a content model should be adding directories and a manifest entry — not editing the
 * generator. These tests are the contract that keeps that true, because the coupling between a
 * content model and the site that renders it is easy to leave implicit and painful to discover
 * later: pages are written against particular collections, so a model without its own pages
 * cannot be offered a frontend.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { manifest } from '../src/manifest.js'
import { validate, optionsFor } from '../src/validate.js'
import { generate } from '../src/generate.js'
import { withDefaults } from '../src/config.js'
import { fsFileSource, FILES_ROOT } from '../src/files-node.js'

const source = fsFileSource()
const contentOptions = manifest.axes.find(axis => axis.id === 'content')!.options.map(option => option.id)
const withSite = (id: string): boolean => existsSync(join(FILES_ROOT, 'site', id))

describe('a content model is a pair of directories and a manifest entry', () => {
  it('has a content set for every option except blank', () => {
    for (const id of contentOptions) {
      if (id === 'blank') continue
      expect(existsSync(join(FILES_ROOT, 'content', id)), `files/content/${id}`).toBe(true)
    }
  })

  it('generates from every content option, on both targets', () => {
    for (const id of contentOptions) {
      for (const target of ['workers', 'node'] as const) {
        const parts = withSite(id) ? 'full-site' : 'studio'
        const config = withDefaults({ name: 'x', target, content: id, parts } as never)
        expect(validate(config).valid, `${target}/${id}`).toBe(true)
        expect(() => generate(config, source), `${target}/${id}`).not.toThrow()
      }
    }
  })

  it('ships a seed with every content model, so the first minute is never empty', () => {
    for (const id of contentOptions) {
      if (id === 'blank') continue
      const tree = generate(withDefaults({ name: 'x', target: 'workers', content: id, parts: 'studio' } as never), source)
      expect(tree.has('src/trokky/schemas.ts'), id).toBe(true)
      expect(tree.has('src/trokky/seed.ts'), id).toBe(true)
    }
  })
})

describe('a site belongs to the content model it renders', () => {
  it('offers a frontend for exactly the models that ship pages', () => {
    // The trap this guards: adding files/site/<id> without widening the constraint, so the
    // option exists and the configurator silently refuses it — or the reverse, offering a
    // frontend for a model with no pages, which generates a project that cannot build.
    for (const id of contentOptions) {
      const offered = optionsFor('content', { target: 'workers', parts: 'full-site' }).includes(id)
      expect(offered, `content "${id}": site dir ${withSite(id) ? 'exists' : 'missing'}`).toBe(withSite(id))
    }
  })

  it('gives a headless install the schemas but none of the pages', () => {
    const tree = generate(withDefaults({ name: 'x', target: 'workers', parts: 'studio', content: 'magazine' }), source)
    expect(tree.has('src/trokky/schemas.ts')).toBe(true)
    expect([...tree.keys()].some(path => path.startsWith('src/pages/'))).toBe(false)
    expect(tree.has('astro.config.mjs')).toBe(false)
  })

  it('keeps each model’s pages under its own name, so two models never collide', () => {
    const sites = existsSync(join(FILES_ROOT, 'site')) ? readdirSync(join(FILES_ROOT, 'site')) : []
    expect(sites.length).toBeGreaterThan(0)
    for (const id of sites) {
      expect(contentOptions, `files/site/${id} has no matching content option`).toContain(id)
    }
  })
})

describe('groups are a table of contents a surface can render blind', () => {
  it('gives every axis a group that exists', () => {
    const ids = new Set(manifest.groups.map(group => group.id))
    for (const axis of manifest.axes) {
      expect(axis.group, `axis ${axis.id} has no group`).toBeDefined()
      expect(ids.has(axis.group!), `axis ${axis.id} -> group ${axis.group}`).toBe(true)
    }
  })

  it('declares no group without axes', () => {
    const used = new Set(manifest.axes.map(axis => axis.group))
    for (const group of manifest.groups) {
      expect(used.has(group.id), `group ${group.id} has no axes`).toBe(true)
    }
  })
})
