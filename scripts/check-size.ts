import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const LIMIT = 30 * 1024
const target = process.argv[2]
const path = `dist/${target}/content.js`

const gz = gzipSync(readFileSync(path)).byteLength
const raw = statSync(path).size
const pct = Math.round((gz / LIMIT) * 100)

console.info(`content.js  ${gz}B gzip of ${LIMIT}B budget (${pct}%), ${raw}B raw`)

if (gz > LIMIT) {
  console.error(`content script exceeds ${LIMIT}B gzip`)
  process.exit(1)
}
