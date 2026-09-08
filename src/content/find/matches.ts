export interface Span {
  start: number
  end: number
}

// smartcase: a capital in the query is a deliberate act, so it narrows the search. Compare
// against the lowercased query rather than testing for /[A-Z]/, which would call a query
// case sensitive over an accent or a non-latin script that has no case at all.
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
