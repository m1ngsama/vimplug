import { onScreen } from './focus-input.ts'

export interface PagerCandidate {
  text: string
  rel: string
  ariaLabel: string
}

const WORDS: Record<1 | -1, RegExp> = {
  1: /(^|\s)(next|older|more|forward)(\s|$)|^[›»→>]+$|下一页|下页|下一章|下一张|后一页|下一頁|下頁|後頁/i,
  [-1]: /(^|\s)(prev|previous|newer|back)(\s|$)|^[‹«←<]+$|上一页|上页|上一章|上一张|前一页|上一頁|上頁|前頁/i,
}

const RELS: Record<1 | -1, string[]> = { 1: ['next'], [-1]: ['prev', 'previous'] }

const BY_REL = 2

export function pagerScore(candidate: PagerCandidate, dir: 1 | -1): number {
  const rels = candidate.rel.toLowerCase().split(/\s+/)
  if (RELS[dir].some(r => rels.includes(r))) return BY_REL
  if (RELS[dir === 1 ? -1 : 1].some(r => rels.includes(r))) return 0

  const label = [candidate.text, candidate.ariaLabel]
    .map(s => s.trim())
    .find(s => WORDS[dir].test(s))
  return label ? 1 / label.split(/\s+/).length : 0
}

export function pickPager(candidates: PagerCandidate[], dir: 1 | -1): number {
  let best = -1
  let bestScore = 0
  candidates.forEach((c, i) => {
    const n = pagerScore(c, dir)
    if (n > 0 && n >= bestScore) {
      bestScore = n
      best = i
    }
  })
  return best
}

const DECLARED: Record<1 | -1, string> = {
  1: 'link[rel~="next"][href]',
  [-1]: 'link[rel~="prev"][href], link[rel~="previous"][href]',
}

export function runPager(action: string): boolean {
  const dir: 1 | -1 | null =
    action === 'pageNext' ? 1 : action === 'pagePrev' ? -1 : null
  if (dir === null) return false

  const declared = document.querySelector<HTMLLinkElement>(DECLARED[dir])
  if (declared) {
    location.href = declared.href
    return true
  }

  const links = Array.from(
    document.querySelectorAll<HTMLElement>('a[href], button, [role="link"]'),
  ).filter(onScreen)
  const hit = pickPager(
    links.map(el => ({
      text: el.textContent ?? '',
      rel: el.getAttribute('rel') ?? '',
      ariaLabel: el.getAttribute('aria-label') ?? '',
    })),
    dir,
  )
  if (hit === -1) return false
  links[hit]!.click()
  return true
}
