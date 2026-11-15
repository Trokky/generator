/**
 * How content is arranged: the Studio's sidebar, when there is one, and the document id each
 * singleton is opened and first created under, which the API uses too.
 *
 * The schema decides what a singleton is; this only decides where things appear and which
 * document id the singleton uses.
 */
export const structure = {
  title: 'Conference',
  items: [
    { type: 'documentList', title: 'Sessions', schemaType: 'session', icon: 'presentation-chart-line' },
    { type: 'documentList', title: 'Speakers', schemaType: 'speaker', icon: 'user-group' },
    { type: 'documentList', title: 'Tracks', schemaType: 'track', icon: 'squares-2x2' },
    { type: 'documentList', title: 'Sponsors', schemaType: 'sponsor', icon: 'star' },
    { type: 'divider' },
    { type: 'singleton', title: 'Event', schemaType: 'event', documentId: 'event', icon: 'sparkle' },
    { type: 'singleton', title: 'Venue', schemaType: 'venue', documentId: 'venue', icon: 'map-pin' }
  ]
}