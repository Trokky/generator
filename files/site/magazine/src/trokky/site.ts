/**
 * What the pages read.
 *
 * They call the core directly rather than the HTTP API: the site is server-side code in the same
 * process as Trokky, so it has the same trust and needs no token, and a render never leaves the
 * process. Only published content is ever returned from here.
 *
 * Nothing in this file is runtime-specific — that is the point. It is byte-identical on Workers
 * and on Node; only `page.ts` differs, because only the way a page gets hold of the core differs.
 */
import type { TrokkyCore } from '@trokky/trokky'

/**
 * Where the API is mounted, for the media URLs the browser will fetch. Declared here rather than
 * imported, because the Workers entry that also declares it does not exist on Node.
 */
const API_PATH = '/api'

type Doc = Record<string, any> & { id: string; _status?: string }

const published = { filter: { _status: 'published' } }

export interface Site {
  settings: Doc | null
  articles(limit?: number): Promise<Doc[]>
  article(slug: string): Promise<Doc | null>
  featured(): Promise<Doc | null>
  author(id: string): Promise<Doc | null>
  authorBySlug(slug: string): Promise<Doc | null>
  category(id: string): Promise<Doc | null>
  categoryBySlug(slug: string): Promise<Doc | null>
  categories(): Promise<Doc[]>
  articlesBy(field: 'author' | 'category', id: string): Promise<Doc[]>
  articlesIn(ids: string[]): Promise<Doc[]>
  documents(): Promise<Doc[]>
  page(slug: string): Promise<Doc | null>
}

const byDateDesc = (a: Doc, b: Doc) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? ''))

export async function site(core: TrokkyCore): Promise<Site> {
  const settings = (await core.getDocument('settings', 'settings')) as Doc | null
  const list = async (collection: string, filter: Record<string, unknown> = {}) =>
    (await core.listDocuments(collection, { filter: { ...published.filter, ...filter } })) as Doc[]
  const one = async (collection: string, filter: Record<string, unknown>) => (await list(collection, filter))[0] ?? null

  return {
    settings,
    articles: async (limit) => (await list('article')).sort(byDateDesc).slice(0, limit),
    article: (slug) => one('article', { slug }),
    featured: async () => (await list('article', { featured: true })).sort(byDateDesc)[0] ?? null,
    author: async (id) => (await core.getDocument('author', id)) as Doc | null,
    authorBySlug: (slug) => one('author', { slug }),
    category: async (id) => (await core.getDocument('category', id)) as Doc | null,
    categoryBySlug: (slug) => one('category', { slug }),
    categories: () => list('category'),
    articlesBy: async (field, id) => (await list('article', { [field]: id })).sort(byDateDesc),
    articlesIn: async (ids) => (await Promise.all(ids.map(id => core.getDocument('article', id)))).filter((d): d is Doc => !!d && d._status === 'published'),
    documents: async () => (await list('document')).sort(byDateDesc),
    page: (slug) => one('page', { slug }),
  }
}

/**
 * A media field holds `{ asset: { _ref: <media id> }, alt?, caption? }` — the shape the Studio
 * reads and writes. A bare id is accepted too, for content written by hand.
 */
export function mediaId(value: unknown): string | null {
  if (typeof value === 'string') return value
  const ref = (value as { asset?: { _ref?: unknown } } | null)?.asset?._ref
  return typeof ref === 'string' ? ref : null
}

export const mediaUrl = (value: unknown, variant?: 'thumbnail' | 'large'): string | null => {
  const id = mediaId(value)
  if (!id) return null
  return variant ? `${API_PATH}/media/${id}/variants/${variant}` : `${API_PATH}/media/${id}/file`
}

export const formatDate = (value: unknown, locale = 'en'): string =>
  value ? new Date(String(value)).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : ''
