/**
 * What the pages read.
 *
 * They call the core directly rather than the HTTP API: the site is server-side code in the same
 * process as Trokky, so it has the same trust and needs no token, and a render never leaves the
 * process. Only published content is ever returned from here.
 *
 * Nothing in this file is runtime-specific — that is the point. It is byte-identical on Workers
 * and on Node; only `page.ts` differs, because only the way a page gets hold of the core differs.
 *
 * A conference is joined data — a session points at its track and its speakers — so the whole
 * program is loaded once and resolved here. The Studio writes references as `{_ref, _type}`
 * objects and seeds write plain ids; both must join, which is what `refId` is for.
 */
import type { TrokkyCore } from '@trokky/trokky'

/**
 * Where the API is mounted, for the media URLs the browser will fetch. Declared here rather than
 * imported, because the Workers entry that also declares it does not exist on Node.
 */
const API_PATH = '/api'

type Doc = Record<string, any> & { id: string; _status?: string }

const published = { filter: { _status: 'published' } }

/** A Studio reference field stores `{_ref, _type}`; seeds and hand-written content store the
 *  plain id. The adapter matches on the stored shape, so joins read through this — never `===`. */
export const refId = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  const ref = (value as { _ref?: unknown } | null)?._ref
  return typeof ref === 'string' ? ref : null
}

/** A date field is stored exactly as written (`2026-05-13`); the Studio may write a full ISO
 *  datetime. Both are the same day, which is what the schedule groups on. */
const dayOf = (value: unknown): string => (/^\d{4}-\d{2}-\d{2}/.exec(String(value ?? '')) ?? [''])[0]

export interface Site {
  event: Doc | null
  venue: Doc | null
  /** Tracks in their scheduled column order. */
  tracks(): Promise<Doc[]>
  track(id: string): Promise<Doc | null>
  /** Speakers in name order. */
  speakers(): Promise<Doc[]>
  /** One speaker, with sessions reverse-resolved from the session documents. */
  speaker(id: string): Promise<Doc | null>
  sessions(opts?: { day?: string; track?: string; speaker?: string; type?: string }): Promise<Doc[]>
  session(id: string): Promise<Doc | null>
  /** Tiers in platinum, gold, silver, partner order; empty tiers are skipped. */
  sponsorsByTier(): Promise<{ tier: string; sponsors: Doc[] }[]>
  /** The distinct session days, in order. */
  days(): Promise<string[]>
}

const TIERS = ['platinum', 'gold', 'silver', 'partner']

export async function site(core: TrokkyCore): Promise<Site> {
  const [event, venue, trackRows, speakerRows, sessionRows, sponsorRows] = await Promise.all([
    core.getDocument('event', 'event') as Promise<Doc | null>,
    core.getDocument('venue', 'venue') as Promise<Doc | null>,
    core.listDocuments('track', published) as Promise<Doc[]>,
    core.listDocuments('speaker', published) as Promise<Doc[]>,
    core.listDocuments('session', published) as Promise<Doc[]>,
    core.listDocuments('sponsor', published) as Promise<Doc[]>,
  ])

  // Name guards: a hand-written document without a name would otherwise throw once it reached a
  // sort key, and one bad doc would 500 every route on the site.
  const tracks = [...trackRows].sort((a, b) =>
    Number(a.order ?? 0) - Number(b.order ?? 0) || String(a.name ?? '').localeCompare(String(b.name ?? '')))
  const tracksById = new Map(tracks.map(t => [t.id, t]))

  const speakers = [...speakerRows].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
  const speakersById = new Map(speakers.map(sp => [sp.id, sp]))

  const resolveSession = (s: Doc): Doc => ({
    ...s,
    day: dayOf(s.day),
    track: tracksById.get(refId(s.track) ?? '') ?? null,
    speakers: (s.speakers ?? []).map((v: unknown) => speakersById.get(refId(v) ?? '')).filter((sp): sp is Doc => Boolean(sp)),
  })

  const sessions = sessionRows
    .map(resolveSession)
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.start ?? '').localeCompare(String(b.start ?? '')))

  /** A speaker's sessions, reverse-resolved: the speaker document stores none. */
  const sessionsBySpeaker = new Map<string, Doc[]>()
  for (const s of sessions) for (const sp of s.speakers) {
    if (!sessionsBySpeaker.has(sp.id)) sessionsBySpeaker.set(sp.id, [])
    sessionsBySpeaker.get(sp.id)!.push(s)
  }

  const sessionById = new Map(sessions.map(s => [s.id, s]))

  return {
    event,
    venue,

    tracks: async () => tracks,
    track: async id => tracksById.get(id) ?? null,

    speakers: async () => speakers,
    speaker: async id => {
      const sp = speakersById.get(id)
      return sp ? { ...sp, sessions: sessionsBySpeaker.get(id) ?? [] } : null
    },

    sessions: async ({ day, track, speaker, type } = {}) => sessions.filter(s =>
      (!day || s.day === day) &&
      (!track || s.track?.id === track) &&
      (!type || s.type === type) &&
      (!speaker || s.speakers.some((sp: Doc) => sp.id === speaker))
    ),
    session: async id => sessionById.get(id) ?? null,

    sponsorsByTier: async () => {
      const tiers = new Map(TIERS.map(t => [t, [] as Doc[]]))
      for (const sp of sponsorRows) if (tiers.has(sp.tier)) tiers.get(sp.tier)!.push(sp)
      return [...tiers.entries()].filter(([, sponsors]) => sponsors.length > 0).map(([tier, sponsors]) => ({ tier, sponsors }))
    },

    // A session with no parseable day gets '' from dayOf; it must not become a phantom column.
    days: async () => [...new Set(sessions.map(s => s.day).filter(Boolean))].sort(),
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

/** Formatting and the generated marks, shared by the pages and the components. */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-05-13` — or the Studio's datetime form of it — as `Wed 13 May`. */
export const formatDate = (value: unknown): string => {
  const day = dayOf(value)
  if (!day) return ''
  const d = new Date(`${day}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const formatDateRange = (start: unknown, end: unknown): string => {
  const s = dayOf(start).slice(0, 10)
  const e = dayOf(end).slice(0, 10)
  if (!s || !e) return ''
  const a = new Date(`${s}T00:00:00`)
  const b = new Date(`${e}T00:00:00`)
  if (a.getMonth() === b.getMonth()) {
    return `${MONTHS[a.getMonth()]} ${a.getDate()}–${b.getDate()}, ${b.getFullYear()}`
  }
  return `${formatDate(s)} – ${formatDate(e)}`
}

/**
 * The generated marks: speakers and sponsors without an uploaded image render a deterministic
 * monogram instead, seeded from a string so the same name always gets the same color — the
 * site ships no image assets at all.
 */
export const hashStr = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)

const MARK_COLORS = ['#C8442B', '#2C6E6A', '#B8860B', '#5B4B8A', '#3D6B9E', '#8A3324', '#4A6741', '#7A4B6E']
export const colorFor = (s: string): string => MARK_COLORS[hashStr(s) % MARK_COLORS.length]

export const initials = (name: string): string =>
  name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()