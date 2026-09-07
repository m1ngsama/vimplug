import { ACTIONS } from './actions.ts'
import { parseKeys, type KeyMatching } from './keys.ts'
import type { Binding } from './matcher.ts'
import { parse, type BindMode, type Stmt } from './dsl/parse.ts'

export interface Options {
  hintChars: string
  keyMatching: KeyMatching
  sequenceTimeout: number
  scrollStep: number
  scrollSmooth: boolean
  volumeStep: number
  searchEngine: string
}

export interface SiteResolution {
  disabled: boolean
  options: Options
  bindings: Record<BindMode, Binding[]>
}

type SiteStmt = Extract<Stmt, { kind: 'site' }>

const DEFAULT_OPTIONS: Options = {
  hintChars: 'asdfghjkl',
  keyMatching: 'physical',
  sequenceTimeout: 1000,
  scrollStep: 60,
  scrollSmooth: true,
  volumeStep: 0.1,
  searchEngine: 'https://www.google.com/search?q=%s',
}

export const DEFAULT_DSL: string = ACTIONS.flatMap(a =>
  a.defaultKeys.map(k => `map ${k} ${a.id}`),
).join('\n')

function specificity(pattern: string): number {
  return pattern.split('.').filter(p => p !== '*').length
}

function matches(pattern: string, host: string): boolean {
  if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1))
  return pattern === host
}

export interface OptionDef {
  key: keyof Options
  type: 'text' | 'number' | 'boolean' | 'choice'
  choices?: string[]
}

// One list drives the DSL parser and the settings UI, so an option cannot exist in one
// and not the other. Labels live with the UI so their copy stays out of content scripts.
export const OPTION_SCHEMA: readonly OptionDef[] = [
  { key: 'hintChars', type: 'text' },
  { key: 'keyMatching', type: 'choice', choices: ['physical', 'logical'] },
  { key: 'scrollStep', type: 'number' },
  { key: 'scrollSmooth', type: 'boolean' },
  { key: 'sequenceTimeout', type: 'number' },
  { key: 'volumeStep', type: 'number' },
  { key: 'searchEngine', type: 'text' },
]

const BY_KEY = new Map(OPTION_SCHEMA.map(d => [d.key as string, d]))

function applyOption(o: Options, option: string, value: string): void {
  const def = BY_KEY.get(option)
  if (!def) return

  if (def.type === 'number') {
    const n = Number(value)
    if (Number.isFinite(n)) (o[def.key] as number) = n
    return
  }
  if (def.type === 'boolean') {
    ;(o[def.key] as boolean) = value !== 'false'
    return
  }
  if (def.type === 'choice') {
    if (def.choices?.includes(value)) (o[def.key] as string) = value
    return
  }
  ;(o[def.key] as string) = value
}

function apply(
  stmts: Stmt[],
  out: SiteResolution,
  maps: Record<BindMode, Map<string, string>>,
): void {
  for (const s of stmts) {
    if (s.kind === 'map') maps[s.mode].set(s.keys, s.action)
    else if (s.kind === 'unmap') maps[s.mode].delete(s.keys)
    else if (s.kind === 'set') applyOption(out.options, s.option, s.value)
    else if (s.kind === 'disable') out.disabled = true
  }
}

function siteStmts(src: string): SiteStmt[] {
  return parse(src).stmts.filter((s): s is SiteStmt => s.kind === 'site')
}

export function resolveForHost(src: string, host: string): SiteResolution {
  const { stmts } = parse(src)

  const out: SiteResolution = {
    disabled: false,
    options: { ...DEFAULT_OPTIONS },
    bindings: { normal: [], hint: [], command: [] },
  }
  const maps: Record<BindMode, Map<string, string>> = {
    normal: new Map(),
    hint: new Map(),
    command: new Map(),
  }

  apply(
    stmts.filter(s => s.kind !== 'site'),
    out,
    maps,
  )

  // Ascending specificity, so the most specific block applies last and wins.
  const hits = stmts
    .filter((s): s is SiteStmt => s.kind === 'site' && matches(s.pattern, host))
    .map((s, i) => ({ s, i, spec: specificity(s.pattern) }))
    .sort((a, b) => a.spec - b.spec || a.i - b.i)

  for (const { s } of hits) apply(s.body, out, maps)

  for (const mode of ['normal', 'hint', 'command'] as const) {
    for (const [notation, action] of maps[mode]) {
      const keys = parseKeys(notation)
      if (keys) out.bindings[mode].push({ keys, action, notation })
    }
  }

  return out
}

export function disabledHosts(src: string): string[] {
  return siteStmts(src)
    .filter(s => s.body.some(b => b.kind === 'disable'))
    .map(s => s.pattern)
}
