import { isEditable } from '../focus.ts'

function isLocked(el: Element): boolean {
  const field = el as HTMLInputElement
  return Boolean(field.disabled || field.readOnly)
}

export function nthTextField(
  els: Element[],
  isVisible: (el: Element) => boolean,
  n: number,
): Element | null {
  const fields = els.filter(e => isEditable(e) && !isLocked(e) && isVisible(e))
  return fields[Math.min(n, fields.length) - 1] ?? null
}

export function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

export function runFocusInput(action: string, count = 1): boolean {
  if (action !== 'focusInput') return false
  const all = Array.from(document.querySelectorAll('input, textarea, [contenteditable]'))
  const target = nthTextField(all, onScreen, count)
  if (target instanceof HTMLElement) target.focus()
  return true
}
