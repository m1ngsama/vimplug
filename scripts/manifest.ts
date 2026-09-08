import { readFileSync, writeFileSync } from 'node:fs'
import { buildManifest, type Target } from '../src/shared/manifest-def.ts'

const target = process.env.TARGET as Target
if (target !== 'chrome' && target !== 'safari') throw new Error(`bad TARGET: ${target}`)

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

writeFileSync(`dist/${target}/manifest.json`, JSON.stringify(buildManifest(target, version), null, 2))
