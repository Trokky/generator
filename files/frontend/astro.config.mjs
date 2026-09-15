import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'

// Pages render on request, reading Trokky in the same Worker: edit in Studio, refresh, it's live.
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
})
