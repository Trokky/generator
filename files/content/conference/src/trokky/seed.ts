/**
 * Sample content, created the moment the instance is claimed.
 *
 * An empty CMS shows an empty site, and the first minute decides whether a newcomer keeps
 * going. So the new owner’s first sight of both the site and the Studio is a whole working
 * conference — six tracks, eight speakers, a fourteen-slot program, sponsors, a venue with
 * tickets — that they can edit or delete. Every document id is fixed, so seeding twice is
 * harmless; sessions are only created when there are none. This template ships no media:
 * speakers and sponsors render generated monograms until real uploads replace them.
 */
import type { TrokkyCore } from '@trokky/trokky'

/** Read one file from `public/seed/`. The emitted hook always passes a reader; here it goes
 *  unused, because this template’s seeds are text documents only. */
export type SeedAssetReader = (path: string) => Promise<ArrayBuffer>

const P = { _status: 'published' } as const

export async function seedSampleContent(core: TrokkyCore, readAsset: SeedAssetReader): Promise<void> {
  if ((await core.listDocuments('session', { limit: 1 })).length > 0) return

  await core.saveDocument('event', {
    id: 'event', ...P,
    name: 'Frameworks Live',
    edition: '2026',
    tagline: 'A field guide to building for the next decade of the web.',
    description: 'Three days, six tracks, fourteen sessions and eight speakers. Frameworks Live is the annual gathering for the people who build the platforms other developers build on — runtimes, editors, headless CMSs, and the frameworks that tie them together.',
    startDate: '2026-05-13',
    endDate: '2026-05-15',
    city: 'Lisbon',
    venue: 'Cordoaria Nacional',
    stats: [
      { label: 'Days', value: '3' },
      { label: 'Tracks', value: '6' },
      { label: 'Sessions', value: '14' },
      { label: 'Speakers', value: '8' }
    ],
    ctaLabel: 'Get your pass',
    ctaHref: '/venue#tickets',
    navigation: [
      { label: 'Schedule', href: '/schedule' },
      { label: 'Speakers', href: '/speakers' },
      { label: 'Sessions', href: '/sessions' },
      { label: 'Sponsors', href: '/sponsors' },
      { label: 'Venue', href: '/venue' }
    ]
  })

  await core.saveDocument('venue', {
    id: 'venue', ...P,
    name: 'Cordoaria Nacional',
    address: 'Av. da Índia, 2050-014 Lisboa, Portugal',
    about: 'A former 18th-century rope factory on the Lisbon waterfront, now a landmark hall for the city’s biggest gatherings. Forty-foot ceilings, exposed brick, and the Tagus river at the door.',
    travel: [
      { mode: 'Plane', detail: 'Lisbon Airport (LIS) is 7km / 20 min by metro. Direct shuttles run every 20 minutes during conference days.' },
      { mode: 'Metro', detail: 'Take the Linha Verde (green) to Cais do Sodré, then a 10-minute riverside walk west along Av. da Índia.' },
      { mode: 'Bike', detail: 'Secure bike parking on the riverside promenade. There are 40 racks under the western canopy.' },
      { mode: 'Car', detail: 'Limited paid parking on-site (€6/day). We strongly recommend transit — the riverside approach is walk-only during event hours.' }
    ],
    tickets: [
      {
        name: 'Conference',
        price: '€420',
        note: 'All three days, all tracks, recordings included.',
        features: ['3-day full access', '14 sessions, 6 tracks', 'Recordings within 48h', 'Welcome reception'],
        featured: false
      },
      {
        name: 'Workshop',
        price: '€180',
        note: 'Single workshop seat, limited capacity.',
        features: ['One 90-min workshop', 'Same-day track access', 'Lunch'],
        featured: false
      },
      {
        name: 'Community',
        price: '€0',
        note: 'For maintainers of qualifying open projects.',
        features: ['Full access, sponsored seats', 'Apply with your project', 'Travel fund available'],
        featured: true
      }
    ]
  })

  await core.saveDocument('track', { id: 'track-01', ...P, name: 'Runtimes', room: 'Hall A', color: '#C8442B', order: 1 })
  await core.saveDocument('track', { id: 'track-02', ...P, name: 'Editors & DX', room: 'Hall B', color: '#2C6E6A', order: 2 })
  await core.saveDocument('track', { id: 'track-03', ...P, name: 'Headless & Content', room: 'Hall C', color: '#B8860B', order: 3 })
  await core.saveDocument('track', { id: 'track-04', ...P, name: 'Frameworks', room: 'Hall D', color: '#5B4B8A', order: 4 })
  await core.saveDocument('track', { id: 'track-05', ...P, name: 'Edge & Infra', room: 'Hall E', color: '#3D6B9E', order: 5 })
  await core.saveDocument('track', { id: 'track-06', ...P, name: 'Community', room: 'Hall F', color: '#8A3324', order: 6 })

  await core.saveDocument('speaker', {
    id: 'speaker-01', ...P,
    name: 'Nadia Eke', role: 'Runtime engineer', org: 'Meridian Runtime', pronouns: 'she/her',
    bio: 'Nadia works on the engine’s optimizer pipeline and has shipped the fast-calls path used by every modern serverless runtime. Before that she built JIT profilers at a trading firm where milliseconds were measured in dollars.',
    city: 'Munich'
  })
  await core.saveDocument('speaker', {
    id: 'speaker-02', ...P,
    name: 'Tomás Ribeiro', role: 'Editor architect', org: 'Quillworks', pronouns: 'he/him',
    bio: 'Tomás leads the rendering layer of a popular collaborative editor. He thinks a lot about CRDTs, latency budgets, and why your editor’s cursor jump is the most intimate thing in software.',
    city: 'Lisbon'
  })
  await core.saveDocument('speaker', {
    id: 'speaker-03', ...P,
    name: 'Priya Nair', role: 'Founder', org: 'Blockhead CMS', pronouns: 'she/they',
    bio: 'Priya built and open-sourced a headless CMS now used by two thousand studios. She writes about structured content, schema-first design, and why your blog should not be a database table.',
    city: 'Bangalore'
  })
  await core.saveDocument('speaker', {
    id: 'speaker-04', ...P,
    name: 'Marcus Feld', role: 'Framework maintainer', org: 'Lumen UI', pronouns: 'he/him',
    bio: 'Marcus is a core maintainer on a fine-grained reactive framework and has been writing about signals long before they were cool. He will not let you call them "reactive state".',
    city: 'Berlin'
  })
  await core.saveDocument('speaker', {
    id: 'speaker-05', ...P,
    name: 'Lucia Moreau', role: 'Edge platform lead', org: 'Kestrel Compute', pronouns: 'she/her',
    bio: 'Lucia runs the runtime-at-the-edge team at a global compute platform. She has opinions about cold starts that she will share whether or not you ask.',
    city: 'Paris'
  })
  await core.saveDocument('speaker', {
    id: 'speaker-06', ...P,
    name: 'Devon Park', role: 'DX advocate', org: 'Northship', pronouns: 'they/them',
    bio: 'Devon writes the docs that get screenshot-ed into conference talks. They care about error messages, onboarding flows, and the shape of the first ten minutes of a tool.',
    city: 'New York'
  })
  await core.saveDocument('speaker', {
    id: 'speaker-07', ...P,
    name: 'Hana Sato', role: 'Tooling engineer', org: 'Furlong', pronouns: 'she/her',
    bio: 'Hana works on bundler internals and has been quietly deleting milliseconds from the dev-server startup path for four years.',
    city: 'Tokyo'
  })
  await core.saveDocument('speaker', {
    id: 'speaker-08', ...P,
    name: 'Idris Bello', role: 'Community lead', org: 'Commons Fund', pronouns: 'he/him',
    bio: 'Idris helps maintainers get paid. He has read more maintainer burnout post-mortems than anyone and will tell you what they have in common.',
    city: 'Lagos'
  })

  await core.saveDocument('session', {
    id: 'session-01', ...P,
    title: 'Fast-calls: stealing 40µs from every function call',
    type: 'Talk', day: '2026-05-13', start: '09:30', end: '10:15',
    track: 'track-01', speakers: ['speaker-01'],
    abstract: 'A deep dive into the inline-cache path that lets modern runtimes skip argument count checks. We’ll look at the bytecode, the assembly the engine actually emits, and the one flag you can flip in your own runtime to inherit the speedup.',
    tags: ['runtime', 'performance', 'jit'],
    level: 'Advanced'
  })
  await core.saveDocument('session', {
    id: 'session-02', ...P,
    title: 'The cursor is the interface',
    type: 'Talk', day: '2026-05-13', start: '10:30', end: '11:15',
    track: 'track-02', speakers: ['speaker-02'],
    abstract: 'Why does a remote cursor jump the wrong way? A tour of CRDT selection-state, the difference between presence and intent, and how to make a collaborative editor feel local at 300ms round-trip.',
    tags: ['crdt', 'editors', 'realtime'],
    level: 'Intermediate'
  })
  await core.saveDocument('session', {
    id: 'session-03', ...P,
    title: 'Your content model is your API',
    type: 'Keynote', day: '2026-05-13', start: '11:30', end: '12:30',
    track: 'track-03', speakers: ['speaker-03'],
    abstract: 'A keynote on why a headless CMS is really a typed query language, what a good content schema gets you for free, and the design decisions behind an open one.',
    tags: ['cms', 'structured-content', 'open-source'],
    level: 'All'
  })
  await core.saveDocument('session', {
    id: 'session-04', ...P,
    title: 'Signals without the magic',
    type: 'Talk', day: '2026-05-13', start: '14:00', end: '14:45',
    track: 'track-04', speakers: ['speaker-04'],
    abstract: 'Fine-grained reactivity from first principles: a 60-line reimplementation of a signal store, and where the real frameworks spend the rest of their lines.',
    tags: ['frameworks', 'reactivity', 'ui'],
    level: 'Intermediate'
  })
  await core.saveDocument('session', {
    id: 'session-05', ...P,
    title: 'Cold starts are a design problem',
    type: 'Talk', day: '2026-05-13', start: '15:00', end: '15:45',
    track: 'track-05', speakers: ['speaker-05'],
    abstract: 'Snapshot restore, lazy module init, and the trade-off between image size and first-request latency. Numbers from a platform that serves a billion functions a day.',
    tags: ['edge', 'serverless', 'performance'],
    level: 'Advanced'
  })
  await core.saveDocument('session', {
    id: 'session-06', ...P,
    title: 'The first ten minutes',
    type: 'Talk', day: '2026-05-13', start: '16:00', end: '16:45',
    track: 'track-02', speakers: ['speaker-06'],
    abstract: 'A practical framework for auditing a developer’s first ten minutes with your tool. Bring your own README.',
    tags: ['dx', 'docs', 'onboarding'],
    level: 'All'
  })
  await core.saveDocument('session', {
    id: 'session-07', ...P,
    title: 'Workshop: build a multiplayer editor in 90 minutes',
    type: 'Workshop', day: '2026-05-14', start: '09:30', end: '11:00',
    track: 'track-02', speakers: ['speaker-02'],
    abstract: 'Hands-on: from a textarea to a CRDT-backed collaborative editor with presence, cursors, and undo. Laptop required; we’ll provide the starter repo.',
    tags: ['crdt', 'workshop', 'editors'],
    level: 'Intermediate'
  })
  await core.saveDocument('session', {
    id: 'session-08', ...P,
    title: 'Deleting the dev-server restart',
    type: 'Talk', day: '2026-05-14', start: '11:15', end: '12:00',
    track: 'track-04', speakers: ['speaker-07'],
    abstract: 'How a dev server can keep module graphs hot across file moves and renames, and the dirty module-cache tricks that make it feel instant.',
    tags: ['tooling', 'dx', 'bundler'],
    level: 'Advanced'
  })
  await core.saveDocument('session', {
    id: 'session-09', ...P,
    title: 'Panel: what is a runtime, now?',
    type: 'Panel', day: '2026-05-14', start: '14:00', end: '15:00',
    track: 'track-01', speakers: ['speaker-01', 'speaker-05'],
    abstract: 'The line between a runtime, a framework, and a platform has dissolved. Where do the people who build them draw it now?',
    tags: ['runtime', 'panel', 'platforms'],
    level: 'All'
  })
  await core.saveDocument('session', {
    id: 'session-10', ...P,
    title: 'Paying maintainers without burning them out',
    type: 'Talk', day: '2026-05-14', start: '15:15', end: '16:00',
    track: 'track-06', speakers: ['speaker-08'],
    abstract: 'What three years of maintainer-funding data says about which models actually work, and the one variable that predicts burnout better than hours.',
    tags: ['community', 'open-source', 'funding'],
    level: 'All'
  })
  await core.saveDocument('session', {
    id: 'session-11', ...P,
    title: 'Workshop: ship a function to the edge',
    type: 'Workshop', day: '2026-05-14', start: '16:15', end: '17:45',
    track: 'track-05', speakers: ['speaker-05'],
    abstract: 'From local handler to a globally-distributed function with snapshot cold-starts. We’ll measure latency from five regions.',
    tags: ['edge', 'workshop', 'serverless'],
    level: 'Intermediate'
  })
  await core.saveDocument('session', {
    id: 'session-12', ...P,
    title: 'Keynote: the framework is the compiler',
    type: 'Keynote', day: '2026-05-15', start: '09:30', end: '10:30',
    track: 'track-04', speakers: ['speaker-04'],
    abstract: 'UI frameworks are quietly becoming compilers. A look at what we gain when the framework can see your whole component tree at build time.',
    tags: ['frameworks', 'compilers', 'ui'],
    level: 'All'
  })
  await core.saveDocument('session', {
    id: 'session-13', ...P,
    title: 'Bundling for the next decade',
    type: 'Talk', day: '2026-05-15', start: '11:00', end: '11:45',
    track: 'track-04', speakers: ['speaker-07'],
    abstract: 'Native ESM, import attributes, and what a bundler even needs to do when browsers ship most of it natively. Some surprising answers.',
    tags: ['bundler', 'modules', 'tooling'],
    level: 'Intermediate'
  })
  await core.saveDocument('session', {
    id: 'session-14', ...P,
    title: 'Closing: the people who stay',
    type: 'Keynote', day: '2026-05-15', start: '16:00', end: '17:00',
    track: 'track-06', speakers: ['speaker-08'],
    abstract: 'A closing reflection on the people who maintain the invisible platforms the rest of us build on, and what the next decade asks of them.',
    tags: ['community', 'open-source', 'keynote'],
    level: 'All'
  })

  await core.saveDocument('sponsor', { id: 'sponsor-01', ...P, name: 'Blockhead', tier: 'platinum', blurb: 'The open headless CMS. Hosted or self, structured content for everyone.', url: '#' })
  await core.saveDocument('sponsor', { id: 'sponsor-02', ...P, name: 'Kestrel Compute', tier: 'platinum', blurb: 'Run full apps and databases close to your users, anywhere.', url: '#' })
  await core.saveDocument('sponsor', { id: 'sponsor-03', ...P, name: 'Northship', tier: 'gold', blurb: 'The platform for frontend developers.', url: '#' })
  await core.saveDocument('sponsor', { id: 'sponsor-04', ...P, name: 'Quillworks', tier: 'gold', blurb: 'The editor built for collaboration at the speed of thought.', url: '#' })
  await core.saveDocument('sponsor', { id: 'sponsor-05', ...P, name: 'Furlong', tier: 'gold', blurb: 'Next generation frontend tooling.', url: '#' })
  await core.saveDocument('sponsor', { id: 'sponsor-06', ...P, name: 'Lumen UI', tier: 'silver', blurb: 'Simple performant reactive UI.', url: '#' })
  await core.saveDocument('sponsor', { id: 'sponsor-07', ...P, name: 'Commons Fund', tier: 'silver', blurb: 'Funding for open source communities.', url: '#' })
  await core.saveDocument('sponsor', { id: 'sponsor-08', ...P, name: 'Cordoaria Press', tier: 'partner', blurb: 'Independent publisher of the proceedings.', url: '#' })
}