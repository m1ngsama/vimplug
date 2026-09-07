import { collectMatches, stepIndex } from './matches.ts'

const ALL = 'vimplug-find'
const CURRENT = 'vimplug-find-current'
const STYLE_ID = 'vimplug-find-style'

// The Custom Highlight API paints without touching the document tree. The one style rule
// we add only targets our named highlights, so it cannot disturb the page's own CSS.
const STYLE = `
::highlight(${ALL}) { background: #ffe08a; color: #21201c }
::highlight(${CURRENT}) { background: #ff9f45; color: #21201c }
`

interface Piece {
  node: Text
  start: number
}

function walk(): { text: string; pieces: Piece[] } {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const pieces: Piece[] = []
  let text = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    const parent = node.parentElement
    if (!parent || parent.closest('script, style, noscript')) continue
    pieces.push({ node, start: text.length })
    text += node.data
  }
  return { text, pieces }
}

function toRange(pieces: Piece[], start: number, end: number): Range | null {
  const range = document.createRange()
  let placedStart = false
  for (const p of pieces) {
    const pEnd = p.start + p.node.data.length
    if (!placedStart && start >= p.start && start < pEnd) {
      range.setStart(p.node, start - p.start)
      placedStart = true
    }
    if (placedStart && end > p.start && end <= pEnd) {
      range.setEnd(p.node, end - p.start)
      return range
    }
  }
  return null
}

export interface FindSession {
  search(query: string): number
  step(dir: 1 | -1): void
  clear(): void
}

export function createFind(): FindSession | null {
  const highlights = (
    CSS as unknown as { highlights?: Map<string, unknown> & { delete(k: string): void } }
  ).highlights
  if (!highlights || typeof Highlight === 'undefined') return null

  let style: HTMLStyleElement | null = null
  let ranges: Range[] = []
  let index = 0

  const ensureStyle = () => {
    if (style) return
    style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLE
    document.head.append(style)
  }

  const paint = () => {
    if (ranges.length === 0) {
      highlights.delete(ALL)
      highlights.delete(CURRENT)
      return
    }
    highlights.set(ALL, new Highlight(...ranges))
    const cur = ranges[index]
    if (cur) highlights.set(CURRENT, new Highlight(cur))
  }

  const reveal = () => {
    const cur = ranges[index]
    const rect = cur?.getBoundingClientRect()
    if (!rect) return
    window.scrollBy({
      top: rect.top - window.innerHeight / 3,
      behavior: 'instant',
    })
  }

  return {
    search(query: string): number {
      ensureStyle()
      const { text, pieces } = walk()
      ranges = collectMatches(text, query)
        .map(s => toRange(pieces, s.start, s.end))
        .filter((r): r is Range => r !== null)
      index = 0
      paint()
      if (ranges.length > 0) reveal()
      return ranges.length
    },
    step(dir: 1 | -1) {
      if (ranges.length === 0) return
      index = stepIndex(index, ranges.length, dir)
      paint()
      reveal()
    },
    clear() {
      ranges = []
      highlights.delete(ALL)
      highlights.delete(CURRENT)
      style?.remove()
      style = null
    },
  }
}
