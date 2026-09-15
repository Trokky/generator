/**
 * The manifest is the single source of truth for what can be composed and what cannot.
 *
 * It is plain data, published as `manifest.json` beside the code, so every surface reads the
 * same rules: `npm create trokky@latest`, the trokky.build configurator, and `trokky new` in the
 * Go CLI. Nothing reimplements them — a second implementation is a second set of bugs, and these
 * particular rules were each learned the expensive way.
 */

import manifestJson from '../manifest.json' with { type: 'json' }

export type AxisId = 'target' | 'data' | 'media' | 'images' | 'parts' | 'content'

export interface Option {
  id: string
  title: string
  hint?: string
}

export interface Axis {
  id: AxisId
  title: string
  options: Option[]
}

/**
 * "When the config looks like `when`, only these values are allowed."
 *
 * `because` is not decoration: a builder that refuses a combination without saying why teaches
 * nobody. Every surface shows it.
 */
export interface Constraint {
  id: string
  when: Partial<Record<AxisId, string>>
  allow: Partial<Record<AxisId, string[]>>
  because: string
}

export interface Secret {
  name: string
  generate: 'hex32' | 'hex24'
  why: string
}

export interface Manifest {
  manifestVersion: number
  axes: Axis[]
  constraints: Constraint[]
  defaults: Record<string, Partial<Record<AxisId, string>>>
  secrets: Record<string, Secret[]>
}

export const manifest = manifestJson as unknown as Manifest

export const axis = (id: AxisId): Axis => {
  const found = manifest.axes.find(a => a.id === id)
  if (!found) throw new Error(`Unknown axis: ${id}`)
  return found
}
