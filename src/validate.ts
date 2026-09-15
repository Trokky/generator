/**
 * Refuse impossible compositions, and say why.
 *
 * The rules live in the manifest, so this function is only the engine: it never knows that
 * sharp cannot run on Workers, it knows how to apply a constraint that says so.
 */

import { manifest, type AxisId, type Constraint, type Template } from './manifest.js'
import type { ProjectConfig } from './config.js'

export interface Problem {
  /** The axis the caller has to change. */
  axis: AxisId
  /** What they chose. */
  chosen: string
  /** What they could choose instead, given everything else. */
  allowed: string[]
  /** The constraint's own explanation. */
  because: string
  constraint: string
}

export interface ValidationResult {
  valid: boolean
  problems: Problem[]
}

const matches = (constraint: Constraint, config: Partial<ProjectConfig>): boolean =>
  Object.entries(constraint.when).every(([key, value]) => config[key as AxisId] === value)

/** Every problem with a composition, not just the first. */
export function validate(config: Partial<ProjectConfig>): ValidationResult {
  const problems: Problem[] = []

  for (const constraint of manifest.constraints) {
    if (!matches(constraint, config)) continue

    for (const [key, allowed] of Object.entries(constraint.allow)) {
      const chosen = config[key as AxisId]
      if (typeof chosen !== 'string' || allowed.includes(chosen)) continue
      problems.push({
        axis: key as AxisId,
        chosen,
        allowed,
        because: constraint.because,
        constraint: constraint.id,
      })
    }
  }

  // An unknown value is a different failure from a disallowed one, and worth naming separately.
  for (const axis of manifest.axes) {
    const chosen = config[axis.id]
    if (typeof chosen !== 'string') continue
    if (axis.options.some(option => option.id === chosen)) continue
    problems.push({
      axis: axis.id,
      chosen,
      allowed: axis.options.map(option => option.id),
      because: `"${chosen}" is not one of the ${axis.title.toLowerCase()} options.`,
      constraint: 'known-option',
    })
  }

  return { valid: problems.length === 0, problems }
}

/** What is still choosable on one axis, given the choices already made. */
export function optionsFor(axisId: AxisId, config: Partial<ProjectConfig>): string[] {
  const all = manifest.axes.find(a => a.id === axisId)?.options.map(o => o.id) ?? []
  return all.filter(option => validate({ ...config, [axisId]: option }).valid)
}

/**
 * The published repository that is exactly this composition, if there is one.
 *
 * Only an exact match counts. A template that differs in any axis would deploy something other
 * than what the caller chose, which is worse than offering no button at all.
 */
export function templateFor(config: Partial<ProjectConfig>): Template | null {
  return (
    manifest.templates.find(template =>
      Object.entries(template.composition).every(([axis, value]) => config[axis as AxisId] === value),
    ) ?? null
  )
}

export function describe(problems: Problem[]): string {
  return problems
    .map(p => `  ${p.axis}: "${p.chosen}" is not available here.\n    ${p.because}\n    Try: ${p.allowed.join(', ')}`)
    .join('\n')
}
