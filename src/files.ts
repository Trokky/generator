/**
 * Where the copied template files come from.
 *
 * The CLI reads them off disk. A browser or a Worker cannot, so the same tree is inlined into a
 * module at build time and read from there. `generate()` takes whichever it is handed, which is
 * what lets one generator serve a terminal, trokky.build and an API install.
 */

/** One file set — `base`, `workers`, `content/magazine`, `frontend` — keyed by path within it. */
export type FileSet = Map<string, string | Uint8Array>

export interface FileSource {
  /** Every file in a set. Throws if the set is not there: a missing set is a packaging bug. */
  read(set: string): FileSet
}

/** Files that are not text; everything else round-trips as UTF-8. */
export const isBinaryPath = (path: string): boolean => /\.(jpg|jpeg|png|gif|webp|pdf|ico|woff2?)$/i.test(path)

/**
 * The shape the build step emits. Text inline, binary base64 — base64 because a generated
 * module has to be valid source, and 1.5MB of JPEG is not.
 */
export interface InlinedFiles {
  text: Record<string, string>
  binary: Record<string, string>
}

const decodeBase64 = (value: string): Uint8Array => {
  // Node and the browser disagree about which of these exists.
  if (typeof atob === 'function') {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  return new Uint8Array(Buffer.from(value, 'base64'))
}

/** A source backed by the inlined bundle — no filesystem, so it runs anywhere. */
export function inlineFileSource(inlined: InlinedFiles): FileSource {
  const setOf = (path: string): string => {
    // `content/magazine/...` is one set; `base/...` is another. Two segments or one.
    const parts = path.split('/')
    return parts[0] === 'content' ? `${parts[0]}/${parts[1]}` : parts[0]
  }

  const sets = new Map<string, FileSet>()
  const add = (path: string, contents: string | Uint8Array): void => {
    const set = setOf(path)
    const within = path.slice(set.length + 1)
    if (!sets.has(set)) sets.set(set, new Map())
    sets.get(set)!.set(within, contents)
  }

  for (const [path, contents] of Object.entries(inlined.text)) add(path, contents)
  for (const [path, base64] of Object.entries(inlined.binary)) add(path, decodeBase64(base64))

  return {
    read(set) {
      const found = sets.get(set)
      if (!found) throw new Error(`File set missing from the bundle: ${set}. Re-run the inline build.`)
      return found
    },
  }
}
