import { collectMatches, stepIndex, type Span } from './matches.ts'
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
  const rendered = new Map<Element, boolean>()
  const pieces: Piece[] = []
  let text = ''
  let lastBlock: Element | null = null
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    const parent = node.parentElement
    if (!parent) continue
    let shown = rendered.get(parent)
    if (shown === undefined) rendered.set(parent, (shown = parent.getClientRects().length > 0))
    if (!shown) continue
    const block = blockOf(node)
    if (lastBlock !== null && block !== lastBlock) text += '\n'
    lastBlock = block
    pieces.push({ node, start: text.length })
    text += node.data
  }
  return { text, pieces }
}

function toRanges(pieces: Piece[], spans: Span[]): Range[] {
  const ranges: Range[] = []
  let i = 0
  const at = (offset: number, inclusive: boolean) => {
    while (offset > pieces[i]!.start + pieces[i]!.node.data.length - (inclusive ? 0 : 1)) i += 1
    return pieces[i]!
  }
  for (const s of spans) {
    const range = document.createRange()
    const start = at(s.start, false)
    range.setStart(start.node, s.start - start.start)
    const end = at(s.end, true)
    range.setEnd(end.node, s.end - end.start)
    ranges.push(range)
  }
  return ranges
}

export interface FindSession {
  search(query: string): number
  step(dir: 1 | -1): { index: number; total: number } | null
  select(): void
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

  const select = () => {
    const cur = ranges[index]
    const sel = getSelection()
    if (!cur || !sel) return
    sel.removeAllRanges()
    sel.addRange(cur.cloneRange())
  }

  return {
    select,
    search(query: string): number {
      ensureStyle()
      const { text, pieces } = walk()
      ranges = toRanges(pieces, collectMatches(text, query))
      index = 0
      paint()
      if (ranges.length > 0) reveal()
      return ranges.length
    },
    step(dir: 1 | -1) {
      if (ranges.length === 0) return null
      index = stepIndex(index, ranges.length, dir)
      paint()
      reveal()
      select()
      return { index, total: ranges.length }
    },
    clear() {
      const sel = getSelection()
      const cur = ranges[index]
      if (cur && sel?.rangeCount === 1 && sel.toString() === cur.toString()) sel.removeAllRanges()
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
