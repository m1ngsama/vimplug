import { parse, type Stmt } from './parse.ts'
import { replaceStmt, removeStmt, appendStmt } from './edit.ts'

function topLevel(src: string): Stmt[] {
  return parse(src).stmts.filter(s => s.kind !== 'site')
}

function findMap(src: string, action: string): Stmt | undefined {
  return topLevel(src)
    .filter(s => s.kind === 'map' && s.mode === 'normal' && s.action === action)
    .at(-1)
}

export function rebind(src: string, action: string, notation: string): string {
  const line = `map ${notation} ${action}`
  const existing = findMap(src, action)
  return existing ? replaceStmt(src, existing.span, line) : appendStmt(src, line)
}

export function unbind(src: string, action: string): string {
  const existing = findMap(src, action)
  return existing ? removeStmt(src, existing.span) : src
}

export function setOption(src: string, option: string, value: string): string {
  const line = `set ${option} = "${value}"`
  const existing = topLevel(src)
    .filter(s => s.kind === 'set' && s.option === option)
    .at(-1)
  return existing ? replaceStmt(src, existing.span, line) : appendStmt(src, line)
}

function findSite(src: string, pattern: string) {
  return parse(src)
    .stmts.filter(s => s.kind === 'site' && s.pattern === pattern)
    .at(-1)
}

export function toggleSite(src: string, pattern: string, disabled: boolean): string {
  const existing = findSite(src, pattern)

  if (!disabled) return existing ? removeStmt(src, existing.span) : src
  if (existing?.kind === 'site' && existing.body.some(b => b.kind === 'disable')) return src

  const block = `site ${pattern} {\n  disable\n}`
  return existing ? replaceStmt(src, existing.span, block) : appendStmt(src, block)
}
