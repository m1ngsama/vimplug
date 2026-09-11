declare global {
  interface Window {
    __vimplugShield?: true
  }
}

const ours = (n: EventTarget | null): boolean =>
  n instanceof HTMLElement && 'vimplugUi' in n.dataset

export function shieldOurFocus(): void {
  if (window.__vimplugShield) return
  window.__vimplugShield = true
  const shield = (e: Event) => {
    const f = e as FocusEvent
    if (ours(f.target) || ours(f.relatedTarget)) e.stopImmediatePropagation()
  }
  document.addEventListener('focusin', shield, true)
  document.addEventListener('focusout', shield, true)
}
