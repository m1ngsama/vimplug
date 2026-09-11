const CONTROLS = new Set(['BUTTON', 'SELECT', 'TEXTAREA', 'SUMMARY'])
const ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab', 'switch'])

export function isClickable(el: Element): boolean {
  if (el.getAttribute('disabled') !== null || el.getAttribute('aria-disabled') === 'true') return false

  const tag = el.tagName
  if (tag === 'A') return el.getAttribute('href') !== null
  if (tag === 'INPUT') return ((el as HTMLInputElement).type ?? '').toLowerCase() !== 'hidden'
  if (CONTROLS.has(tag)) return true
  if ((el as HTMLElement).isContentEditable) return true

  const role = el.getAttribute('role')
  if (role !== null && ROLES.has(role)) return true
  if (el.getAttribute('onclick') !== null) return true

  const tabindex = el.getAttribute('tabindex')
  return tabindex !== null && tabindex !== '-1'
}

function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < window.innerHeight &&
    r.left < window.innerWidth
  )
}

function linkOf(el: Element): string | null {
  if (el.tagName !== 'A') return null
  const raw = el.getAttribute('href') ?? ''
  return raw === '' || /^(#|javascript:)/i.test(raw) ? null : (el as HTMLAnchorElement).href
}

export function groupTargets(targets: Element[]): Element[][] {
  const groups: Element[][] = []
  const rows: Array<{ href: string; top: number; bottom: number; group: Element[] }> = []
  for (const el of targets) {
    const href = linkOf(el)
    const { top, bottom } = el.getBoundingClientRect()
    const row = href && rows.find(r => r.href === href && top < r.bottom && r.top < bottom)
    if (row) {
      row.group.push(el)
      continue
    }
    const group = [el]
    groups.push(group)
    if (href) rows.push({ href, top, bottom, group })
  }
  return groups
}

const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const INSET = 2

function reachable(el: Element): boolean {
  if (FIELDS.has(el.tagName)) return true
  const r = el.getBoundingClientRect()
  const left = Math.max(r.left, 0) + INSET
  const right = Math.min(r.right, window.innerWidth) - INSET
  const top = Math.max(r.top, 0) + INSET
  const bottom = Math.min(r.bottom, window.innerHeight) - INSET
  const root = el.getRootNode() as Document | ShadowRoot
  const points = [[(left + right) / 2, (top + bottom) / 2], [left, top], [right, top], [left, bottom], [right, bottom]]
  return points.some(([x, y]) => {
    const hit = root.elementFromPoint(x!, y!)
    return hit !== null && (el.contains(hit) || hit.contains(el))
  })
}

const up = (el: Element): Element | null =>
  el.parentElement ?? (el.parentNode as ShadowRoot | null)?.host ?? null

const pointer = (el: Element | null): boolean =>
  el !== null && getComputedStyle(el).cursor === 'pointer'

export function collectTargets(root: Document | ShadowRoot): Element[] {
  const found: Element[] = []
  const scripted = new Set<Element>()
  const walk = (r: Document | ShadowRoot) => {
    for (const el of r.querySelectorAll('*')) {
      if (isClickable(el)) {
        if (onScreen(el)) found.push(el)
      } else if (onScreen(el) && pointer(el) && !pointer(up(el))) {
        found.push(el)
        scripted.add(el)
      }
      const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
      if (shadow) walk(shadow)
    }
  }
  walk(root)
  if (scripted.size === 0) return found.filter(reachable)

  const real = new Set(found.filter(el => !scripted.has(el)))
  const wrappers = new Set<Element>()
  for (const t of real) for (let e = up(t); e && !wrappers.has(e); e = up(e)) wrappers.add(e)
  const inReal = (el: Element): boolean => {
    for (let e = up(el); e; e = up(e)) if (real.has(e)) return true
    return false
  }
  return found.filter(el => (!scripted.has(el) || (!wrappers.has(el) && !inReal(el))) && reachable(el))
}
