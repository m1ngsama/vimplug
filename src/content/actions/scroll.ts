export interface ScrollDelta {
  top: number
  left: number
}

export function scrollDelta(
  action: string,
  opts: { scrollStep: number },
  viewportHeight: number,
): ScrollDelta | null {
  const d = opts.scrollStep
  const half = viewportHeight / 2
  switch (action) {
    case 'scrollDown':
      return { top: d, left: 0 }
    case 'scrollUp':
      return { top: -d, left: 0 }
    case 'scrollRight':
      return { top: 0, left: d }
    case 'scrollLeft':
      return { top: 0, left: -d }
    case 'scrollHalfDown':
      return { top: half, left: 0 }
    case 'scrollHalfUp':
      return { top: -half, left: 0 }
    default:
      return null
  }
}

export function runScroll(
  action: string,
  opts: { scrollStep: number; scrollSmooth: boolean },
): boolean {
  const delta = scrollDelta(action, opts, window.innerHeight)
  if (!delta) return false
  window.scrollBy({ ...delta, behavior: opts.scrollSmooth ? 'smooth' : 'instant' })
  return true
}
