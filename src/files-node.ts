/**
 * The filesystem-backed file source, for the CLI. Imported separately so nothing that runs in a
 * browser or a Worker ever pulls `node:fs` in behind it.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBinaryPath, type FileSet, type FileSource } from './files.js'

const here = dirname(fileURLToPath(import.meta.url))
/** `files/` sits beside `dist/` in the published package and beside `src/` in the repo. */
export const FILES_ROOT = join(here, '..', 'files')

export function fsFileSource(root: string = FILES_ROOT): FileSource {
  return {
    read(set) {
      const setRoot = join(root, set)
      // Loud, not silent: a set that is missing from the package would otherwise produce a
      // project quietly short of files instead of an error anyone can act on.
      if (!existsSync(setRoot)) {
        throw new Error(`File set missing from the package: ${setRoot}. Check the "files" field and npm's ignore rules.`)
      }

      const files: FileSet = new Map()
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry)
          if (statSync(full).isDirectory()) {
            walk(full)
            continue
          }
          const rel = relative(setRoot, full).split(sep).join('/')
          files.set(rel, isBinaryPath(rel) ? new Uint8Array(readFileSync(full)) : readFileSync(full, 'utf8'))
        }
      }
      walk(setRoot)
      return files
    },
  }
}
