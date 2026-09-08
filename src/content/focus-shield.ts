declare global {
  interface Window {
    __vimplugShield?: true
  }
}

const ours = (n: EventTarget | null): boolean =>
  n instanceof HTMLElement && 'vimplugUi' in n.dataset

/**
 * Hides focus moving into our own UI from the page.
 *
 * Must be called synchronously at document_start. A page keeps its caret from a capture
 * listener on document, and among capture listeners on one target the earliest registered
 * runs first. Register after the page and it pulls focus back out of the overlay: what is
 * typed lands in the page's own field and Escape never reaches the panel to close it.
 *
 * Safari reaches the engine through bootstrap's two awaits, so by then the page has run.
 * That is why this is called from bootstrap as well, and why it must not await anything.
 */
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
