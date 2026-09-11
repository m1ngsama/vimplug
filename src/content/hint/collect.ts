const CONTROLS = new Set(['BUTTON', 'SELECT', 'TEXTAREA'])
const ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab', 'switch'])

export function isClickable(el: Element): boolean {
  if (el.getAttribute('disabled') !== null) return false

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

// Behind '#' and 'javascript:' a script decides what happens, so equal hrefs prove nothing.
function linkOf(el: Element): string | null {
  if (el.tagName !== 'A') return null
  const raw = el.getAttribute('href') ?? ''
  return raw === '' || /^(#|javascript:)/i.test(raw) ? null : (el as HTMLAnchorElement).href
}

// Only within a row: a node tag repeated down a feed still needs a hint where the eye is.
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

export function collectTargets(root: Document | ShadowRoot): Element[] {
  const out: Element[] = []
  for (const el of root.querySelectorAll('*')) {
    if (isClickable(el) && onScreen(el)) out.push(el)
    const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
    if (shadow) out.push(...collectTargets(shadow))
  }
  return out
}
