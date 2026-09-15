/**
 * The content model: a magazine.
 *
 * Chosen because it exercises what a newcomer evaluates a CMS on — references both ways,
 * rich text, media in two kinds (images and PDFs), drafts, slugs, a singleton — in a shape
 * everyone already understands. Rename, add and remove freely; the Studio follows the schema.
 */

export const settingsSchema = {
  name: 'settings',
  title: 'Site settings',
  type: 'document',
  singleton: true,
  description: 'Name, navigation and footer for the whole site',
  fields: {
    siteName: { type: 'string', title: 'Site name', required: true, default: 'The Magazine' },
    tagline: { type: 'string', title: 'Tagline', description: 'One line under the name' },
    tagline_fr: { type: 'string', title: 'Tagline (français)' },
    logo: { type: 'media', title: 'Logo', options: { accept: 'image/*' } },
    navigation: {
      type: 'array',
      title: 'Navigation',
      description: 'Links in the header, in order',
      of: {
        type: 'object',
        fields: {
          label: { type: 'string', title: 'Label', required: true },
          href: { type: 'string', title: 'Path or URL', required: true }
        }
      }
    },
    footer: { type: 'text', title: 'Footer text', options: { rows: 2 } },
    footer_fr: { type: 'text', title: 'Footer text (français)', options: { rows: 2 } }
  }
} as const

export const authorSchema = {
  name: 'author',
  title: 'Author',
  type: 'document',
  fields: {
    name: { type: 'string', title: 'Name', required: true },
    slug: { type: 'slug', title: 'URL', source: 'name', autoGenerate: true, required: true },
    role: { type: 'string', title: 'Role', description: 'Editor, contributor, photographer…' },
    bio: { type: 'text', title: 'Bio', options: { rows: 4 } },
    avatar: { type: 'media', title: 'Photo', options: { accept: 'image/*' } }
  }
} as const

export const categorySchema = {
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: {
    name: { type: 'string', title: 'Name', required: true },
    slug: { type: 'slug', title: 'URL', source: 'name', autoGenerate: true, required: true },
    description: { type: 'text', title: 'Description', options: { rows: 2 } }
  }
} as const

export const articleSchema = {
  name: 'article',
  title: 'Article',
  type: 'document',
  description: 'A story. Save as draft, publish when ready.',
  fields: {
    title: { type: 'string', title: 'Title', required: true, validation: { maxLength: 150 } },
    title_fr: { type: 'string', title: 'Title (français)', validation: { maxLength: 150 } },
    slug: { type: 'slug', title: 'URL', source: 'title', autoGenerate: true, required: true },
    excerpt: { type: 'text', title: 'Excerpt', description: 'Shown in lists', options: { rows: 3 }, validation: { maxLength: 300 } },
    cover: { type: 'media', title: 'Cover image', options: { accept: 'image/*' } },
    author: { type: 'reference', title: 'Author', to: 'author' },
    category: { type: 'reference', title: 'Category', to: 'category' },
    featured: { type: 'boolean', title: 'Featured on the home page', default: false },
    publishedAt: { type: 'date', title: 'Published on', options: { includeTime: true }, default: 'now' },
    body: {
      type: 'richtext',
      title: 'Body',
      options: { headingLevels: [2, 3], enableFullscreen: true, minHeight: '320px', showStats: true }
    },
    related: {
      type: 'array',
      title: 'Related articles',
      of: { type: 'reference', to: 'article' },
      validation: { maxItems: 3 }
    }
  }
} as const

export const documentSchema = {
  name: 'document',
  title: 'Document',
  type: 'document',
  description: 'A downloadable file — a report, a form, a PDF',
  fields: {
    title: { type: 'string', title: 'Title', required: true },
    slug: { type: 'slug', title: 'URL', source: 'title', autoGenerate: true, required: true },
    summary: { type: 'text', title: 'Summary', options: { rows: 2 } },
    file: { type: 'media', title: 'File', required: true, options: { accept: 'application/pdf' } },
    publishedAt: { type: 'date', title: 'Published on', default: 'now' }
  }
} as const

export const pageSchema = {
  name: 'page',
  title: 'Page',
  type: 'document',
  description: 'A standalone page such as About or Contact',
  fields: {
    title: { type: 'string', title: 'Title', required: true },
    slug: { type: 'slug', title: 'URL', source: 'title', autoGenerate: true, required: true },
    body: { type: 'richtext', title: 'Body', options: { headingLevels: [2, 3] } }
  }
} as const

export const schemas = [settingsSchema, authorSchema, categorySchema, articleSchema, documentSchema, pageSchema]
