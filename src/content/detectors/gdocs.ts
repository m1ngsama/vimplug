export const gdocs = (el: Element): boolean =>
  el.closest?.('.docs-texteventtarget-iframe, .kix-appview-editor') != null
