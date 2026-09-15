/**
 * The one line every page starts with: Trokky, from the Worker's bindings.
 *
 * Astro 6+ dropped `Astro.locals.runtime.env`; the bindings come from the `cloudflare:workers`
 * module instead, which is importable from anywhere in the Worker.
 */
import { env } from 'cloudflare:workers'
import { getTrokky, type TrokkyEnv } from './core'
import { site, type Site } from './site'

export async function load(): Promise<Site> {
  const { core } = await getTrokky(env as unknown as TrokkyEnv)
  return site(core)
}
