/**
 * Sample content, created the moment the instance is claimed.
 *
 * An empty CMS shows an empty site, and the first minute decides whether a newcomer keeps
 * going. So the new owner's first sight of both the site and the Studio is a working magazine —
 * illustrated, with authors, categories, downloadable documents and pages — that they can edit
 * or delete. Every document id is fixed, so seeding twice is harmless; media is only uploaded
 * when there are no articles yet.
 *
 * The images and PDFs ship with the project and go through the normal upload pipeline, so
 * thumbnails are made exactly as they would be for a real upload.
 *
 * How those files are read differs by runtime — a Worker has an assets binding, a Node process
 * has a disk — so the caller supplies a reader rather than this file guessing.
 */
import type { TrokkyCore } from '@trokky/trokky'

/** Read one file from `public/seed/`, however this runtime reaches it. */
export type SeedAssetReader = (path: string) => Promise<ArrayBuffer>

const P = { _status: 'published' } as const

/** The value the Studio's media field reads and writes. */
const media = (id: string, alt?: string) => ({ _type: 'media', asset: { _type: 'mediaAsset', _ref: id }, ...(alt ? { alt } : {}) })

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const paras = (...ps: string[]) => ps.map(p => `<p>${p}</p>`).join('')

export async function seedSampleContent(core: TrokkyCore, readAsset: SeedAssetReader): Promise<void> {
  if ((await core.listDocuments('article', { limit: 1 })).length > 0) return

  const upload = async (path: string, filename: string, type: string): Promise<string> => {
    const file = new File([await readAsset(path)], filename, { type })
    return (await core.uploadMedia(file)).id
  }

  const [c1, c2, c3, c4, c5, c6] = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(n => upload(`cover-${n}.jpg`, `cover-${n}.jpg`, 'image/jpeg'))
  )
  const [a1, a2, a3] = await Promise.all(
    [1, 2, 3].map(n => upload(`avatar-${n}.jpg`, `portrait-${n}.jpg`, 'image/jpeg'))
  )
  const [pdfReport, pdfGuide] = await Promise.all([
    upload('annual-report-2026.pdf', 'annual-report-2026.pdf', 'application/pdf'),
    upload('editorial-guidelines.pdf', 'editorial-guidelines.pdf', 'application/pdf')
  ])

  await core.saveDocument('settings', {
    id: 'settings', ...P,
    siteName: 'The Magazine',
    tagline: 'Stories worth the read',
    tagline_fr: 'Des histoires qui valent le détour',
    navigation: [
      { label: 'Articles', href: '/articles' },
      { label: 'Documents', href: '/documents' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' }
    ],
    footer: 'Published with Trokky. Everything you see here is editable in Studio.',
    footer_fr: 'Publié avec Trokky. Tout ce que vous voyez se modifie dans Studio.'
  })

  await core.saveDocument('author', { id: 'author-ama', ...P, name: 'Ama Kodjo', slug: 'ama-kodjo', role: 'Editor', bio: 'Runs the magazine and writes the long pieces. Previously ten years in print.', avatar: media(a1, 'Ama Kodjo') })
  await core.saveDocument('author', { id: 'author-kossi', ...P, name: 'Kossi Mensah', slug: 'kossi-mensah', role: 'Contributor', bio: 'Reports from the field, mostly on foot.', avatar: media(a2, 'Kossi Mensah') })
  await core.saveDocument('author', { id: 'author-efua', ...P, name: 'Efua Asante', slug: 'efua-asante', role: 'Photographer', bio: 'Shoots the covers and occasionally writes about how.', avatar: media(a3, 'Efua Asante') })

  await core.saveDocument('category', { id: 'category-culture', ...P, name: 'Culture', slug: 'culture', description: 'Books, music, and the people behind them.' })
  await core.saveDocument('category', { id: 'category-tech', ...P, name: 'Technology', slug: 'technology', description: 'What is changing, and what it changes.' })
  await core.saveDocument('category', { id: 'category-city', ...P, name: 'City', slug: 'city', description: 'Streets, markets, and the life between buildings.' })

  await core.saveDocument('article', {
    id: 'article-welcome', ...P,
    title: 'Welcome to your magazine', title_fr: 'Bienvenue dans votre magazine',
    slug: 'welcome-to-your-magazine',
    excerpt: 'This site is yours. Here is how it fits together, and what to change first.',
    cover: media(c1, 'A desk with a notebook and coffee'),
    author: 'author-ama', category: 'category-tech', featured: true, publishedAt: daysAgo(0),
    body: paras(
      'Everything on this site comes from the Studio at <a href="/studio">/studio</a>. This article, the authors, the categories, the navigation in the header — all of it is content you can edit.',
      'Start with <strong>Site settings</strong>: give the magazine its real name. Then open this article and change the title. Refresh the home page. That is the whole loop.',
      'Articles can be drafts. A draft is saved but not shown here; publish it when it is ready. The <em>featured</em> switch decides what leads the home page.'
    ),
    related: ['article-references', 'article-media']
  })
  await core.saveDocument('article', {
    id: 'article-references', ...P,
    title: 'Authors, categories, and how references work', slug: 'authors-categories-and-references',
    excerpt: 'An article points at an author and a category. Change the author once and every article follows.',
    cover: media(c2), author: 'author-kossi', category: 'category-tech', featured: false, publishedAt: daysAgo(1),
    body: paras(
      'This article references <strong>Kossi Mensah</strong> as its author. Open the Authors list, rename him, and come back: the byline changed, because the article stores a reference, not a copy.',
      'Categories work the same way, and so do the related articles at the bottom of this page.'
    ),
    related: ['article-welcome']
  })
  await core.saveDocument('article', {
    id: 'article-media', ...P,
    title: 'Images and documents', slug: 'images-and-documents',
    excerpt: 'Every cover on this site was uploaded once; the thumbnails were made automatically.',
    cover: media(c3), author: 'author-efua', category: 'category-culture', featured: false, publishedAt: daysAgo(2),
    body: paras(
      'The cover above is an original upload. The smaller version in the article list is a thumbnail generated at upload time — you never resize anything by hand.',
      'The <a href="/documents">Documents</a> section holds files rather than stories: reports, forms, anything people download.'
    ),
    related: ['article-welcome']
  })
  await core.saveDocument('article', {
    id: 'article-market', ...P,
    title: 'Saturday at the market, before the heat', slug: 'saturday-at-the-market',
    excerpt: 'Six in the morning is when the market belongs to the people who run it.',
    cover: media(c4), author: 'author-kossi', category: 'category-city', featured: false, publishedAt: daysAgo(4),
    body: paras(
      'By nine the aisles are full and the prices are set. Two hours earlier they are still being argued about, crate by crate, between people who have known each other for years.',
      'This piece is placeholder text — replace it with your own reporting. The structure (a title, an excerpt, a cover, a body) is what stays.'
    )
  })
  await core.saveDocument('article', {
    id: 'article-drafts', ...P,
    title: 'Drafts, publishing, and what readers see', slug: 'drafts-and-publishing',
    excerpt: 'Save without publishing, publish when ready, unpublish without deleting.',
    cover: media(c5), author: 'author-ama', category: 'category-tech', featured: false, publishedAt: daysAgo(6),
    body: paras(
      'Open this article in Studio and set it back to draft. Refresh this page: it is gone from the site, but nothing was deleted. Publish it again and it returns.',
      'The site only ever reads published content. Drafts are yours alone.'
    )
  })
  await core.saveDocument('article', {
    id: 'article-listening', ...P,
    title: 'What the city sounds like at night', slug: 'what-the-city-sounds-like-at-night',
    excerpt: 'A photographer on the difference between looking and listening.',
    cover: media(c6), author: 'author-efua', category: 'category-culture', featured: false, publishedAt: daysAgo(9),
    body: paras(
      'Placeholder text for a longer feature. The photographer who shot the covers on this site talks about working after dark, when the light is bad and the sound is better.',
      'Use it as a shape for your own longer pieces: a strong first line, a cover that earns its place, and section headings when it runs past a screen.'
    )
  })

  await core.saveDocument('document', { id: 'document-report', ...P, title: 'Annual Report 2026', slug: 'annual-report-2026', summary: 'The year in numbers, and what they mean.', file: media(pdfReport), publishedAt: daysAgo(3) })
  await core.saveDocument('document', { id: 'document-guidelines', ...P, title: 'Editorial guidelines', slug: 'editorial-guidelines', summary: 'How we write, and what we will not publish.', file: media(pdfGuide), publishedAt: daysAgo(12) })

  await core.saveDocument('page', { id: 'page-about', ...P, title: 'About', slug: 'about', body: paras('This magazine runs on <a href="https://trokky.dev">Trokky</a>, a self-hosted CMS, on Cloudflare Workers. The content is in a D1 database and the files in an R2 bucket — both on your own account.', 'Replace this page with who you are.') })
  await core.saveDocument('page', { id: 'page-contact', ...P, title: 'Contact', slug: 'contact', body: paras('Put an email address, a form, or a map here. This is an ordinary page: edit it under <strong>Pages</strong> in Studio.') })
}
