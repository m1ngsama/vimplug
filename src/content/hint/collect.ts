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

export function collectTargets(root: Document | ShadowRoot): Element[] {
  const out: Element[] = []
  for (const el of root.querySelectorAll('*')) {
    if (isClickable(el) && onScreen(el)) out.push(el)
    const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
    if (shadow) out.push(...collectTargets(shadow))
  }
  return out
}
