export interface Span {
  start: number
  end: number
}

// Not /[A-Z]/: that would call an accent or a caseless script case sensitive.
const isCaseSensitive = (query: string): boolean => query !== query.toLowerCase()

export function collectMatches(text: string, query: string): Span[] {
  if (query.length === 0) return []
  const sensitive = isCaseSensitive(query)
  const hay = sensitive ? text : text.toLowerCase()
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
