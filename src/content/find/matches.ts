export interface Span {
  start: number
  end: number
}

// Not /[A-Z]/: that would call an accent or a caseless script case sensitive.
const isCaseSensitive = (query: string): boolean => query !== query.toLowerCase()

// 'İ'.toLowerCase() is two characters long, which would shift every match after it.
function fold(text: string): string {
  const lower = text.toLowerCase()
  if (lower.length === text.length) return lower
  return text.replace(/[^]/gu, c => {
    const l = c.toLowerCase()
    return l.length === c.length ? l : c
  })
}

const REGEX_MARK = '\\r'

function regexMatches(text: string, source: string): Span[] {
  let re: RegExp
  try {
    re = new RegExp(source, isCaseSensitive(source) ? 'g' : 'gi')
  } catch {
    return []
  }
  return Array.from(text.matchAll(re))
    .filter(m => m[0].length > 0)
    .map(m => ({ start: m.index, end: m.index + m[0].length }))
}

export function collectMatches(text: string, query: string): Span[] {
  if (query.length === 0) return []
  if (query.includes(REGEX_MARK)) {
    const source = query.replace(REGEX_MARK, '')
    return source === '' ? [] : regexMatches(text, source)
  }
  const sensitive = isCaseSensitive(query)
  const hay = sensitive ? text : fold(text)
  const needle = sensitive ? query : query.toLowerCase()

  const out: Span[] = []
  let from = 0
  for (;;) {
    const at = hay.indexOf(needle, from)
    if (at === -1) return out
    out.push({ start: at, end: at + needle.length })
    from = at + needle.length
  }
}

export function stepIndex(current: number, count: number, dir: 1 | -1): number {
  if (count <= 0) return 0
  return (current + dir + count) % count
}

export const matchSummary = (n: number): string =>
  n === 0 ? 'No matches' : n === 1 ? '1 match' : `${n} matches`
