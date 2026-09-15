/**
 * Put a generated tree on disk. The only part of the generator that touches the filesystem.
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { FileTree } from './generate.js'

export function writeTree(tree: FileTree, target: string): void {
  if (existsSync(target) && readdirSync(target).length > 0) {
    throw new Error(`${target} is not empty. Choose an empty directory, or a name that does not exist yet.`)
  }
  for (const [path, contents] of tree) {
    const full = join(target, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
}
