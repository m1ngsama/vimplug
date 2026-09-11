import { collectMatches, stepIndex } from './matches.ts'
import { applyTheme, TOKEN_VARS, type Tokens } from '../../shared/theme.ts'

const ALL = 'vimplug-find'
const CURRENT = 'vimplug-find-current'
const STYLE_ID = 'vimplug-find-style'

const STYLE = `
::highlight(${ALL}) { background: var(--vp-match); color: var(--vp-accent-fg) }
::highlight(${CURRENT}) { background: var(--vp-match-cur); color: var(--vp-accent-fg) }
`

interface Piece {
  node: Text
  start: number
}

const INLINE = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'I', 'KBD',
  'LABEL', 'MARK', 'OUTPUT', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP',
  'TIME', 'U', 'VAR', 'WBR',
])

function blockOf(node: Text): Element | null {
  let el = node.parentElement
  while (el && INLINE.has(el.tagName)) el = el.parentElement
  return el
}

function walk(): { text: string; pieces: Piece[] } {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const pieces: Piece[] = []
  let text = ''
  let lastBlock: Element | null = null
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    const parent = node.parentElement
    if (!parent || parent.closest('script, style, noscript')) continue
    const block = blockOf(node)
    if (lastBlock !== null && block !== lastBlock) text += '\n'
    lastBlock = block
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

export function createFind(theme: Tokens): FindSession | null {
  const highlights = (
    CSS as unknown as { highlights?: Map<string, unknown> & { delete(k: string): void } }
  ).highlights
  if (!highlights || typeof Highlight === 'undefined') return null

  let style: HTMLStyleElement | null = null
  let ranges: Range[] = []
  let index = 0

  const ensureStyle = () => {
    if (style) return
    // ::highlight() inherits from the element it marks, so the tokens sit on <html> until clear().
    applyTheme(document.documentElement, theme)
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
    if (!rect || (rect.width === 0 && rect.height === 0)) return
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
        .filter((r): r is Range => r !== null && r.getBoundingClientRect().width > 0)
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
      for (const cssVar of Object.values(TOKEN_VARS)) {
        document.documentElement.style.removeProperty(cssVar)
      }
    },
  }
}
