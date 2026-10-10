const CONTROLS = new Set(['BUTTON', 'SELECT', 'TEXTAREA', 'SUMMARY'])
const ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab', 'switch'])

const disabled = (el: Element): boolean =>
  el.getAttribute('disabled') !== null || el.getAttribute('aria-disabled') === 'true'

export function isControl(el: Element): boolean {
  if (disabled(el)) return false

  const tag = el.tagName
  if (tag === 'A') return el.getAttribute('href') !== null
  if (tag === 'INPUT') return ((el as HTMLInputElement).type ?? '').toLowerCase() !== 'hidden'
  if (CONTROLS.has(tag)) return true
  if ((el as HTMLElement).isContentEditable) return true

  const role = el.getAttribute('role')
  if (role !== null && ROLES.has(role)) return true
  return el.getAttribute('onclick') !== null
}

export function isFocusable(el: Element): boolean {
  const tabindex = el.getAttribute('tabindex')
  return !disabled(el) && tabindex !== null && tabindex !== '-1'
}

const viewOf = (el: Element): Window => el.ownerDocument.defaultView ?? window

function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect()
  const view = viewOf(el)
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < view.innerHeight &&
    r.left < view.innerWidth
  )
}

export function frameOffset(el: Element): { x: number; y: number } {
  const at = { x: 0, y: 0 }
  for (let f = viewOf(el).frameElement; f; f = viewOf(f).frameElement) {
    const r = f.getBoundingClientRect()
    at.x += r.left + f.clientLeft
    at.y += r.top + f.clientTop
  }
  return at
}

function hiddenToggleLabel(el: Element): Element | null {
  const input = el as HTMLInputElement
  if (el.tagName !== 'INPUT' || (input.type !== 'checkbox' && input.type !== 'radio')) return null
  return Array.from(input.labels ?? []).find(onScreen) ?? null
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
  const view = viewOf(el)
  const right = Math.min(r.right, view.innerWidth) - INSET
  const top = Math.max(r.top, 0) + INSET
  const bottom = Math.min(r.bottom, view.innerHeight) - INSET
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
  const seen = new Set<Element>()
  const controls = new Set<Element>()
  const walk = (r: Document | ShadowRoot) => {
    for (const el of r.querySelectorAll('*')) {
      if (isControl(el)) {
        const target = onScreen(el) ? el : hiddenToggleLabel(el)
        if (target) {
          seen.add(target)
          controls.add(target)
        }
      } else if (onScreen(el) && (isFocusable(el) || (pointer(el) && !pointer(up(el))))) {
        seen.add(el)
      }
      const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
      if (shadow) walk(shadow)
      // contentDocument is null for a cross-origin frame.
      const inner = el.tagName === 'IFRAME' ? (el as HTMLIFrameElement).contentDocument : null
      if (inner && onScreen(el)) walk(inner)
    }
  }
  walk(root)
  const found = [...seen]
  if (controls.size === found.length) return found.filter(reachable)

  const holders = new Set<Element>()
  for (const t of found) for (let e = up(t); e && !holders.has(e); e = up(e)) holders.add(e)
  const inControl = (el: Element): boolean => {
    for (let e = up(el); e; e = up(e)) if (controls.has(e)) return true
    return false
  }
  return found.filter(el => (controls.has(el) || (!holders.has(el) && !inControl(el))) && reachable(el))
}
