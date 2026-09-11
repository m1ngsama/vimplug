export interface ScrollMetrics {
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  clientHeight: number
  scrollWidth: number
  clientWidth: number
  overflowY: string
  overflowX: string
}

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay'])

export function canScroll(m: ScrollMetrics, axis: 'x' | 'y', dir: -1 | 1): boolean {
  const overflow = axis === 'y' ? m.overflowY : m.overflowX
  if (!SCROLLABLE_OVERFLOW.has(overflow)) return false

  const size = axis === 'y' ? m.clientHeight : m.clientWidth
  const content = axis === 'y' ? m.scrollHeight : m.scrollWidth
  // Sub-pixel layout leaves scrollHeight a hair over clientHeight on boxes that don't scroll.
  if (content <= size + 1) return false

  const at = axis === 'y' ? m.scrollTop : m.scrollLeft
  return dir === 1 ? at < content - size - 1 : at > 0
}

export function pickScrollable(
  chain: ScrollMetrics[],
  axis: 'x' | 'y',
  dir: -1 | 1,
): number {
  return chain.findIndex(m => canScroll(m, axis, dir))
}

export interface ScrollBox {
  height: number
  scrollX: number
  scrollY: number
  maxX: number
  maxY: number
  by(dx: number, dy: number): void
}

function metricsOf(el: Element): ScrollMetrics {
  const css = getComputedStyle(el)
  return {
    scrollTop: el.scrollTop,
    scrollLeft: el.scrollLeft,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    overflowY: css.overflowY,
    overflowX: css.overflowX,
  }
}

function boxOfElement(el: Element): ScrollBox {
  return {
    get height() {
      return el.clientHeight
    },
    get scrollX() {
      return el.scrollLeft
    },
    get scrollY() {
      return el.scrollTop
    },
    get maxX() {
      return Math.max(0, el.scrollWidth - el.clientWidth)
    },
    get maxY() {
      return Math.max(0, el.scrollHeight - el.clientHeight)
    },
    by: (dx, dy) => el.scrollBy({ left: dx, top: dy, behavior: 'instant' }),
  }
}

export function windowBox(): ScrollBox {
  return {
    get height() {
      return window.innerHeight
    },
    get scrollX() {
      return window.scrollX
    },
    get scrollY() {
      return window.scrollY
    },
    get maxX() {
      return Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
    },
    get maxY() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    },
    by: (dx, dy) => window.scrollBy({ left: dx, top: dy, behavior: 'instant' }),
  }
}

function ancestors(start: Element | null): Element[] {
  const out: Element[] = []
  for (let el = start; el; el = el.parentElement) out.push(el)
  return out
}

function scrollableFrom(seed: Element | null, axis: 'x' | 'y', dir: -1 | 1): Element | null {
  const chain = ancestors(seed).filter(
    el => el !== document.documentElement && el !== document.body,
  )
  const hit = pickScrollable(chain.map(metricsOf), axis, dir)
  return hit === -1 ? null : chain[hit]!
}

function meaningfulFocus(el: Element | null): Element | null {
  return el && el !== document.body && el !== document.documentElement ? el : null
}

export function resolveScrollBox(
  focused: Element | null,
  axis: 'x' | 'y',
  dir: -1 | 1,
): ScrollBox {
  const centre = () =>
    document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)

  const found =
    scrollableFrom(meaningfulFocus(focused), axis, dir) ?? scrollableFrom(centre(), axis, dir)

  return found ? boxOfElement(found) : windowBox()
}
