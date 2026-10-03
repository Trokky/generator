/**
 * The content model: a conference.
 *
 * Two singletons (event, venue) setting the site's copy, four listed collections, and the
 * two many-to-many links a program is made of — sessions point at their track and their
 * speakers. Type, level and tier are plain string fields with dropdown lists, so editors
 * pick from a fixed set and the site can group on the value. The session document id is its
 * URL identity; there are no slug fields.
 */

export const eventSchema = {
  name: 'event',
  title: 'Event',
  type: 'document',
  singleton: true,
  description: 'What the whole site leads with: name, tagline, dates and navigation',
  fields: {
    name: { type: 'string', title: 'Event name', required: true },
    edition: { type: 'string', title: 'Edition', description: 'The year or edition, shown next to the name' },
    tagline: { type: 'string', title: 'Tagline', description: 'One line under the name' },
    description: { type: 'text', title: 'Description', options: { rows: 3 } },
    startDate: { type: 'date', title: 'First day' },
    endDate: { type: 'date', title: 'Last day' },
    city: { type: 'string', title: 'City' },
    venue: { type: 'string', title: 'Venue name', description: 'Shown in the header meta; the Venue document holds the detail' },
    stats: {
      type: 'array',
      title: 'Stat strip',
      description: 'The numbers under the hero, in order',
      of: {
        type: 'object',
        fields: {
          label: { type: 'string', title: 'Label', required: true },
          value: { type: 'string', title: 'Value', required: true }
        }
      }
    },
    ctaLabel: { type: 'string', title: 'Header button label' },
    ctaHref: { type: 'string', title: 'Header button path' },
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
    }
  }
} as const

export const venueSchema = {
  name: 'venue',
  title: 'Venue',
  type: 'document',
  singleton: true,
  description: 'Where the event is, how to get there, and what tickets cost',
  fields: {
    name: { type: 'string', title: 'Venue name', required: true },
    address: { type: 'string', title: 'Address' },
    about: { type: 'text', title: 'About the hall', options: { rows: 3 } },
    travel: {
      type: 'array',
      title: 'Getting there',
      of: {
        type: 'object',
        fields: {
          mode: { type: 'string', title: 'Mode', required: true, description: 'Plane, metro, bike…' },
          detail: { type: 'string', title: 'Detail' }
        }
      }
    },
    tickets: {
      type: 'array',
      title: 'Tickets',
      of: {
        type: 'object',
        fields: {
          name: { type: 'string', title: 'Name', required: true },
          price: { type: 'string', title: 'Price', required: true, description: 'Shown as written, e.g. €420' },
          note: { type: 'string', title: 'Note' },
          features: {
            type: 'array',
            title: 'Features',
            of: { type: 'string' }
          },
          featured: { type: 'boolean', title: 'Highlight', default: false }
        }
      }
    }
  }
} as const

export const trackSchema = {
  name: 'track',
  title: 'Track',
  type: 'document',
  description: 'A room and a theme; the schedule grid uses one column per track',
  fields: {
    name: { type: 'string', title: 'Track name', required: true },
    room: { type: 'string', title: 'Room', required: true },
    color: { type: 'color', title: 'Track color', description: 'Hex color, e.g. #C8442B' },
    order: { type: 'number', title: 'Order', required: true, description: 'Column position in the schedule grid, starting at 1' }
  }
} as const

export const speakerSchema = {
  name: 'speaker',
  title: 'Speaker',
  type: 'document',
  description: 'A person; their sessions are resolved from the session documents',
  fields: {
    name: { type: 'string', title: 'Name', required: true },
    role: { type: 'string', title: 'Role' },
    org: { type: 'string', title: 'Organization' },
    pronouns: { type: 'string', title: 'Pronouns' },
    bio: { type: 'text', title: 'Bio', options: { rows: 3 } },
    photo: { type: 'media', title: 'Photo', description: 'Optional; without one the site draws a monogram', options: { accept: 'image/*' } },
    city: { type: 'string', title: 'City' }
  }
} as const

export const sessionSchema = {
  name: 'session',
  title: 'Session',
  type: 'document',
  description: 'One slot in the program; its id is its URL',
  fields: {
    title: { type: 'string', title: 'Title', required: true },
    type: {
      type: 'string',
      title: 'Type',
      required: true,
      options: { list: ['Keynote', 'Talk', 'Workshop', 'Panel'] }
    },
    day: { type: 'date', title: 'Day', required: true },
    start: { type: 'string', title: 'Starts at', required: true, description: 'HH:MM', validation: { maxLength: 5 } },
    end: { type: 'string', title: 'Ends at', required: true, description: 'HH:MM', validation: { maxLength: 5 } },
    track: { type: 'reference', title: 'Track', to: 'track', required: true },
    speakers: {
      type: 'array',
      title: 'Speakers',
      description: 'Who is in this session',
      of: { type: 'reference', to: 'speaker' }
    },
    abstract: { type: 'text', title: 'Abstract', options: { rows: 3 } },
    tags: { type: 'array', title: 'Tags', of: { type: 'string' } },
    level: {
      type: 'string',
      title: 'Level',
      options: { list: ['All', 'Intro', 'Intermediate', 'Advanced'] }
    }
  }
} as const

export const sponsorSchema = {
  name: 'sponsor',
  title: 'Sponsor',
  type: 'document',
  description: 'A sponsor; the site groups them by tier, in that order',
  fields: {
    name: { type: 'string', title: 'Name', required: true },
    tier: {
      type: 'string',
      title: 'Tier',
      required: true,
      options: { list: ['platinum', 'gold', 'silver', 'partner'] },
      description: 'Lowercase; tiers are grouped in platinum, gold, silver, partner order'
    },
    blurb: { type: 'text', title: 'Blurb', options: { rows: 2 } },
    url: { type: 'url', title: 'Website' },
    logo: { type: 'media', title: 'Logo', description: 'Optional; without one the site draws a wordmark plate', options: { accept: 'image/*' } }
  }
} as const

export const schemas = [eventSchema, venueSchema, trackSchema, speakerSchema, sessionSchema, sponsorSchema]