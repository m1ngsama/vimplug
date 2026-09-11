export type SuggestionKind = 'tab' | 'bookmark' | 'history'

export interface Suggestion {
  kind: SuggestionKind
  title: string
  url: string
  tabId?: number
  visits?: number
}

const KIND_WEIGHT: Record<SuggestionKind, number> = { tab: 100, bookmark: 50, history: 0 }

function score(item: Suggestion, query: string): number {
  const title = item.title.toLowerCase()
  let n = KIND_WEIGHT[item.kind]

  if (query !== '' && title.startsWith(query)) n += 20
  n += Math.min(10, (item.visits ?? 0) / 10)

  return n
}

export function rankSuggestions(items: Suggestion[], query: string): Suggestion[] {
  const q = query.toLowerCase().trim()
  const terms = q.split(/\s+/).filter(Boolean)

  const matched = items.filter(i => {
    if (!i.url) return false
    const hay = `${i.title} ${i.url}`.toLowerCase()
    return terms.every(t => hay.includes(t))
  })

  const best = new Map<string, Suggestion>()
  for (const i of matched) {
    const seen = best.get(i.url)
    if (!seen || score(i, q) > score(seen, q)) best.set(i.url, i)
  }

  return [...best.values()].sort((a, b) => score(b, q) - score(a, q))
}
