import { isActionId } from '../actions.ts'
import { parseKeys } from '../keys.ts'

export interface Span {
  start: number
  end: number
}

export type BindMode = 'normal' | 'hint' | 'command'

export type Stmt =
  | { kind: 'map'; mode: BindMode; keys: string; action: string; span: Span }
  | { kind: 'unmap'; mode: BindMode; keys: string; span: Span }
  | { kind: 'set'; option: string; value: string; span: Span }
  | { kind: 'disable'; span: Span }
  | { kind: 'site'; pattern: string; body: Stmt[]; span: Span }

export interface ParseError {
  line: number
  message: string
}

export interface ParseResult {
  stmts: Stmt[]
  errors: ParseError[]
}

const MODE_OF: Record<string, BindMode> = {
  map: 'normal',
  nmap: 'normal',
  hmap: 'hint',
  cmap: 'command',
}

const UNMAP_OF: Record<string, BindMode> = {
  unmap: 'normal',
  nunmap: 'normal',
  hunmap: 'hint',
  cunmap: 'command',
}

interface Line {
  text: string
  no: number
  start: number
  end: number
}

function splitLines(src: string): Line[] {
  const out: Line[] = []
  let offset = 0
  let no = 1
  for (const raw of src.split('\n')) {
    const lead = raw.length - raw.trimStart().length
    const text = raw.trim()
    out.push({ text, no, start: offset + lead, end: offset + lead + text.length })
    offset += raw.length + 1
    no += 1
  }
  return out
}

function unquote(v: string): string {
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v
}

export function parse(src: string): ParseResult {
  const lines = splitLines(src)
  const errors: ParseError[] = []
  const stmts: Stmt[] = []

  let site: { pattern: string; body: Stmt[]; start: number; line: number } | null = null
  const emit = (s: Stmt) => (site ? site.body.push(s) : stmts.push(s))

  for (const line of lines) {
    const t = line.text
    if (t.length === 0 || t.startsWith('#')) continue

    const span: Span = { start: line.start, end: line.end }

    if (t === '}') {
      if (!site) {
        errors.push({ line: line.no, message: 'unexpected }' })
        continue
      }
      stmts.push({
        kind: 'site',
        pattern: site.pattern,
        body: site.body,
        span: { start: site.start, end: line.end },
      })
      site = null
      continue
    }

    const words = t.split(/\s+/)
    const head = words[0]!

    if (head === 'site') {
      if (site) {
        errors.push({ line: line.no, message: 'nested site blocks are not allowed' })
        continue
      }
      if (words.length !== 3 || words[2] !== '{') {
        errors.push({ line: line.no, message: 'expected: site <pattern> {' })
        continue
      }
      site = { pattern: words[1]!, body: [], start: line.start, line: line.no }
      continue
    }

    if (head === 'disable') {
      if (!site) {
        errors.push({ line: line.no, message: 'disable is only valid inside a site block' })
        continue
      }
      emit({ kind: 'disable', span })
      continue
    }

    if (head === 'set') {
      const eq = t.indexOf('=')
      if (eq === -1 || words.length < 2) {
        errors.push({ line: line.no, message: 'expected: set <option> = <value>' })
        continue
      }
      emit({ kind: 'set', option: words[1]!, value: unquote(t.slice(eq + 1).trim()), span })
      continue
    }

    const mapMode = MODE_OF[head]
    if (mapMode) {
      if (words.length !== 3) {
        errors.push({ line: line.no, message: `expected: ${head} <keys> <action>` })
        continue
      }
      const keys = words[1]!
      const action = words[2]!
      if (!parseKeys(keys)) {
        errors.push({ line: line.no, message: `malformed key notation: ${keys}` })
        continue
      }
      if (!isActionId(action)) {
        errors.push({ line: line.no, message: `unknown action: ${action}` })
        continue
      }
      emit({ kind: 'map', mode: mapMode, keys, action, span })
      continue
    }

    const unmapMode = UNMAP_OF[head]
    if (unmapMode) {
      if (words.length !== 2) {
        errors.push({ line: line.no, message: `expected: ${head} <keys>` })
        continue
      }
      const keys = words[1]!
      if (!parseKeys(keys)) {
        errors.push({ line: line.no, message: `malformed key notation: ${keys}` })
        continue
      }
      emit({ kind: 'unmap', mode: unmapMode, keys, span })
      continue
    }

    errors.push({ line: line.no, message: `unknown statement: ${head}` })
  }

  if (site) errors.push({ line: site.line, message: 'unclosed site block' })

  return { stmts, errors }
}
