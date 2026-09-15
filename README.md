# create-trokky

Compose a [Trokky](https://trokky.dev) project: pick where it runs, where content lives, and how
much of the stack you want.

```bash
npm create trokky@latest
```

Not on npm yet? It runs straight from the repo, no install:

```bash
npx github:Trokky/generator my-site
```

```
Where will it run?
  1) Cloudflare Workers — No server, no disk. D1 + R2.
  2) Node / Express     — A server you run: VPS, Docker, Railway.

What do you want?
  1) API only              — Headless. Bring your own frontend.
  2) API + Studio          — The admin UI, for editors.
  3) API + Studio + a site — An Astro frontend as well.
```

Non-interactive, for scripts and CI:

```bash
npm create trokky@latest my-site -- --yes --target=workers --parts=full-site --content=magazine
```

## What it will not let you build

The generator refuses impossible combinations and says why, instead of handing you a project that
compiles and dies on startup:

```
$ npm create trokky@latest x -- --yes --target=workers --images=sharp
That combination cannot be built:
  images: "sharp" is not available here.
    sharp is a native libvips binding and Workers runs no native code.
    Try: cloudflare-images, none
```

Every such rule lives in [`manifest.json`](./manifest.json) as data — axes, options, constraints,
each with the reason it exists. **Nothing reimplements them.** `npm create trokky@latest`, the
trokky.build configurator and `trokky new` in the Go CLI all read that one file, so they cannot
drift apart.

## The same site, either runtime

`--parts=full-site` gives you an Astro frontend on **both** targets, and the pages are
byte-identical between them:

| | Workers | Node |
|---|---|---|
| Astro adapter | `@astrojs/cloudflare` | `@astrojs/node` in middleware mode, mounted on Express |
| How a page reaches Trokky | bindings from `cloudflare:workers` | the core, passed in as `Astro.locals` |
| Sample content appears | after the claim, in `waitUntil` | at boot, when the store is empty |
| Thumbnails | Cloudflare Images at upload | sharp at upload |

Only `src/trokky/page.ts` and `astro.config.mjs` differ. Every page, every layout and the query
helper are the same file — and on both runtimes a page reads content **in-process**, with no API
token and no HTTP round trip.

## Adding a content model

A content model is two directories and a manifest entry. Nothing in the generator learns its
name.

1. `files/content/<id>/` — `src/trokky/schemas.ts`, `structure.ts`, `seed.ts`, and any
   `public/seed/` assets the seed uploads.
2. `files/site/<id>/` — the Astro pages, layouts and `src/trokky/site.ts` that render it.
   **Optional**: leave it out and the model is headless-only, and the configurator will not offer
   it a frontend. Pages are written against particular collections, which is why a site belongs
   to its model rather than being shared.
3. `manifest.json` — add the option under the `content` axis. If it has a site, add its id to the
   `content-needs-schemas` constraint's `allow` list.

`test/extensibility.test.ts` holds that contract: it fails if a model has pages the configurator
will not offer, or is offered a frontend it has no pages for.

## Using it as a library

```ts
import { generate, validate, optionsFor, withDefaults } from 'create-trokky'

optionsFor('data', { target: 'workers' })   // ['cloudflare-d1']
validate({ target: 'workers', images: 'sharp' })   // { valid: false, problems: [...] }

const files = generate(withDefaults({ name: 'my-site', target: 'workers' }))
// Map<path, string | Uint8Array> — pure, nothing touches the disk
```

`generate` is pure, and it takes its template files from a source you hand it — so the same
function serves a terminal, a browser and an API install:

```ts
import { generate, inlineFileSource } from 'create-trokky'
import { text } from 'create-trokky/generated/files-text'

// No filesystem: this runs in a browser or a Worker.
const files = generate(config, inlineFileSource({ text, binary: {} }))
```

`create-trokky/node` adds `fsFileSource()` and `writeTree()`, which the CLI uses. Nothing in the
main export touches `node:fs`, so a browser bundle never pulls it in.

## Releasing

Tag a version and the workflow publishes it, authenticating through npm **trusted publishing**:
GitHub Actions mints a short-lived OIDC token and npm exchanges it for publish rights, so no
long-lived token lives in this repo. npm attaches a provenance attestation automatically.

Requires npm CLI 11.5.1 or later, which is why the workflow upgrades npm before publishing —
Node 22 ships npm 10, and without the upgrade npm quietly falls back to looking for a token. Before it does, it installs the packed tarball into
an empty project and generates from *that* — because `files/` is most of this package, and npm's
own ignore rules can quietly drop parts of it. Both failures that shipped this way looked perfect
in the source tree: `.gitignore` is never packaged, and an empty directory survives neither git
nor npm.

## Development

```bash
npm install
npm test          # the rules and the shape of generated trees
npm run smoke     # generate → install → build → boot → claim, per composition
```

`npm test` proves a generated tree is coherent. **`npm run smoke` proves it runs**: it generates,
installs, builds, boots, claims the instance the way a first visitor would, checks the claim
cannot happen twice, and fetches a thumbnail — the far end of the whole media pipeline.

It has earned every step of that. It caught a Node project that typechecked, generated cleanly and died
on startup because nothing imported its adapters; two type errors in the emitted server; a
frontend that could not build on Node because a shared file imported a Workers-only one; and a
Node config with no image variants, where every page looked fine and every thumbnail was a 404.
