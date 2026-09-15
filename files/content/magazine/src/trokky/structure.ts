/**
 * How content is arranged in the Studio sidebar.
 *
 * The schema decides what a singleton is; this only decides where things appear and which
 * document id the singleton uses.
 */
export const structure = {
  title: 'Magazine',
  items: [
    { type: 'documentList', title: 'Articles', schemaType: 'article', icon: 'newspaper' },
    { type: 'documentList', title: 'Documents', schemaType: 'document', icon: 'document-text' },
    { type: 'divider' },
    { type: 'documentList', title: 'Authors', schemaType: 'author', icon: 'user-group' },
    { type: 'documentList', title: 'Categories', schemaType: 'category', icon: 'tag' },
    { type: 'documentList', title: 'Pages', schemaType: 'page', icon: 'document' },
    { type: 'divider' },
    { type: 'singleton', title: 'Site settings', schemaType: 'settings', documentId: 'settings', icon: 'cog-6-tooth' }
  ]
}
