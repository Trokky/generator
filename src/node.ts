/**
 * The Node entry point. Everything here needs a filesystem; the main export does not.
 */
export * from './index.js'
export { fsFileSource, FILES_ROOT } from './files-node.js'
export { writeTree } from './write.js'
