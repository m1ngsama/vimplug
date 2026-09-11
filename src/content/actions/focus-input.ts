import { isEditable } from '../focus.ts'

export function firstTextField(
  els: Element[],
  isVisible: (el: Element) => boolean,
): Element | null {
  return els.find(e => isEditable(e) && isVisible(e)) ?? null
}

export function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

export function runFocusInput(action: string): boolean {
  if (action !== 'focusInput') return false
  const all = Array.from(document.querySelectorAll('input, textarea, [contenteditable]'))
  const target = firstTextField(all, onScreen)
  if (target instanceof HTMLElement) target.focus()
  return true
}
