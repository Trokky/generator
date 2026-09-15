# create-trokky

Compose a [Trokky](https://trokky.dev) project: pick where it runs, where content lives, and how
much of the stack you want.

```bash
npm create trokky@latest
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

## Using it as a library

```ts
import { generate, validate, optionsFor, withDefaults } from 'create-trokky'

optionsFor('data', { target: 'workers' })   // ['cloudflare-d1']
validate({ target: 'workers', images: 'sharp' })   // { valid: false, problems: [...] }

const files = generate(withDefaults({ name: 'my-site', target: 'workers' }))
// Map<path, string | Uint8Array> — pure, nothing touches the disk
```

`generate` is pure so the same function serves the CLI, a zip download and an API install.

## Development

```bash
npm install
npm test          # the rules and the shape of generated trees
npm run smoke     # generate → install → build → boot → claim, per composition
```

`npm test` proves a generated tree is coherent. **`npm run smoke` proves it runs** — and is what
caught a Node project that typechecked, generated cleanly, and died on startup because nothing
imported its adapters.
