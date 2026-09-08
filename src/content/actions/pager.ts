export interface PagerCandidate {
  text: string
  rel: string
  ariaLabel: string
}

// Whole words only: "nextdoor" is a neighbourhood, not the following page.
const WORDS: Record<1 | -1, RegExp> = {
  1: /(^|\s)(next|older|more|forward)(\s|$)|^[›»→>]+$/i,
  [-1]: /(^|\s)(prev|previous|newer|back)(\s|$)|^[‹«←<]+$/i,
}

const REL: Record<1 | -1, string> = { 1: 'next', [-1]: 'prev' }

export function pagerScore(candidate: PagerCandidate, dir: 1 | -1): number {
  const rel = candidate.rel.toLowerCase().trim()
  if (rel === REL[dir] || (dir === -1 && rel === 'previous')) return 10
  if (rel !== '' && (rel === 'next' || rel === 'prev' || rel === 'previous')) return 0

  const pattern = WORDS[dir]
  if (pattern.test(candidate.text.trim())) return 5
  if (pattern.test(candidate.ariaLabel.trim())) return 4
  return 0
}

export function pickPager(candidates: PagerCandidate[], dir: 1 | -1): number {
  let best = -1
  let bestScore = 0
  candidates.forEach((c, i) => {
    const n = pagerScore(c, dir)
    if (n > bestScore) {
      bestScore = n
      best = i
    }
  })
  return best
}

export function runPager(action: string): boolean {
  const dir: 1 | -1 | null =
    action === 'pageNext' ? 1 : action === 'pagePrev' ? -1 : null
  if (dir === null) return false

  const links = Array.from(document.querySelectorAll('a[href], button, [role="link"]'))
  const hit = pickPager(
    links.map(el => ({
      text: el.textContent ?? '',
      rel: el.getAttribute('rel') ?? '',
      ariaLabel: el.getAttribute('aria-label') ?? '',
    })),
    dir,
  )
  if (hit !== -1) (links[hit] as HTMLElement).click()
  return true
}
