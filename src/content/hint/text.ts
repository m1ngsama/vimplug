const MAX = 60

export function hintText(el: Element): string {
  const tag = el.tagName
  let raw = ''

  if (tag === 'INPUT') {
    const input = el as HTMLInputElement
    raw = input.value || (el.getAttribute('placeholder') ?? '') || (el.getAttribute('aria-label') ?? '')
  } else if (tag === 'IMG') {
    raw = el.getAttribute('alt') ?? ''
  } else {
    raw = el.textContent ?? ''
    if (!raw.trim()) raw = el.getAttribute('aria-label') ?? el.getAttribute('title') ?? ''
  }

  return raw.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, MAX)
}

export interface HintItem {
  label: string
  text: string
}

export type FilterResult =
  | { kind: 'match'; index: number }
  | { kind: 'filter'; indexes: number[] }
  | { kind: 'none' }

// Typed characters are tried as a label first; anything else narrows by link text, which
// is what makes hints usable on a page full of similar-looking links.
export function filterHints(items: HintItem[], typed: string): FilterResult {
  const t = typed.toLowerCase()

  const exact = items.findIndex(i => i.label === t)
  if (exact !== -1) return { kind: 'match', index: exact }

  const byLabel = items.flatMap((i, n) => (i.label.startsWith(t) ? [n] : []))
  if (byLabel.length > 0) return { kind: 'filter', indexes: byLabel }

  const byText = items.flatMap((i, n) => (i.text.includes(t) ? [n] : []))
  if (byText.length > 0) return { kind: 'filter', indexes: byText }

  return { kind: 'none' }
}
