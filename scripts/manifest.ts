import { writeFileSync } from 'node:fs'
import { buildManifest, type Target } from '../src/shared/manifest-def.ts'

const target = process.env.TARGET as Target
if (target !== 'chrome' && target !== 'safari') throw new Error(`bad TARGET: ${target}`)

writeFileSync(`dist/${target}/manifest.json`, JSON.stringify(buildManifest(target), null, 2))
