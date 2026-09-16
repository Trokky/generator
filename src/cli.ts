#!/usr/bin/env node
/**
 * `npm create trokky@latest` — compose a project and write it out.
 *
 * Every rule it applies comes from the manifest, so this file knows nothing about what can go
 * with what. It asks, it validates, it writes.
 */

import { createInterface } from 'node:readline/promises'
import { stdin, stdout, argv, exit } from 'node:process'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { manifest, secretsFor, type AxisId } from './manifest.js'
import { withDefaults, type ProjectConfig } from './config.js'
import { validate, optionsFor, describe } from './validate.js'
import { generate } from './generate.js'
import { fsFileSource } from './files-node.js'
import { writeTree } from './write.js'

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (const arg of args) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
    if (match) flags[match[1]] = match[2] ?? 'true'
    else if (!arg.startsWith('-')) flags.name ??= arg
  }
  return flags
}

async function main(): Promise<void> {
  const flags = parseFlags(argv.slice(2))
  const interactive = flags.yes !== 'true' && stdin.isTTY

  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null
  const ask = async (question: string, options: string[], fallback: string): Promise<string> => {
    if (!rl) return fallback
    const axisOptions = manifest.axes.find(a => options.includes(a.options[0]?.id))
    console.log(`\n${question}`)
    options.forEach((id, i) => {
      const option = manifest.axes.flatMap(a => a.options).find(o => o.id === id)
      console.log(`  ${i + 1}) ${option?.title ?? id}${option?.hint ? ` — ${option.hint}` : ''}`)
    })
    void axisOptions
    const answer = (await rl.question(`> [${options.indexOf(fallback) + 1}] `)).trim()
    if (!answer) return fallback
    const index = Number(answer) - 1
    return options[index] ?? (options.includes(answer) ? answer : fallback)
  }

  const name = flags.name ?? (rl ? (await rl.question('\nProject name > [my-trokky-site] ')).trim() || 'my-trokky-site' : 'my-trokky-site')
  const target = (flags.target ?? (await ask('Where will it run?', ['workers', 'node'], 'workers'))) as ProjectConfig['target']

  const chosen: Record<string, string> = { target }
  for (const axisId of ['parts', 'content', 'data', 'media', 'images'] as AxisId[]) {
    const available = optionsFor(axisId, chosen as never)
    const preset = flags[axisId]
    if (preset) {
      chosen[axisId] = preset
      continue
    }
    const fallback = manifest.defaults[target]?.[axisId] ?? available[0]
    // One option left is not a question; say what it is and move on.
    chosen[axisId] = available.length <= 1
      ? available[0] ?? fallback
      : await ask(manifest.axes.find(a => a.id === axisId)!.title, available, available.includes(fallback) ? fallback : available[0])
  }
  await rl?.close()

  const config = withDefaults({ name, ...chosen } as never)
  const result = validate(config)
  if (!result.valid) {
    console.error(`\nThat combination cannot be built:\n${describe(result.problems)}`)
    exit(1)
  }

  const target_dir = resolve(flags.out ?? name)
  writeTree(generate(config, fsFileSource()), target_dir)

  const secrets = secretsFor(config)
  console.log(`\nCreated ${config.name} in ${target_dir}\n`)
  console.log(`  ${config.parts === 'api' ? 'API' : config.parts === 'studio' ? 'API + Studio' : 'API + Studio + site'} · ${config.data} · ${config.media} · thumbnails: ${config.images}\n`)
  console.log('Next:')
  console.log(`  cd ${config.name}`)
  console.log(`  cp ${config.target === 'workers' ? '.dev.vars.example .dev.vars' : '.env.example .env'}`)
  for (const secret of secrets) {
    // Only the generated ones get a value here; an endpoint or a bucket name is yours to fill in.
    if (secret.generate) {
      console.log(`  # ${secret.name}=${randomBytes(secret.generate === 'hex32' ? 32 : 24).toString('hex')}`)
    } else {
      console.log(`  # ${secret.name}=   (${secret.optional ? 'optional — ' : ''}${secret.why})`)
    }
  }
  console.log('  npm install')
  console.log(config.target === 'workers' ? '  npm run build && npm run preview' : '  npm run dev')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  exit(1)
})
