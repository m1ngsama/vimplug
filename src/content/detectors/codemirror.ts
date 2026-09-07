export const codemirror = (el: Element): boolean =>
  el.closest?.('.cm-content, .CodeMirror') != null
