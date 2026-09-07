import type { Span } from './parse.ts'

export function replaceStmt(src: string, span: Span, text: string): string {
  return src.slice(0, span.start) + text + src.slice(span.end)
}

export function removeStmt(src: string, span: Span): string {
  let start = span.start
  let end = span.end
  while (start > 0 && src[start - 1] !== '\n') start -= 1
  if (src[end] === '\n') end += 1
  return src.slice(0, start) + src.slice(end)
}

export function appendStmt(src: string, text: string): string {
  const base = src.endsWith('\n') || src.length === 0 ? src : `${src}\n`
  return `${base}${text}\n`
}
