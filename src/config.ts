/**
 * A composition, and the defaults that fill in what the caller did not say.
 */

import { manifest, type AxisId } from './manifest.js'

export interface ProjectConfig {
  /** Directory and package name; also the Worker name on Cloudflare. */
  name: string
  target: 'workers' | 'node'
  data: 'filesystem-data' | 'postgres-data' | 'cloudflare-d1'
  media: 'filesystem-media' | 'cloudflare-r2'
  images: 'sharp' | 'cloudflare-images' | 'none'
  parts: 'api' | 'studio' | 'full-site'
  /** Open on purpose: a content model is a pair of directories, not a value this file knows. */
  content: string
  /** Version range written into the generated package.json for @trokky/* . */
  trokkyVersion: string
}

export type PartialConfig = Partial<ProjectConfig> & { name: string; target: ProjectConfig['target'] }

/** Fill a partial choice from the manifest's per-target defaults. */
export function withDefaults(input: PartialConfig): ProjectConfig {
  const defaults = manifest.defaults[input.target] ?? {}
  const pick = <K extends AxisId>(key: K): string => {
    const chosen = (input as Record<string, unknown>)[key]
    if (typeof chosen === 'string') return chosen
    const fallback = defaults[key]
    if (!fallback) throw new Error(`No default for "${key}" on target "${input.target}"`)
    return fallback
  }

  return {
    name: input.name,
    target: input.target,
    data: pick('data') as ProjectConfig['data'],
    media: pick('media') as ProjectConfig['media'],
    images: pick('images') as ProjectConfig['images'],
    parts: pick('parts') as ProjectConfig['parts'],
    content: pick('content') as ProjectConfig['content'],
    trokkyVersion: input.trokkyVersion ?? '^3.4.1',
  }
}

export const hasStudio = (config: ProjectConfig): boolean => config.parts !== 'api'
export const hasFrontend = (config: ProjectConfig): boolean => config.parts === 'full-site'
