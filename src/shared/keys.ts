export interface Key {
  code: string
  key: string
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

export type KeyMatching = 'physical' | 'logical'

const NAMED: Record<string, string> = {
  esc: 'Escape',
  space: 'Space',
  cr: 'Enter',
  tab: 'Tab',
  bs: 'Backspace',
  del: 'Delete',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
}

const MODS: Record<string, 'ctrl' | 'meta' | 'alt' | 'shift'> = {
  c: 'ctrl',
  m: 'meta',
  a: 'alt',
  s: 'shift',
}

const PUNCT: Record<string, string> = {
  '-': 'Minus',
  '=': 'Equal',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  '`': 'Backquote',
}

// US-QWERTY shifted glyphs, so `?` binds to the physical Slash key with shift held.
const SHIFTED: Record<string, string> = {
  '~': 'Backquote',
  '!': 'Digit1',
  '@': 'Digit2',
  '#': 'Digit3',
  $: 'Digit4',
  '%': 'Digit5',
  '^': 'Digit6',
  '&': 'Digit7',
  '*': 'Digit8',
  '(': 'Digit9',
  ')': 'Digit0',
  _: 'Minus',
  '+': 'Equal',
  '{': 'BracketLeft',
  '}': 'BracketRight',
  '|': 'Backslash',
  ':': 'Semicolon',
  '"': 'Quote',
  '>': 'Period',
  '?': 'Slash',
}

interface Physical {
  code: string
  shift: boolean
}

function codeFor(ch: string): Physical | null {
  if (/^[a-z]$/.test(ch)) return { code: `Key${ch.toUpperCase()}`, shift: false }
  if (/^[A-Z]$/.test(ch)) return { code: `Key${ch}`, shift: true }
  if (/^[0-9]$/.test(ch)) return { code: `Digit${ch}`, shift: false }
  const punct = PUNCT[ch]
  if (punct) return { code: punct, shift: false }
  const shifted = SHIFTED[ch]
  if (shifted) return { code: shifted, shift: true }
  return null
}

function blank(): Key {
  return { code: '', key: '', ctrl: false, meta: false, alt: false, shift: false }
}

function parseAngle(body: string): Key | null {
  const whole = NAMED[body.toLowerCase()]
  if (whole) return { ...blank(), code: whole, key: whole }

  const parts = body.split('-')
  const last = parts.pop()
  if (last === undefined || last.length === 0) return null

  const k = blank()
  for (const p of parts) {
    const mod = MODS[p.toLowerCase()]
    if (!mod) return null
    k[mod] = true
  }

  const named = NAMED[last.toLowerCase()]
  if (named) {
    k.code = named
    k.key = named
    return k
  }
  if (last.length !== 1) return null
  const phys = codeFor(last)
  if (!phys) return null
  k.code = phys.code
  k.key = last
  if (phys.shift) k.shift = true
  return k
}

export function parseKeys(notation: string): Key[] | null {
  if (notation.length === 0) return null

  const out: Key[] = []
  let i = 0
  while (i < notation.length) {
    const ch = notation[i]!
    if (ch === '<') {
      const close = notation.indexOf('>', i)
      if (close === -1) return null
      const k = parseAngle(notation.slice(i + 1, close))
      if (!k) return null
      out.push(k)
      i = close + 1
      continue
    }
    const phys = codeFor(ch)
    if (!phys) return null
    out.push({ ...blank(), code: phys.code, key: ch, shift: phys.shift })
    i += 1
  }
  return out
}

export function keyId(k: Key, matching: KeyMatching): string {
  const base = matching === 'physical' ? k.code : k.key
  let prefix = ''
  if (k.ctrl) prefix += 'C-'
  if (k.meta) prefix += 'M-'
  if (k.alt) prefix += 'A-'
  if (k.shift) prefix += 'S-'
  return prefix + base
}

// Shift is excluded: `F` and `f` are distinct bindings, not one key plus a modifier.
export function hasModifier(k: Key): boolean {
  return k.ctrl || k.meta || k.alt
}
