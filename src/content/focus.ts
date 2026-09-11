import { DETECTORS } from './detectors/index.ts'
import type { Mode } from './mode.ts'

const TYPING_INPUT = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''])

export function deepActiveElement(root: Document | ShadowRoot): Element | null {
  const el = root.activeElement
  if (!el) return null
  const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
  return shadow?.activeElement ? deepActiveElement(shadow) : el
}

export function isEditable(el: Element | null): boolean {
  if (!el) return false

  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') return TYPING_INPUT.has(((el as HTMLInputElement).type ?? '').toLowerCase())
  if ((el as HTMLElement).isContentEditable) return true

  const role = el.getAttribute?.('role')
  if (role === 'textbox' || role === 'searchbox' || role === 'combobox') return true

  return DETECTORS.some(d => d(el))
}

export function modeForFocus(el: Element | null): Mode {
  if (el?.tagName === 'IFRAME') return 'passthrough'
  return isEditable(el) ? 'insert' : 'normal'
}
